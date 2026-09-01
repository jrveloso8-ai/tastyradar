export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho?: number;
  iv: number;
}

export interface OptionContract {
  symbol: string;
  underlying: string;
  strike: number;
  type: 'CALL' | 'PUT';
  expiration: string;
  dte: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  greeks: OptionGreeks;
}

export interface GexByStrike {
  strike: number;
  callGex: number;
  putGex: number;
  netGex: number;
  callOi: number;
  putOi: number;
  callVolume: number;
  putVolume: number;
}

export interface GexAnalysisResult {
  symbol: string;
  spotPrice: number;
  totalNetGex: number;
  totalCallGex: number;
  totalPutGex: number;
  zeroGammaFlip: number;
  maxGexMagnetStrike: number;
  putCallRatioOi: number;
  putCallRatioVolume: number;
  gammaRegime: 'LONG_GAMMA_STABLE' | 'SHORT_GAMMA_VOLATILE' | 'NEUTRAL';
  strikes: GexByStrike[];
  callWalls: { strike: number; symbol: string; contracts: number; delta: number; iv: number; distancePct: number }[];
  putWalls: { strike: number; symbol: string; contracts: number; delta: number; iv: number; distancePct: number }[];
  calculatedAt: string;
}

export interface MarketAssetQuote {
  symbol: string;
  name: string;
  spotPrice: number;
  change: number;
  changePercent: number;
  high52w: number;
  low52w: number;
  volume: number;
  avgVolume20: number;
  peRatio?: number;
  evEbitda?: number;
  dividendYield?: number;
  ivRank?: number;
  ivPercentile30d?: number;
  hv21?: number;
  hv63?: number;
  updatedAt: string;
}