'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase';

const number = (form: FormData, key: string, fallback: number) => {
  const parsed = Number(form.get(key));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (form: FormData, key: string) => String(form.get(key) ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export async function saveConfiguration(form: FormData) {
  const supabase = createServerSupabase();

  const weights = {
    demand: number(form, 'weight_demand', 0.27),
    forecast: number(form, 'weight_forecast', 0.23),
    margin: number(form, 'weight_margin', 0.14),
    competition: number(form, 'weight_competition', 0.12),
    fulfilment: number(form, 'weight_fulfilment', 0.14),
    confidence: number(form, 'weight_confidence', 0.10),
  };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.001) throw new Error(`Score weights must total 1. Current total: ${total.toFixed(3)}`);

  const promotionThreshold = number(form, 'promotion_threshold', 72);
  const watchThreshold = number(form, 'watch_threshold', 55);
  if (watchThreshold > promotionThreshold) throw new Error('WATCH threshold cannot be greater than PROMOTE threshold.');

  const values: Record<string, unknown> = {
    score_weights: weights,
    promotion_threshold: promotionThreshold,
    watch_threshold: watchThreshold,
    min_confidence: number(form, 'min_confidence', 0.55),
    max_delivery_days: number(form, 'max_delivery_days', 10),
    discovery_delivery_days: number(form, 'discovery_delivery_days', 10),
    max_discovery_pages: number(form, 'max_discovery_pages', 3),
    max_eu_verifications_per_run: number(form, 'max_eu_verifications_per_run', 12),
    min_history_points_for_promotion: number(form, 'min_history_points_for_promotion', 4),
    min_history_span_hours_for_promotion: number(form, 'min_history_span_hours_for_promotion', 24),
    eu_verification_ttl_hours: number(form, 'eu_verification_ttl_hours', 24),
    allowed_warehouse_countries: list(form, 'allowed_warehouse_countries').map((value) => value.toUpperCase()),
    discovery_keywords: list(form, 'discovery_keywords'),
    discovery_category_ids: list(form, 'discovery_category_ids'),
    require_verified_eu_stock: form.get('require_verified_eu_stock') === 'on',
    autonomous_mode: form.get('autonomous_mode') === 'on',
  };

  for (const [key, value] of Object.entries(values)) {
    const { error } = await supabase.from('system_config').upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    if (error) throw error;
  }

  revalidatePath('/');
  revalidatePath('/config');
}
