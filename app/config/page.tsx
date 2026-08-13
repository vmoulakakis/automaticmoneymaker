import { createServerSupabase } from '@/lib/supabase';
import { saveConfiguration } from './actions';

export const dynamic = 'force-dynamic';

export default async function ConfigurationPage() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from('system_config').select('key,value').order('key');
  const config = Object.fromEntries((data ?? []).map((row: any) => [row.key, row.value]));
  const weights = config.score_weights ?? {};

  return (
    <>
      <section className="hero">
        <div>
          <div className="kicker">Control plane</div>
          <h1>Configure the autonomous system.</h1>
          <p className="lead">Tune exploration, demand-model maturity, EU-stock verification freshness, and how opportunity scoring balances demand, forecast, margin, competition, fulfilment and confidence.</p>
        </div>
      </section>

      <form action={saveConfiguration} className="grid">
        <section className="card">
          <div className="section-title"><h2>Autonomy & discovery</h2></div>
          <div className="form-grid">
            <label>Discovery pages per run<input name="max_discovery_pages" type="number" min="1" max="10" defaultValue={Number(config.max_discovery_pages ?? 3)} /></label>
            <label>EU verifications per run<input name="max_eu_verifications_per_run" type="number" min="0" max="50" defaultValue={Number(config.max_eu_verifications_per_run ?? 12)} /></label>
            <label>Fast-delivery filter (days)<select name="discovery_delivery_days" defaultValue={String(config.discovery_delivery_days ?? 10)}><option value="3">3</option><option value="5">5</option><option value="7">7</option><option value="10">10</option></select></label>
            <label>Max acceptable delivery days<input name="max_delivery_days" type="number" min="1" max="30" defaultValue={Number(config.max_delivery_days ?? 10)} /></label>
            <label>EU verification freshness (hours)<input name="eu_verification_ttl_hours" type="number" min="1" max="168" defaultValue={Number(config.eu_verification_ttl_hours ?? 24)} /></label>
            <label>Allowed EU warehouse country codes<textarea name="allowed_warehouse_countries" defaultValue={(config.allowed_warehouse_countries ?? ['ES','FR','DE','IT','PL','CZ','BE','NL']).join(', ')} /></label>
            <label>Optional discovery keywords<textarea name="discovery_keywords" placeholder="portable monitor, smart home..." defaultValue={(config.discovery_keywords ?? []).join(', ')} /></label>
            <label>Optional AliExpress category IDs<textarea name="discovery_category_ids" placeholder="200001100, 200003482..." defaultValue={(config.discovery_category_ids ?? []).join(', ')} /></label>
            <div className="card">
              <label><span><input name="autonomous_mode" type="checkbox" defaultChecked={config.autonomous_mode !== false} style={{ width: 'auto', marginRight: 8 }} />Autonomous mode</span></label>
              <label><span><input name="require_verified_eu_stock" type="checkbox" defaultChecked={config.require_verified_eu_stock !== false} style={{ width: 'auto', marginRight: 8 }} />Require verified EU stock for PROMOTE</span></label>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-title"><h2>Forecast maturity gates</h2><span className="muted">Prevent false confidence from thin history</span></div>
          <div className="form-grid">
            <label>Minimum rolling observations<input name="min_history_points_for_promotion" type="number" min="2" max="100" defaultValue={Number(config.min_history_points_for_promotion ?? 4)} /></label>
            <label>Minimum history span (hours)<input name="min_history_span_hours_for_promotion" type="number" min="0" max="720" defaultValue={Number(config.min_history_span_hours_for_promotion ?? 24)} /></label>
          </div>
        </section>

        <section className="card">
          <div className="section-title"><h2>Decision thresholds</h2></div>
          <div className="form-grid">
            <label>PROMOTE score<input name="promotion_threshold" type="number" min="0" max="100" step="0.1" defaultValue={Number(config.promotion_threshold ?? 72)} /></label>
            <label>WATCH score<input name="watch_threshold" type="number" min="0" max="100" step="0.1" defaultValue={Number(config.watch_threshold ?? 55)} /></label>
            <label>Minimum forecast confidence<input name="min_confidence" type="number" min="0" max="1" step="0.01" defaultValue={Number(config.min_confidence ?? 0.55)} /></label>
          </div>
        </section>

        <section className="card">
          <div className="section-title"><h2>Opportunity score weights</h2><span className="muted">Must total 1.00</span></div>
          <div className="form-grid">
            <label>Demand<input name="weight_demand" type="number" min="0" max="1" step="0.01" defaultValue={Number(weights.demand ?? 0.27)} /></label>
            <label>90-day forecast<input name="weight_forecast" type="number" min="0" max="1" step="0.01" defaultValue={Number(weights.forecast ?? 0.23)} /></label>
            <label>Commission / margin<input name="weight_margin" type="number" min="0" max="1" step="0.01" defaultValue={Number(weights.margin ?? 0.14)} /></label>
            <label>Competition<input name="weight_competition" type="number" min="0" max="1" step="0.01" defaultValue={Number(weights.competition ?? 0.12)} /></label>
            <label>Fulfilment<input name="weight_fulfilment" type="number" min="0" max="1" step="0.01" defaultValue={Number(weights.fulfilment ?? 0.14)} /></label>
            <label>Forecast confidence<input name="weight_confidence" type="number" min="0" max="1" step="0.01" defaultValue={Number(weights.confidence ?? 0.10)} /></label>
          </div>
          <div className="button-row"><button type="submit">Save configuration</button><span className="muted">Changes apply to the next autonomous run.</span></div>
        </section>
      </form>
    </>
  );
}
