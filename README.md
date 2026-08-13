# EU Stock Intelligence

Autonomous product-intelligence and 90-day demand forecasting system for AliExpress EU-stock opportunities.

## Core loop

1. Discover EU-stock products and normalize catalog data.
2. Collect demand, price, competition, logistics and trend signals.
3. Score opportunities with configurable weights and hard guardrails.
4. Forecast demand for the next 30/60/90 days with confidence bands.
5. Let agents propose Promote / Watch / Reject decisions.
6. Persist every signal, forecast, decision and run in Supabase for auditability.
7. Monitor health and tune thresholds from the configuration dashboard.

## Design rule

LLMs may explain and coordinate decisions, but numeric demand forecasts are produced by deterministic/statistical logic from stored signals. No secret is committed to GitHub.

## Stack

- Next.js + TypeScript monitoring/configuration app
- Supabase Postgres for state, history and audit log
- Supabase Edge Functions / scheduled jobs for autonomous runs
- AliExpress Affiliate API adapter
- Provider-agnostic optional LLM reasoning layer

See `docs/ARCHITECTURE.md` and `supabase/migrations/001_agentic_intelligence.sql`.
