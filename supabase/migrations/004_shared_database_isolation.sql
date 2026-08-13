-- Isolate AutomaticMoneyMaker inside a Supabase project that may host other apps.
-- The application maps logical names (products, forecasts, etc.) to amm_* tables.
-- On a fresh database, migrations 001-003 create the logical tables first; this migration
-- renames only those app-owned tables. Existing unrelated tables are never modified.

do $$
begin
  if to_regclass('public.amm_products') is null and to_regclass('public.products') is not null then
    alter table public.products rename to amm_products;
  end if;
  if to_regclass('public.amm_product_observations') is null and to_regclass('public.product_observations') is not null then
    alter table public.product_observations rename to amm_product_observations;
  end if;
  if to_regclass('public.amm_demand_features') is null and to_regclass('public.demand_features') is not null then
    alter table public.demand_features rename to amm_demand_features;
  end if;
  if to_regclass('public.amm_forecasts') is null and to_regclass('public.forecasts') is not null then
    alter table public.forecasts rename to amm_forecasts;
  end if;
  if to_regclass('public.amm_opportunity_scores') is null and to_regclass('public.opportunity_scores') is not null then
    alter table public.opportunity_scores rename to amm_opportunity_scores;
  end if;
  if to_regclass('public.amm_agent_runs') is null and to_regclass('public.agent_runs') is not null then
    alter table public.agent_runs rename to amm_agent_runs;
  end if;
  if to_regclass('public.amm_agent_decisions') is null and to_regclass('public.agent_decisions') is not null then
    alter table public.agent_decisions rename to amm_agent_decisions;
  end if;
  if to_regclass('public.amm_system_config') is null and to_regclass('public.system_config') is not null then
    alter table public.system_config rename to amm_system_config;
  end if;
end
$$;

-- Cover run foreign keys used by audit/history queries.
create index if not exists amm_forecasts_run_id_idx
  on public.amm_forecasts(run_id)
  where run_id is not null;

create index if not exists amm_opportunity_scores_run_id_idx
  on public.amm_opportunity_scores(run_id)
  where run_id is not null;
