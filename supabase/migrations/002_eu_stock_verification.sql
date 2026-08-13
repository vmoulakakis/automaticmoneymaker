alter table public.products
  add column if not exists eu_stock_verified boolean not null default false,
  add column if not exists eu_stock_verified_at timestamptz,
  add column if not exists eu_stock_verification_reason text,
  add column if not exists promotion_link text;

create index if not exists products_eu_verified_idx
  on public.products(eu_stock_verified, active);

insert into public.system_config(key, value, description) values
('max_discovery_pages', '3'::jsonb, 'Number of AliExpress discovery pages per autonomous run'),
('max_eu_verifications_per_run', '12'::jsonb, 'Maximum shortlisted products sent to freight verification per run'),
('discovery_delivery_days', '10'::jsonb, 'AliExpress fast-delivery filter for Greece'),
('require_verified_eu_stock', 'true'::jsonb, 'Blocks PROMOTE unless EU warehouse origin has been verified'),
('discovery_keywords', '[]'::jsonb, 'Optional keyword seeds; empty means broad hot-product discovery'),
('discovery_category_ids', '[]'::jsonb, 'Optional category seeds for focused discovery')
on conflict (key) do nothing;
