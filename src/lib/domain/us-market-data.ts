/**
 * Catálogo de ~64 tickers usado por Cotação/Fundamentos/Gráfico (QuoteView, ScreenerView).
 * NÃO é a mesma base do motor de opções: `SP500_DATASET` (sp500-dataset.ts) tem 48
 * tickers com IV30/RV20/IVR/IVP, GEX e Walls de OI reais — campos que USStockItem não
 * carrega. Hoje só 31 tickers existem nos dois catálogos ao mesmo tempo; os outros 33
 * daqui têm cotação/fundamentos normalmente, mas SEM estrutura de opções (a aba Opções
 * de QuoteView.tsx avisa explicitamente quando o ticker não está em SP500_DATASET, em
 * vez de fabricar strikes/prêmios — ver Nível 1 Parte 3 da remediação, Ciclo 4).
 *
 * Por que dois catálogos em vez de um: consolidá-los exigiria levantar IV/GEX/Walls
 * reais para os 33 tickers que só existem aqui (ou marcá-los formalmente como
 * indisponíveis) e migrar todo componente que hoje importa um catálogo específico —
 * decisão de produto/dado deliberadamente adiada (Nível 1 Parte 4, decidido em conjunto
 * com o usuário em 2026-09-08: documentar a coexistência agora, consolidar depois).
 */
export interface USStockItem {
  symbol: string;
  name: string;
  sector: string;
  category: 'ALTA' | 'BAIXA' | 'LATERAL';
  spot: number;
  change: number;
  ivRank: number;
  ivAtm: number;
  stop: number;
  alvo1: number;
  alvo2: number;
  rr: string;
  strategy?: string;
  dataAsOf?: string; // Marca-d'agua de frescor do dado estatico (Achado C5-01)
}

export const US_DATA_AS_OF = '2026-09-08';

