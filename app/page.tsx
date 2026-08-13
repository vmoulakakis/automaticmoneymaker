import { createServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function fmt(value: unknown, digits = 0) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits }) : '—';
}

export default async function MonitorPage() {
  const supabase = createServerSupabase();

  const [{ data: scores }, { data: runs }, { count: verifiedCount }, { count: productCount }] = await Promise.all([
    supabase
      .from('opportunity_scores')
      .select('id,total_score,recommended_action,scored_at,explanation,products!inner(id,title,external_id,current_price,currency,warehouse_country,eu_stock_verified,promotion_link,forecasts(horizon_days,forecast_demand,confidence,generated_at))')
      .order('scored_at', { ascending: false })
      .order('total_score', { ascending: false })
      .limit(30),
    supabase.from('agent_runs').select('*').order('started_at', { ascending: false }).limit(8),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('eu_stock_verified', true),
    supabase.from('products').select('*', { count: 'exact', head: true }),
  ]);

  const latestByProduct = new Map<string, any>();
  for (const row of scores ?? []) {
    const p = Array.isArray(row.products) ? row.products[0] : row.products;
    if (p?.id && !latestByProduct.has(p.id)) latestByProduct.set(p.id, row);
  }
  const latest = [...latestByProduct.values()].sort((a, b) => Number(b.total_score) - Number(a.total_score)).slice(0, 20);
  const promoted = latest.filter((row) => row.recommended_action === 'PROMOTE').length;
  const lastRun = runs?.[0];

  return (
    <>
      <section className="hero">
        <div>
          <div className="kicker">Autonomous supervisor</div>
          <h1>Demand intelligence, not another shop.</h1>
          <p className="lead">The system continuously discovers AliExpress candidates, stores rolling market snapshots, forecasts 30/60/90-day demand, verifies EU origin, and only then promotes opportunities.</p>
        </div>
        <div className="note">Strict mode: <strong>EU warehouse verification required before PROMOTE</strong>.</div>
      </section>

      <section className="grid stats">
        <div className="card"><div className="kicker">Catalog observed</div><div className="metric">{fmt(productCount)}</div></div>
        <div className="card"><div className="kicker">EU verified</div><div className="metric good">{fmt(verifiedCount)}</div></div>
        <div className="card"><div className="kicker">Current promote set</div><div className="metric good">{fmt(promoted)}</div></div>
        <div className="card"><div className="kicker">Last run</div><div className={`metric ${lastRun?.status === 'succeeded' ? 'good' : lastRun?.status === 'failed' ? 'bad' : 'warn'}`}>{lastRun?.status ?? 'not run'}</div></div>
      </section>

      <div className="section-title"><h2>Top opportunities</h2><span className="muted">Latest score per product</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Score</th><th>Decision</th><th>EU stock</th><th>Price</th><th>30d</th><th>60d</th><th>90d</th><th>Confidence</th></tr></thead>
          <tbody>
            {latest.length === 0 ? <tr><td colSpan={9} className="muted">No runs yet. Once Supabase and runtime secrets are connected, the supervisor will populate this view.</td></tr> : latest.map((row) => {
              const product = Array.isArray(row.products) ? row.products[0] : row.products;
              const allForecasts = product?.forecasts ?? [];
              const newestGenerated = allForecasts.reduce((max: string | null, f: any) => !max || f.generated_at > max ? f.generated_at : max, null);
              const forecasts = allForecasts.filter((f: any) => f.generated_at === newestGenerated);
              const byHorizon = Object.fromEntries(forecasts.map((f: any) => [f.horizon_days, f]));
              const confidence = byHorizon[30]?.confidence;
              return <tr key={row.id}>
                <td className="product">{product?.title ?? 'Unknown'}<div className="muted">#{product?.external_id}</div></td>
                <td><strong>{fmt(row.total_score, 1)}</strong></td>
                <td><span className={`badge ${String(row.recommended_action).toLowerCase()}`}>{row.recommended_action}</span></td>
                <td>{product?.eu_stock_verified ? <span className="badge verified">{product.warehouse_country ?? 'EU'} verified</span> : <span className="muted">unverified</span>}</td>
                <td>{product?.current_price ? `${fmt(product.current_price, 2)} ${product.currency ?? 'EUR'}` : '—'}</td>
                <td>{fmt(byHorizon[30]?.forecast_demand)}</td>
                <td>{fmt(byHorizon[60]?.forecast_demand)}</td>
                <td>{fmt(byHorizon[90]?.forecast_demand)}</td>
                <td>{confidence != null ? `${fmt(Number(confidence) * 100, 0)}%` : '—'}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      <div className="section-title"><h2>Agent runs</h2><span className="muted">Audit trail</span></div>
      <section className="card">
        {(runs ?? []).length === 0 ? <div className="muted">No agent runs recorded yet.</div> : (runs ?? []).map((run: any) => <div className="run" key={run.id}>
          <div><strong>{run.agent_name}</strong><div className="muted">{run.run_type}</div></div>
          <div><span className={`badge ${run.status === 'succeeded' ? 'promote' : run.status === 'failed' ? 'reject' : 'watch'}`}>{run.status}</span></div>
          <div>{fmt(run.output_count)} outputs<div className="muted">{fmt(run.error_count)} errors</div></div>
          <div>{run.duration_ms ? `${fmt(run.duration_ms / 1000, 1)} sec` : '—'}<div className="muted">{new Date(run.started_at).toLocaleString()}</div></div>
        </div>)}
      </section>
    </>
  );
}
