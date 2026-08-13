insert into public.system_config(key, value, description) values
('min_history_points_for_promotion', '4'::jsonb, 'Minimum rolling observations required before PROMOTE can be emitted'),
('min_history_span_hours_for_promotion', '24'::jsonb, 'Minimum elapsed history window required before PROMOTE can be emitted'),
('eu_verification_ttl_hours', '24'::jsonb, 'Maximum age of EU-stock verification before origin must be checked again')
on conflict (key) do nothing;

create index if not exists observations_product_oldest_idx
  on public.product_observations(product_id, observed_at asc);