export const US_STOCKS_DATASET: USStockItem[] = [
  // Big Tech & Growth
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Tecnologia', category: 'ALTA', spot: 142.50, change: 2.84, ivRank: 42.5, ivAtm: 44.2, stop: 135.80, alvo1: 149.50, alvo2: 158.00, rr: '2.45:1' },
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Tecnologia', category: 'ALTA', spot: 238.10, change: 0.65, ivRank: 21.0, ivAtm: 18.5, stop: 231.50, alvo1: 246.00, alvo2: 255.00, rr: '1.85:1' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Tecnologia', category: 'ALTA', spot: 432.80, change: 0.95, ivRank: 24.0, ivAtm: 20.5, stop: 422.00, alvo1: 446.00, alvo2: 458.00, rr: '2.05:1' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumo Cíclico', category: 'ALTA', spot: 198.50, change: 1.10, ivRank: 32.0, ivAtm: 28.0, stop: 192.00, alvo1: 208.00, alvo2: 216.00, rr: '2.15:1' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)', sector: 'Comunicação', category: 'ALTA', spot: 175.20, change: 1.25, ivRank: 26.0, ivAtm: 23.0, stop: 169.00, alvo1: 183.00, alvo2: 190.00, rr: '2.10:1' },
  { symbol: 'GOOG', name: 'Alphabet Inc. (Class C)', sector: 'Comunicação', category: 'ALTA', spot: 176.40, change: 1.20, ivRank: 26.0, ivAtm: 23.0, stop: 170.00, alvo1: 184.00, alvo2: 191.00, rr: '2.10:1' },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Comunicação', category: 'ALTA', spot: 612.40, change: 1.45, ivRank: 28.0, ivAtm: 26.5, stop: 598.00, alvo1: 632.00, alvo2: 650.00, rr: '1.95:1' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Tecnologia', category: 'ALTA', spot: 178.20, change: 2.15, ivRank: 36.0, ivAtm: 34.0, stop: 171.00, alvo1: 188.00, alvo2: 196.00, rr: '2.30:1' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Tecnologia', category: 'ALTA', spot: 156.40, change: 3.10, ivRank: 52.0, ivAtm: 48.0, stop: 148.00, alvo1: 168.00, alvo2: 178.00, rr: '2.20:1' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Comunicação', category: 'ALTA', spot: 885.00, change: 1.80, ivRank: 29.0, ivAtm: 27.5, stop: 855.00, alvo1: 925.00, alvo2: 960.00, rr: '2.10:1' },
  { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Tecnologia', category: 'ALTA', spot: 320.00, change: 1.35, ivRank: 31.0, ivAtm: 29.0, stop: 308.00, alvo1: 336.00, alvo2: 348.00, rr: '2.15:1' },
  { symbol: 'ORCL', name: 'Oracle Corporation', sector: 'Tecnologia', category: 'ALTA', spot: 185.40, change: 1.50, ivRank: 34.0, ivAtm: 30.0, stop: 178.00, alvo1: 195.00, alvo2: 202.00, rr: '2.10:1' },
  { symbol: 'QCOM', name: 'QUALCOMM Inc.', sector: 'Tecnologia', category: 'ALTA', spot: 168.50, change: 1.40, ivRank: 33.0, ivAtm: 31.0, stop: 162.00, alvo1: 177.00, alvo2: 184.00, rr: '2.05:1' },
  { symbol: 'AMAT', name: 'Applied Materials', sector: 'Tecnologia', category: 'ALTA', spot: 215.00, change: 2.20, ivRank: 38.0, ivAtm: 36.0, stop: 206.00, alvo1: 228.00, alvo2: 236.00, rr: '2.25:1' },
  { symbol: 'MU', name: 'Micron Technology', sector: 'Tecnologia', category: 'ALTA', spot: 108.00, change: 3.40, ivRank: 55.0, ivAtm: 49.0, stop: 102.00, alvo1: 116.00, alvo2: 122.00, rr: '2.20:1' },
  { symbol: 'LRCX', name: 'Lam Research Corp', sector: 'Tecnologia', category: 'ALTA', spot: 82.50, change: 2.50, ivRank: 40.0, ivAtm: 37.0, stop: 78.50, alvo1: 88.00, alvo2: 92.00, rr: '2.20:1' },
  { symbol: 'NOW', name: 'ServiceNow Inc.', sector: 'Tecnologia', category: 'ALTA', spot: 940.00, change: 1.60, ivRank: 35.0, ivAtm: 32.0, stop: 905.00, alvo1: 990.00, alvo2: 1030.00, rr: '2.25:1' },
  { symbol: 'PANW', name: 'Palo Alto Networks', sector: 'Tecnologia', category: 'ALTA', spot: 385.00, change: 1.75, ivRank: 39.0, ivAtm: 35.0, stop: 370.00, alvo1: 405.00, alvo2: 420.00, rr: '2.20:1' },
  { symbol: 'PLTR', name: 'Palantir Technologies', sector: 'Tecnologia', category: 'ALTA', spot: 64.20, change: 4.85, ivRank: 64.0, ivAtm: 58.0, stop: 59.50, alvo1: 71.00, alvo2: 78.00, rr: '2.60:1' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings', sector: 'Tecnologia', category: 'ALTA', spot: 345.00, change: 2.10, ivRank: 44.0, ivAtm: 41.0, stop: 330.00, alvo1: 365.00, alvo2: 380.00, rr: '2.15:1' },

  // Financials S&P 500
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financeiro', category: 'ALTA', spot: 245.00, change: 0.90, ivRank: 17.0, ivAtm: 15.0, stop: 238.00, alvo1: 255.00, alvo2: 262.00, rr: '2.00:1' },
  { symbol: 'BAC', name: 'Bank of America Corp', sector: 'Financeiro', category: 'ALTA', spot: 44.50, change: 0.80, ivRank: 20.0, ivAtm: 18.0, stop: 42.80, alvo1: 47.00, alvo2: 48.50, rr: '2.05:1' },
  { symbol: 'WFC', name: 'Wells Fargo & Co', sector: 'Financeiro', category: 'ALTA', spot: 68.20, change: 0.95, ivRank: 22.0, ivAtm: 19.5, stop: 65.50, alvo1: 72.00, alvo2: 74.50, rr: '2.10:1' },
  { symbol: 'GS', name: 'Goldman Sachs Group', sector: 'Financeiro', category: 'ALTA', spot: 580.00, change: 1.20, ivRank: 24.0, ivAtm: 21.0, stop: 560.00, alvo1: 610.00, alvo2: 630.00, rr: '2.20:1' },
  { symbol: 'MS', name: 'Morgan Stanley', sector: 'Financeiro', category: 'ALTA', spot: 124.00, change: 1.10, ivRank: 23.0, ivAtm: 20.0, stop: 119.00, alvo1: 131.00, alvo2: 136.00, rr: '2.10:1' },
  { symbol: 'V', name: 'Visa Inc. (Class A)', sector: 'Financeiro', category: 'ALTA', spot: 310.00, change: 0.70, ivRank: 18.0, ivAtm: 15.5, stop: 298.00, alvo1: 326.00, alvo2: 338.00, rr: '2.15:1' },
  { symbol: 'MA', name: 'Mastercard Inc. (Class A)', sector: 'Financeiro', category: 'ALTA', spot: 520.00, change: 0.85, ivRank: 19.0, ivAtm: 16.0, stop: 502.00, alvo1: 545.00, alvo2: 562.00, rr: '2.10:1' },
  { symbol: 'AXP', name: 'American Express Co', sector: 'Financeiro', category: 'ALTA', spot: 285.00, change: 1.15, ivRank: 22.0, ivAtm: 19.0, stop: 274.00, alvo1: 300.00, alvo2: 312.00, rr: '2.20:1' },
  { symbol: 'BLK', name: 'BlackRock Inc.', sector: 'Financeiro', category: 'ALTA', spot: 990.00, change: 1.05, ivRank: 21.0, ivAtm: 18.5, stop: 955.00, alvo1: 1040.00, alvo2: 1075.00, rr: '2.15:1' },

  // Healthcare S&P 500
  { symbol: 'LLY', name: 'Eli Lilly and Company', sector: 'Saúde', category: 'ALTA', spot: 850.00, change: 1.90, ivRank: 38.0, ivAtm: 33.0, stop: 818.00, alvo1: 895.00, alvo2: 930.00, rr: '2.25:1' },
  { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Saúde', category: 'ALTA', spot: 585.00, change: 0.80, ivRank: 20.0, ivAtm: 17.5, stop: 565.00, alvo1: 612.00, alvo2: 630.00, rr: '2.10:1' },
  { symbol: 'ISRG', name: 'Intuitive Surgical', sector: 'Saúde', category: 'ALTA', spot: 520.00, change: 1.45, ivRank: 32.0, ivAtm: 29.0, stop: 500.00, alvo1: 548.00, alvo2: 568.00, rr: '2.20:1' },
  { symbol: 'SYK', name: 'Stryker Corporation', sector: 'Saúde', category: 'ALTA', spot: 380.00, change: 0.90, ivRank: 22.0, ivAtm: 19.0, stop: 366.00, alvo1: 400.00, alvo2: 412.00, rr: '2.15:1' },
  { symbol: 'BSX', name: 'Boston Scientific', sector: 'Saúde', category: 'ALTA', spot: 88.50, change: 1.30, ivRank: 25.0, ivAtm: 22.0, stop: 85.00, alvo1: 93.00, alvo2: 96.50, rr: '2.10:1' },

  // Industrials & Aerospace S&P 500
  { symbol: 'GE', name: 'GE Aerospace', sector: 'Industrial', category: 'ALTA', spot: 188.50, change: 1.65, ivRank: 25.0, ivAtm: 22.0, stop: 181.00, alvo1: 198.00, alvo2: 206.00, rr: '2.00:1' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrial', category: 'ALTA', spot: 410.20, change: 1.20, ivRank: 22.0, ivAtm: 19.0, stop: 395.00, alvo1: 430.00, alvo2: 445.00, rr: '2.15:1' },
  { symbol: 'RTX', name: 'RTX Corporation', sector: 'Industrial', category: 'ALTA', spot: 122.00, change: 1.05, ivRank: 24.0, ivAtm: 20.0, stop: 117.00, alvo1: 129.00, alvo2: 134.00, rr: '2.10:1' },
  { symbol: 'LMT', name: 'Lockheed Martin Corp', sector: 'Industrial', category: 'ALTA', spot: 540.00, change: 1.10, ivRank: 23.0, ivAtm: 19.5, stop: 520.00, alvo1: 568.00, alvo2: 585.00, rr: '2.15:1' },
  { symbol: 'ETN', name: 'Eaton Corporation plc', sector: 'Industrial', category: 'ALTA', spot: 360.00, change: 1.40, ivRank: 27.0, ivAtm: 23.5, stop: 345.00, alvo1: 380.00, alvo2: 395.00, rr: '2.20:1' },

  // BAIXA - Oportunidades de Venda / Trava Baixa
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumo Cíclico', category: 'BAIXA', spot: 248.30, change: -1.15, ivRank: 68.2, ivAtm: 52.0, stop: 260.00, alvo1: 232.00, alvo2: 220.00, rr: '1.80:1', strategy: 'Trava de Baixa com Opções (Bear Put Spread)' },
  { symbol: 'INTC', name: 'Intel Corporation', sector: 'Tecnologia', category: 'BAIXA', spot: 23.40, change: -2.30, ivRank: 58.0, ivAtm: 42.0, stop: 25.50, alvo1: 20.50, alvo2: 18.00, rr: '1.90:1', strategy: 'Trava de Baixa com Opções (Bear Put Spread)' },
  { symbol: 'BA', name: 'The Boeing Company', sector: 'Industrial', category: 'BAIXA', spot: 162.00, change: -1.80, ivRank: 48.0, ivAtm: 38.0, stop: 172.00, alvo1: 148.00, alvo2: 135.00, rr: '1.85:1', strategy: 'Trava de Baixa com Opções (Bear Put Spread)' },
  { symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumo Cíclico', category: 'BAIXA', spot: 78.50, change: -0.90, ivRank: 38.0, ivAtm: 26.0, stop: 83.00, alvo1: 72.00, alvo2: 66.00, rr: '1.75:1', strategy: 'Trava de Baixa com Opções (Bear Put Spread)' },
  { symbol: 'WBD', name: 'Warner Bros Discovery', sector: 'Comunicação', category: 'BAIXA', spot: 9.80, change: -3.20, ivRank: 62.0, ivAtm: 46.0, stop: 10.80, alvo1: 8.40, alvo2: 7.20, rr: '1.95:1', strategy: 'Trava de Baixa com Opções (Bear Put Spread)' },
  { symbol: 'UPS', name: 'United Parcel Service', sector: 'Industrial', category: 'BAIXA', spot: 132.00, change: -1.25, ivRank: 42.0, ivAtm: 28.0, stop: 139.00, alvo1: 122.00, alvo2: 114.00, rr: '1.80:1', strategy: 'Trava de Baixa com Opções (Bear Put Spread)' },
  { symbol: 'CVS', name: 'CVS Health Corp', sector: 'Saúde', category: 'BAIXA', spot: 58.00, change: -1.40, ivRank: 49.0, ivAtm: 32.0, stop: 62.00, alvo1: 52.50, alvo2: 48.00, rr: '1.85:1', strategy: 'Trava de Baixa com Opções (Bear Put Spread)' },
  { symbol: 'BMY', name: 'Bristol-Myers Squibb', sector: 'Saúde', category: 'BAIXA', spot: 56.00, change: -0.95, ivRank: 36.0, ivAtm: 25.0, stop: 59.50, alvo1: 51.00, alvo2: 47.50, rr: '1.80:1', strategy: 'Trava de Baixa com Opções (Bear Put Spread)' },
  { symbol: 'TGT', name: 'Target Corporation', sector: 'Consumo Básico', category: 'BAIXA', spot: 135.00, change: -1.60, ivRank: 45.0, ivAtm: 29.0, stop: 143.00, alvo1: 124.00, alvo2: 116.00, rr: '1.85:1', strategy: 'Trava de Baixa com Opções (Bear Put Spread)' },
  { symbol: 'SLB', name: 'Schlumberger Limited', sector: 'Energia', category: 'BAIXA', spot: 44.00, change: -1.85, ivRank: 44.0, ivAtm: 30.0, stop: 47.00, alvo1: 39.50, alvo2: 36.00, rr: '1.85:1', strategy: 'Trava de Baixa com Opções (Bear Put Spread)' },

  // LATERAL - Renda com Opções (Iron Condor / Credit Spreads)
  { symbol: 'KO', name: 'The Coca-Cola Company', sector: 'Consumo Básico', category: 'LATERAL', spot: 68.40, change: 0.20, ivRank: 38.0, ivAtm: 13.5, stop: 65.50, alvo1: 71.00, alvo2: 73.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Saúde', category: 'LATERAL', spot: 156.20, change: 0.15, ivRank: 42.0, ivAtm: 14.0, stop: 150.00, alvo1: 162.00, alvo2: 166.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumo Básico', category: 'LATERAL', spot: 172.80, change: 0.32, ivRank: 35.0, ivAtm: 14.2, stop: 166.00, alvo1: 178.00, alvo2: 182.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Saúde', category: 'LATERAL', spot: 27.50, change: 0.40, ivRank: 48.0, ivAtm: 21.0, stop: 25.50, alvo1: 29.50, alvo2: 31.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumo Básico', category: 'LATERAL', spot: 164.50, change: 0.10, ivRank: 36.0, ivAtm: 14.8, stop: 158.00, alvo1: 170.00, alvo2: 174.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'MRK', name: 'Merck & Co. Inc.', sector: 'Saúde', category: 'LATERAL', spot: 104.20, change: 0.25, ivRank: 39.0, ivAtm: 16.2, stop: 99.00, alvo1: 109.00, alvo2: 112.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Saúde', category: 'LATERAL', spot: 182.00, change: 0.30, ivRank: 41.0, ivAtm: 17.5, stop: 175.00, alvo1: 189.00, alvo2: 194.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumo Básico', category: 'LATERAL', spot: 88.60, change: 0.45, ivRank: 31.0, ivAtm: 15.0, stop: 84.50, alvo1: 92.50, alvo2: 95.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'MCD', name: "McDonald's Corporation", sector: 'Consumo Cíclico', category: 'LATERAL', spot: 295.00, change: 0.15, ivRank: 28.0, ivAtm: 14.0, stop: 284.00, alvo1: 305.00, alvo2: 312.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energia', category: 'LATERAL', spot: 118.40, change: 0.35, ivRank: 37.0, ivAtm: 18.0, stop: 112.00, alvo1: 124.00, alvo2: 128.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'CVX', name: 'Chevron Corporation', sector: 'Energia', category: 'LATERAL', spot: 158.00, change: 0.25, ivRank: 36.0, ivAtm: 18.5, stop: 151.00, alvo1: 165.00, alvo2: 170.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'NEE', name: 'NextEra Energy Inc.', sector: 'Utilidades', category: 'LATERAL', spot: 76.00, change: 0.20, ivRank: 29.0, ivAtm: 16.0, stop: 72.50, alvo1: 79.50, alvo2: 82.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'SO', name: 'The Southern Company', sector: 'Utilidades', category: 'LATERAL', spot: 88.00, change: 0.15, ivRank: 28.0, ivAtm: 15.5, stop: 84.00, alvo1: 92.00, alvo2: 95.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'CSCO', name: 'Cisco Systems Inc.', sector: 'Tecnologia', category: 'LATERAL', spot: 58.20, change: 0.30, ivRank: 32.0, ivAtm: 17.0, stop: 55.50, alvo1: 61.00, alvo2: 63.00, rr: 'Iron Condor #20 a Crédito' },
  { symbol: 'TXN', name: 'Texas Instruments', sector: 'Tecnologia', category: 'LATERAL', spot: 205.00, change: 0.40, ivRank: 34.0, ivAtm: 21.0, stop: 196.00, alvo1: 214.00, alvo2: 222.00, rr: 'Iron Condor #20 a Crédito' },
];

export interface CandleDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma20: number;
  ma50: number;
  ma200: number;
  rsi: number;
  macdHist: number;
}

/**
 * Calcula a Média Móvel Exponencial (EMA) canônica de uma série.
 */
export function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = new Array(values.length);

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      sum += values[i];
      ema[i] = sum / (i + 1);
    } else {
      ema[i] = values[i] * k + ema[i - 1] * (1 - k);
    }
  }
  return ema;
}

/**
 * Calcula o RSI canônico de J. Welles Wilder Jr. com suavização exponencial (Modified MA, alpha = 1/period).
 * Não confunde com RSI simples de Cutler.
 */
export function calculateWilderRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50.0);
  if (closes.length <= period) return rsi;

  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(0, diff));
    losses.push(Math.max(0, -diff));
  }

  // Primeiro período (t = period): média simples
  let avgGain = gains.slice(1, period + 1).reduce((acc, v) => acc + v, 0) / period;
  let avgLoss = losses.slice(1, period + 1).reduce((acc, v) => acc + v, 0) / period;

  if (avgLoss === 0) {
    rsi[period] = 100.0;
  } else {
    const rs = avgGain / avgLoss;
    rsi[period] = Number((100 - (100 / (1 + rs))).toFixed(2));
  }

  // Períodos subsequentes: Suavização exponencial de Wilder (avg * 13 + current) / 14
  for (let i = period + 1; i < closes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    if (avgLoss === 0) {
      rsi[i] = 100.0;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = Number((100 - (100 / (1 + rs))).toFixed(2));
    }
  }

  return rsi;
}

