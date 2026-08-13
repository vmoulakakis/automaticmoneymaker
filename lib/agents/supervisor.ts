import { extractProducts, queryAffiliateProducts, queryHotProducts, verifyEuStock } from '../aliexpress';
import { forecast90Days } from '../forecast';
import { scoreOpportunity } from '../scoring';
import { createServerSupabase } from '../supabase';
import type { ProductSignal } from '../domain';

type ConfigMap = Record<string, any>;

type Candidate = {
  raw: any;
  productId: string;
  dbId: string;
  signal: ProductSignal;
  forecasts: ReturnType<typeof forecast90Days>;
  score: ReturnType<typeof scoreOpportunity>;
  warehouseVerified: boolean;
  warehouseCountry?: string;
};

const num = (value: unknown, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pct = (value: unknown) => {
  const parsed = num(value, 0);
  return parsed > 1 ? parsed / 100 : parsed;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function getProductsFromPayload(payload: any) {
  return extractProducts(payload).filter((p) => p?.product_id);
}

function nearestOlderObservation(observations: any[], daysAgo: number) {
  const cutoff = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  return observations.find((row) => new Date(row.observed_at).getTime() <= cutoff);
}

async function loadConfig(supabase: ReturnType<typeof createServerSupabase>): Promise<ConfigMap> {
  const { data, error } = await supabase.from('system_config').select('key,value');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row: any) => [row.key, row.value]));
}

async function discover(config: ConfigMap) {
  const pages = Math.max(1, Math.min(Number(config.max_discovery_pages ?? 3), 10));
  const deliveryDays = String(config.discovery_delivery_days ?? 10) as '3' | '5' | '7' | '10';
  const categoryIds = Array.isArray(config.discovery_category_ids) ? config.discovery_category_ids.map(String) : [];
  const keywords = Array.isArray(config.discovery_keywords) ? config.discovery_keywords.map(String).filter(Boolean) : [];

  const payloads: any[] = [];

  for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
    payloads.push(await queryHotProducts({
      pageNo,
      pageSize: 50,
      sort: 'LAST_VOLUME_DESC',
      deliveryDays,
      categoryIds: categoryIds.length ? categoryIds : undefined,
    }));
  }

  for (const keyword of keywords.slice(0, 8)) {
    payloads.push(await queryAffiliateProducts({
      keywords: keyword,
      pageNo: 1,
      pageSize: 50,
      sort: 'LAST_VOLUME_DESC',
      deliveryDays,
      categoryIds: categoryIds.length ? categoryIds : undefined,
    }));
  }

  const deduped = new Map<string, any>();
  for (const payload of payloads) {
    for (const product of getProductsFromPayload(payload)) {
      deduped.set(String(product.product_id), product);
    }
  }

  return [...deduped.values()];
}

