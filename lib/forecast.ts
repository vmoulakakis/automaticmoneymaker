import type { ForecastPoint, ProductSignal } from './domain';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function forecast90Days(signal: ProductSignal): ForecastPoint[] {
  const baseline30 = Math.max(1, signal.currentOrders - signal.orders30dAgo);
  const recent7 = Math.max(0, signal.currentOrders - signal.orders7dAgo);
  const projected7To30 = recent7 * (30 / 7);

  const momentumRatio = baseline30 > 0 ? projected7To30 / baseline30 : 1;
  const momentum = clamp(momentumRatio, 0.45, 2.4);
  const trendMultiplier = clamp(0.65 + signal.trendScore * 0.7, 0.65, 1.35);
  const seasonalityMultiplier = clamp(0.7 + signal.seasonalityScore * 0.6, 0.7, 1.3);
  const ratingMultiplier = clamp(0.82 + (signal.rating / 5) * 0.28, 0.82, 1.1);
  const deliveryMultiplier = clamp(1.12 - Math.max(0, signal.deliveryDays - 3) * 0.025, 0.72, 1.12);
  const sellerMultiplier = clamp(0.75 + signal.sellerScore * 0.35, 0.75, 1.1);

  const growthFactor = clamp(
    Math.pow(momentum, 0.38) * trendMultiplier * seasonalityMultiplier * ratingMultiplier * deliveryMultiplier * sellerMultiplier,
    0.45,
    1.9,
  );

  const dataDepth = signal.currentOrders >= 500 ? 1 : signal.currentOrders >= 100 ? 0.85 : signal.currentOrders >= 25 ? 0.65 : 0.45;
  const stability = clamp(1 - Math.abs(1 - momentum) * 0.25, 0.45, 1);
  const confidence = clamp(dataDepth * 0.65 + stability * 0.35, 0.3, 0.95);

  return ([30, 60, 90] as const).map((horizonDays) => {
    const horizonFactor = horizonDays / 30;
    const dampedGrowth = Math.pow(growthFactor, Math.sqrt(horizonFactor));
    const forecastDemand = baseline30 * horizonFactor * dampedGrowth;
    const uncertainty = (1 - confidence) * (0.45 + horizonFactor * 0.12);

    return {
      horizonDays,
      forecastDemand: Math.round(forecastDemand),
      lowerBound: Math.max(0, Math.round(forecastDemand * (1 - uncertainty))),
      upperBound: Math.round(forecastDemand * (1 + uncertainty)),
      confidence: Number(confidence.toFixed(4)),
    };
  });
}
