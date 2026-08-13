import type { ForecastPoint, ProductSignal } from './domain';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function forecast90Days(signal: ProductSignal): ForecastPoint[] {
  const baseline30 = Math.max(1, signal.currentDemand30);

  const momentum7 = signal.demand7dAgo && signal.demand7dAgo > 0
    ? clamp(signal.currentDemand30 / signal.demand7dAgo, 0.55, 1.8)
    : 1;
  const momentum30 = signal.demand30dAgo && signal.demand30dAgo > 0
    ? clamp(signal.currentDemand30 / signal.demand30dAgo, 0.45, 2.1)
    : 1;
  const momentum = momentum7 * 0.65 + momentum30 * 0.35;

  const trendMultiplier = clamp(0.78 + signal.trendScore * 0.44, 0.78, 1.22);
  const seasonalityMultiplier = clamp(0.82 + signal.seasonalityScore * 0.36, 0.82, 1.18);
  const ratingMultiplier = clamp(0.9 + (signal.rating / 5) * 0.16, 0.9, 1.06);
  const deliveryMultiplier = clamp(1.08 - Math.max(0, signal.deliveryDays - 3) * 0.02, 0.76, 1.08);
  const sellerMultiplier = clamp(0.84 + signal.sellerScore * 0.22, 0.84, 1.06);

  const growthFactor = clamp(
    Math.pow(momentum, 0.5) * trendMultiplier * seasonalityMultiplier * ratingMultiplier * deliveryMultiplier * sellerMultiplier,
    0.5,
    1.7,
  );

  const volumeDepth = baseline30 >= 500 ? 1 : baseline30 >= 100 ? 0.82 : baseline30 >= 25 ? 0.62 : 0.42;
  const historyDepth = clamp(signal.historyPoints / 12, 0.15, 1);
  const stability = clamp(1 - Math.abs(1 - momentum) * 0.35, 0.4, 1);
  const confidence = clamp(volumeDepth * 0.35 + historyDepth * 0.4 + stability * 0.25, 0.25, 0.94);

  return ([30, 60, 90] as const).map((horizonDays) => {
    const horizonFactor = horizonDays / 30;
    const dampedGrowth = Math.pow(growthFactor, Math.sqrt(horizonFactor));
    const forecastDemand = baseline30 * horizonFactor * dampedGrowth;
    const uncertainty = (1 - confidence) * (0.38 + horizonFactor * 0.14);

    return {
      horizonDays,
      forecastDemand: Math.round(forecastDemand),
      lowerBound: Math.max(0, Math.round(forecastDemand * (1 - uncertainty))),
      upperBound: Math.round(forecastDemand * (1 + uncertainty)),
      confidence: Number(confidence.toFixed(4)),
    };
  });
}
