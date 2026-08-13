# Architecture

## Objective
Build an autonomous EU-stock product intelligence system that discovers AliExpress opportunities, measures demand, forecasts the next 90 days, and continuously re-ranks products.

## Agent graph

### 1. Catalog Sentinel
- Pulls candidate products from AliExpress Affiliate API.
- Enforces EU-stock / delivery-market filters.
- Normalizes product, seller, price, shipping and category data.

### 2. Demand Scout
Collects demand signals per product/category:
- internal click / conversion history
- AliExpress sales/order signals when available
- price and discount changes
- seller strength
- search/trend proxies
- seasonality
- competition density
- shipping SLA / warehouse country

### 3. Market Analyst
Creates normalized features and detects:
- accelerating demand
- saturated niches
- price compression
- unusual discounts
- weak fulfilment
- rising category momentum

### 4. Forecast Agent
Does NOT ask an LLM to invent sales.
It invokes deterministic forecasting logic and stores:
- 30-day forecast
- 60-day forecast
- 90-day forecast
- confidence interval
- model version
- feature snapshot

### 5. Opportunity Strategist
Combines forecast + unit economics + competition + delivery quality into an opportunity score. It proposes one action:
- PROMOTE
- WATCH
- REJECT

### 6. Risk / Guardrail Agent
Can veto a recommendation when:
- warehouse is outside configured EU zones
- delivery SLA exceeds threshold
- seller quality is below threshold
- price data is stale
- confidence is too low
- margin / commission is below minimum

### 7. Supervisor
Runs the graph, handles retries, records cost/runtime, and maintains the audit trail.

## Monitoring & configuration app

The dashboard exposes:
- system health
- latest runs
- agent success/failure rates
- product funnel
- top opportunities
- 30/60/90-day forecasts
- score explanation
- model confidence
- configurable scoring weights
- hard guardrails
- agent enable/disable controls
- run frequency
- API status

## Data design

Supabase is the system of record. Raw data is never overwritten: observations are append-only so forecasts and decisions remain reproducible.

Primary entities:
- products
- product_observations
- demand_features
- forecasts
- opportunity_scores
- agent_runs
- agent_decisions
- system_config

## Security
- Secrets are injected as environment variables.
- AliExpress App Secret is never committed to GitHub.
- Service-role credentials are server-side only.
- Dashboard writes require authenticated administrative access.

## Forecasting v1

Forecasting begins with a transparent weighted trend model using recent observations, momentum, seasonality and confidence penalties. The interface is intentionally model-agnostic so a later Prophet/XGBoost/LightGBM/TimeGPT-style service can be added without changing the database contract.