export async function runAutonomousSupervisor() {
  const supabase = createServerSupabase();
  const started = Date.now();

  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .insert({ agent_name: 'supervisor', run_type: 'autonomous_discovery', status: 'running' })
    .select('id')
    .single();
  if (runError) throw runError;

  try {
    const config = await loadConfig(supabase);
    const rawProducts = await discover(config);

    const categoryCounts = new Map<string, number>();
    const categoryMaxVolume = new Map<string, number>();
    for (const raw of rawProducts) {
      const category = String(raw.second_level_category_id ?? raw.first_level_category_id ?? 'unknown');
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      categoryMaxVolume.set(category, Math.max(categoryMaxVolume.get(category) ?? 0, num(raw.lastest_volume)));
    }
    const maxCategoryCount = Math.max(1, ...categoryCounts.values());

    const candidates: Candidate[] = [];

    for (const raw of rawProducts) {
      const externalId = String(raw.product_id);
      const categoryId = String(raw.second_level_category_id ?? raw.first_level_category_id ?? 'unknown');
      const categoryName = String(raw.second_level_category_name ?? raw.first_level_category_name ?? 'Unknown');
      const currentDemand30 = Math.max(0, num(raw.lastest_volume));
      const currentPrice = num(raw.target_sale_price ?? raw.sale_price);
      const originalPrice = num(raw.target_original_price ?? raw.original_price);
      const commissionRate = pct(raw.hot_product_commission_rate ?? raw.commission_rate);
      const sellerScore = clamp01(pct(raw.evaluate_rate));
      const rating = sellerScore > 0 ? sellerScore * 5 : 4.2;
      const discountStrength = originalPrice > 0 ? clamp01((originalPrice - currentPrice) / originalPrice) : pct(raw.discount);
      const relativeVolume = currentDemand30 / Math.max(1, categoryMaxVolume.get(categoryId) ?? currentDemand30);
      const trendScore = clamp01(relativeVolume * 0.7 + discountStrength * 0.3);
      const competitionScore = clamp01((categoryCounts.get(categoryId) ?? 1) / maxCategoryCount);
      const shipToDaysMatch = String(raw.ship_to_days ?? '').match(/(\d+)\s*days?/i);
      const deliveryDays = shipToDaysMatch ? Number(shipToDaysMatch[1]) : Number(config.discovery_delivery_days ?? 10);

      const { data: product, error: productError } = await supabase
        .from('products')
        .upsert({
          external_id: externalId,
          title: String(raw.product_title ?? `AliExpress ${externalId}`),
          product_url: raw.product_detail_url ?? null,
          promotion_link: raw.promotion_link ?? null,
          image_url: raw.product_main_image_url ?? null,
          category_id: categoryId,
          category_name: categoryName,
          seller_id: raw.shop_id ? String(raw.shop_id) : null,
          current_price: currentPrice || null,
          original_price: originalPrice || null,
          commission_rate: commissionRate || null,
          rating,
          order_count: Math.round(currentDemand30),
          currency: raw.target_sale_price_currency ?? raw.sale_price_currency ?? 'EUR',
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          raw,
        }, { onConflict: 'external_id' })
        .select('id,eu_stock_verified,warehouse_country')
        .single();
      if (productError) throw productError;

      const { data: previous, error: historyError } = await supabase
        .from('product_observations')
        .select('observed_at,order_count,price')
        .eq('product_id', product.id)
        .order('observed_at', { ascending: false })
        .limit(40);
      if (historyError) throw historyError;

      const obs7 = nearestOlderObservation(previous ?? [], 7);
      const obs30 = nearestOlderObservation(previous ?? [], 30);

      const { error: observationError } = await supabase.from('product_observations').insert({
        product_id: product.id,
        price: currentPrice || null,
        original_price: originalPrice || null,
        discount_pct: discountStrength,
        rating,
        order_count: Math.round(currentDemand30),
        delivery_days: deliveryDays,
        seller_score: sellerScore,
        demand_proxy: currentDemand30,
        trend_proxy: trendScore,
        competition_proxy: competitionScore,
        raw,
      });
      if (observationError) throw observationError;

      const signal: ProductSignal = {
        productId: product.id,
        currentDemand30,
        demand7dAgo: obs7?.order_count ?? undefined,
        demand30dAgo: obs30?.order_count ?? undefined,
        historyPoints: (previous?.length ?? 0) + 1,
        currentPrice,
        price30dAgo: obs30?.price ?? undefined,
        rating,
        deliveryDays,
        sellerScore,
        trendScore,
        competitionScore,
        seasonalityScore: 0.5,
        commissionRate,
      };

      await supabase.from('demand_features').insert({
        product_id: product.id,
        momentum_7d: signal.demand7dAgo ? currentDemand30 / Math.max(1, signal.demand7dAgo) : null,
        momentum_30d: signal.demand30dAgo ? currentDemand30 / Math.max(1, signal.demand30dAgo) : null,
        price_velocity: signal.price30dAgo ? currentPrice / Math.max(0.01, signal.price30dAgo) : null,
        discount_strength: discountStrength,
        seller_strength: sellerScore,
        delivery_strength: clamp01(1 - Math.max(0, deliveryDays - 3) / 12),
        competition_score: competitionScore,
        seasonality_score: 0.5,
        trend_score: trendScore,
        conversion_signal: null,
        feature_vector: signal,
        model_version: 'features-v1.1',
      });

      const forecasts = forecast90Days(signal);
      const score = scoreOpportunity(signal, forecasts);
      candidates.push({
        raw,
        productId: externalId,
        dbId: product.id,
        signal,
        forecasts,
        score,
        warehouseVerified: Boolean(product.eu_stock_verified),
        warehouseCountry: product.warehouse_country ?? undefined,
      });
    }

    const verificationLimit = Math.max(0, Math.min(Number(config.max_eu_verifications_per_run ?? 12), 50));
    const allowedWarehouses = Array.isArray(config.allowed_warehouse_countries)
      ? config.allowed_warehouse_countries.map(String)
      : ['ES', 'FR', 'DE', 'IT', 'PL', 'CZ', 'BE', 'NL'];

    const verificationQueue = [...candidates]
      .filter((candidate) => !candidate.warehouseVerified)
      .sort((a, b) => b.score.totalScore - a.score.totalScore)
      .slice(0, verificationLimit);

    for (const candidate of verificationQueue) {
      const verification = await verifyEuStock(candidate.productId, allowedWarehouses);
      candidate.warehouseVerified = verification.verified;
      candidate.warehouseCountry = verification.verified ? verification.countryCode : undefined;

      await supabase.from('products').update({
        eu_stock_verified: verification.verified,
        eu_stock_verified_at: verification.verified ? new Date().toISOString() : null,
        eu_stock_verification_reason: verification.verified ? 'FREIGHT_API_CONFIRMED' : verification.reason,
        warehouse_country: verification.verified ? verification.countryCode : null,
        updated_at: new Date().toISOString(),
      }).eq('id', candidate.dbId);
    }

    const requireVerified = config.require_verified_eu_stock !== false;
    let promoted = 0;

    for (const candidate of candidates) {
      for (const forecast of candidate.forecasts) {
        await supabase.from('forecasts').insert({
          product_id: candidate.dbId,
          horizon_days: forecast.horizonDays,
          forecast_demand: forecast.forecastDemand,
          lower_bound: forecast.lowerBound,
          upper_bound: forecast.upperBound,
          confidence: forecast.confidence,
          model_version: 'rolling-volume-v1.1',
          feature_snapshot: candidate.signal,
          rationale: {
            source: 'AliExpress lastest_volume snapshots',
            neutral_seasonality_until_enriched: true,
          },
        });
      }

      let action = candidate.score.recommendedAction;
      const reasonCodes = [...candidate.score.reasonCodes];
      if (requireVerified && !candidate.warehouseVerified && action === 'PROMOTE') {
        action = 'WATCH';
        reasonCodes.push('EU_STOCK_NOT_VERIFIED');
      }
      if (action === 'PROMOTE') promoted += 1;

      await supabase.from('opportunity_scores').insert({
        product_id: candidate.dbId,
        total_score: candidate.score.totalScore,
        demand_score: candidate.score.components.demand,
        forecast_score: candidate.score.components.forecast,
        margin_score: candidate.score.components.margin,
        competition_score: candidate.score.components.competition,
        fulfilment_score: candidate.score.components.fulfilment,
        confidence_score: candidate.score.components.confidence,
        risk_penalty: candidate.score.components.riskPenalty,
        recommended_action: action,
        explanation: {
          reason_codes: reasonCodes,
          eu_stock_verified: candidate.warehouseVerified,
          warehouse_country: candidate.warehouseCountry ?? null,
          components: candidate.score.components,
        },
        scoring_version: 'score-v1.1',
      });

      await supabase.from('agent_decisions').insert({
        run_id: run.id,
        product_id: candidate.dbId,
        agent_name: 'opportunity-strategist',
        decision: action,
        confidence: candidate.forecasts[0]?.confidence ?? null,
        reason_codes: reasonCodes,
        evidence: {
          total_score: candidate.score.totalScore,
          forecasts: candidate.forecasts,
          eu_stock_verified: candidate.warehouseVerified,
        },
      });
    }

    const durationMs = Date.now() - started;
    await supabase.from('agent_runs').update({
      status: 'succeeded',
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      input_count: rawProducts.length,
      output_count: candidates.length,
      metadata: {
        promoted,
        verified_eu_stock: candidates.filter((c) => c.warehouseVerified).length,
        verification_attempted: verificationQueue.length,
      },
    }).eq('id', run.id);

    return {
      runId: run.id,
      discovered: rawProducts.length,
      evaluated: candidates.length,
      promoted,
      euVerified: candidates.filter((c) => c.warehouseVerified).length,
      durationMs,
    };
  } catch (error) {
    await supabase.from('agent_runs').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      error: { message: error instanceof Error ? error.message : String(error) },
    }).eq('id', run.id);
    throw error;
  }
}