/**
 * Calcula o MACD canônico de Gerald Appel (12, 26, 9).
 * MACD Line = EMA(12) - EMA(26)
 * Signal Line = EMA(9) da MACD Line
 * MACD Histogram = MACD Line - Signal Line
 */
export function calculateCanonicalMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const emaFast = calculateEMA(closes, fastPeriod);
  const emaSlow = calculateEMA(closes, slowPeriod);

  const macdLine = emaFast.map((fast, i) => fast - emaSlow[i]);
  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = macdLine.map((m, i) => Number((m - signalLine[i]).toFixed(2)));

  return { macdLine, signalLine, histogram };
}

// Gerador pseudo-aleatório determinístico (LCG) ancorado no símbolo para reprodutibilidade estrita (Achado A-01)
function deterministicPseudoRandom(seedStr: string, index: number): number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin((hash + index * 9301 + 49297) % 233280) * 10000;
  return x - Math.floor(x); // número entre 0 e 1 perfeitamente reproduzível a cada F5
}

export function generateCandlesticks(symbol: string, currentSpot: number, totalPeriods = 90): CandleDataPoint[] {
  const sym = symbol.toUpperCase();
  // Ponto de partida determinado por hash do símbolo, sem constantes mágicas por ticker (REGRA 00 Invariante 7)
  const initialOffset = 0.88 + deterministicPseudoRandom(sym, 0) * 0.24;
  let price = currentSpot * initialOffset;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Math.round(totalPeriods * 1.4));

  interface RawCandle {
    dateStr: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }

  const rawCandles: RawCandle[] = [];
  const closes: number[] = [];

  for (let i = 0; i < totalPeriods; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);

    const isLast = i === totalPeriods - 1;
    const drift = (currentSpot - price) / (totalPeriods - i + 2);

    // Ruído determinístico ancorado no ticker (mesmo dia e ticker geram exatamente a mesma vela)
    const r1 = deterministicPseudoRandom(sym, i * 4 + 1);
    const r2 = deterministicPseudoRandom(sym, i * 4 + 2);
    const r3 = deterministicPseudoRandom(sym, i * 4 + 3);
    const r4 = deterministicPseudoRandom(sym, i * 4 + 4);

    const noise = (r1 - 0.48) * (currentSpot * 0.02);
    const open = isLast ? currentSpot * 0.995 : price;
    const close = isLast ? currentSpot : Math.max(1, open + drift + noise);
    const high = Math.max(open, close) + r2 * (currentSpot * 0.012);
    const low = Math.min(open, close) - r3 * (currentSpot * 0.012);
    const volume = Math.round(15000000 + r4 * 35000000);

    price = close;
    closes.push(close);

    rawCandles.push({
      dateStr: d.toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume,
    });
  }

  // Indicadores canônicos calculados sobre a série integral de fechamentos
  const rsiSeries = calculateWilderRSI(closes, 14);
  const macdSeries = calculateCanonicalMACD(closes, 12, 26, 9);

  return rawCandles.map((c, i) => {
    // Médias Móveis Simples (SMA 20, SMA 50, SMA 200)
    const slice20 = closes.slice(Math.max(0, i - 19), i + 1);
    const ma20 = slice20.reduce((acc, v) => acc + v, 0) / slice20.length;

    const slice50 = closes.slice(Math.max(0, i - 49), i + 1);
    const ma50 = slice50.reduce((acc, v) => acc + v, 0) / slice50.length;

    const slice200 = closes.slice(Math.max(0, i - 199), i + 1);
    const ma200 = slice200.reduce((acc, v) => acc + v, 0) / slice200.length;

    return {
      date: c.dateStr,
      open: Number(c.open.toFixed(2)),
      high: Number(c.high.toFixed(2)),
      low: Number(c.low.toFixed(2)),
      close: Number(c.close.toFixed(2)),
      volume: c.volume,
      ma20: Number(ma20.toFixed(2)),
      ma50: Number(ma50.toFixed(2)),
      ma200: Number(ma200.toFixed(2)),
      rsi: Number(rsiSeries[i].toFixed(1)),
      macdHist: Number(macdSeries.histogram[i].toFixed(2)),
    };
  });
}

