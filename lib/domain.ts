export type ProductSignal = {
  productId: string;
  currentDemand30: number;
  demand7dAgo?: number;
  demand30dAgo?: number;
  historyPoints: number;
  currentPrice: number;
  price30dAgo?: number;
  rating: number;
  deliveryDays: number;
  sellerScore: number;
  trendScore: number;
  competitionScore: number;
  seasonalityScore: number;
  commissionRate: number;
};

export type ForecastPoint = {
  horizonDays: 30 | 60 | 90;
  forecastDemand: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
};

export type OpportunityWeights = {
  demand: number;
  forecast: number;
  margin: number;
  competition: number;
  fulfilment: number;
  confidence: number;
};

export type OpportunityResult = {
  totalScore: number;
  recommendedAction: 'PROMOTE' | 'WATCH' | 'REJECT';
  components: {
    demand: number;
    forecast: number;
    margin: number;
    competition: number;
    fulfilment: number;
    confidence: number;
    riskPenalty: number;
  };
  reasonCodes: string[];
};
