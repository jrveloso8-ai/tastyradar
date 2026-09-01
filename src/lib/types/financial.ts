export type FundamentalMetricStatus = 'BOM' | 'NEUTRO' | 'RUIM' | 'N/D';

export type FundamentalMetricSource = 
  | 'BRAPI_CONTABIL' 
  | 'RECONCILIADO_FINANCEIRO' 
  | 'NORMALIZADO_FCO' 
  | 'OFICIAL_EMPRESA';

export interface FundamentalMetric {
  name: string;
  value: number | null;
  formatted: string;
  benchmark: string;
  status: FundamentalMetricStatus;
  description: string;
  isAdjusted?: boolean;
  rawAccountingValue?: number | null;
  rawAccountingFormatted?: string;
  adjustmentReason?: string;
  source?: FundamentalMetricSource;
}

export interface FundamentalPillar {
  name: 'Rentabilidade' | 'Solvência' | 'Valuation';
  weight: number; // e.g. 0.35, 0.35, 0.30
  score: number; // 0 to 100
  metrics: FundamentalMetric[];
}

export interface FundamentalAnalysisResult {
  symbol: string;
  score: number;
  status: 'APROVADO' | 'REPROVADO' | 'EM_OBSERVACAO';
  minApprovalScore: number;
  pillars: {
    rentabilidade: FundamentalPillar;
    solvencia: FundamentalPillar;
    valuation: FundamentalPillar;
  };
  metrics: FundamentalMetric[];
  summary: string;
  analystVerdict: string;
  distortionsDetected: string[];
  topNegativeDrivers: FundamentalMetric[];
  calculatedAt: string;
  isReconciled: boolean;
}

export interface RawFundamentalData {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number | null;
  netIncome?: number | null;
  totalDebt?: number | null;
  totalCash?: number | null;
  ebitda?: number | null;
  operatingCashFlow?: number | null;
  financialDebt?: number | null;
  financialDebtToEbitda?: number | null;
  returnOnEquity?: number | null;
  netMargin?: number | null;
  ebitdaMargin?: number | null;
  debtToEbitda?: number | null;
  currentRatio?: number | null;
  priceEarnings?: number | null;
  priceToBook?: number | null;
  dividendYield?: number | null;
  nonRecurringImpairment?: number | null;
}
