import type { ForecastPoint, OpportunityResult, OpportunityWeights, ProductSignal } from './domain';

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export const defaultWeights: OpportunityWeights = {
  demand: 0.27,
  forecast: 0.23,
  margin: 0.14,
  competition: 0.12,
  fulfilment: 0.14,
  confidence: 0.1,
};

export function scoreOpportunity(
  signal: ProductSignal,
  forecasts: ForecastPoint[],
  weights: OpportunityWeights = defaultWeights,
): OpportunityResult {
  const f30 = forecasts.find((f) => f.horizonDays === 30)!;
  const f90 = forecasts.find((f) => f.horizonDays === 90)!;
  const baseline30 = Math.max(1, signal.currentOrders - signal.orders30dAgo);

  const demand = clamp((Math.log10(Math.max(1, signal.currentOrders)) / 4) * 100);
  const forecast = clamp((f90.forecastDemand / Math.max(1, baseline30 * 3)) * 70 + signal.trendScore * 30);
  const margin = clamp(signal.commissionRate * 550);
  const competition = clamp((1 - signal.competitionScore) * 100);
  const fulfilment = clamp(112 - signal.deliveryDays * 6 + signal.sellerScore * 18);
  const confidence = clamp(f30.confidence * 100);

  let riskPenalty = 0;
  const reasonCodes: string[] = [];

  if (signal.deliveryDays > 10) {
    riskPenalty += 18;
    reasonCodes.push('SLOW_DELIVERY');
  }
  if (signal.rating < 4.2) {
    riskPenalty += 12;
    reasonCodes.push('LOW_RATING');
  }
  if (f30.confidence < 0.55) {
    riskPenalty += 14;
    reasonCodes.push('LOW_FORECAST_CONFIDENCE');
  }
  if (signal.commissionRate < 0.03) {
    riskPenalty += 10;
    reasonCodes.push('LOW_COMMISSION');
  }

  const weighted =
    demand * weights.demand +
    forecast * weights.forecast +
    margin * weights.margin +
    competition * weights.competition +
    fulfilment * weights.fulfilment +
    confidence * weights.confidence;

  const totalScore = Number(clamp(weighted - riskPenalty).toFixed(2));
  const recommendedAction = totalScore >= 72 && riskPenalty < 25 ? 'PROMOTE' : totalScore >= 55 ? 'WATCH' : 'REJECT';

  if (recommendedAction === 'PROMOTE') reasonCodes.push('HIGH_OPPORTUNITY_SCORE');
  if (signal.trendScore >= 0.7) reasonCodes.push('TREND_ACCELERATION');
  if (signal.competitionScore <= 0.35) reasonCodes.push('LOW_COMPETITION');

  return {
    totalScore,
    recommendedAction,
    components: { demand, forecast, margin, competition, fulfilment, confidence, riskPenalty },
    reasonCodes,
  };
}
