/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * NORMALIZADOR SETORIAL CENTRALIZADO (Padrão Oficial GICS + Agrupamento ETF)
 *
 * Elimina duplicações de idioma (ex.: Saúde vs Healthcare, Tecnologia vs Technology)
 * e reclassifica sub-indústrias para os 11 setores oficiais do Global Industry
 * Classification Standard (GICS) em inglês, mais o agrupamento dedicado "ETF".
 */

export type GicsSector =
  | 'Information Technology'
  | 'Health Care'
  | 'Financials'
  | 'Consumer Discretionary'
  | 'Consumer Staples'
  | 'Communication Services'
  | 'Industrials'
  | 'Energy'
  | 'Utilities'
  | 'Materials'
  | 'Real Estate'
  | 'ETF';

/**
 * Mapa determinístico de classificação setorial por símbolo.
 * Garante que ambos os catálogos (SP500_DATASET e US_STOCKS_DATASET)
 * convirjam para a mesma taxonomia antes da aplicação da cota setorial.
 */
export const TICKER_GICS_MAPPING: Record<string, GicsSector> = {
  // 1. Information Technology (inclui Semicondutores, Software, Hardware e Serviços)
  AAPL: 'Information Technology',
  MSFT: 'Information Technology',
  NVDA: 'Information Technology',
  AMD: 'Information Technology',
  INTC: 'Information Technology',
  MU: 'Information Technology',
  AVGO: 'Information Technology',
  QCOM: 'Information Technology',
  TXN: 'Information Technology',
  AMAT: 'Information Technology',
  LRCX: 'Information Technology',
  CSCO: 'Information Technology',
  ORCL: 'Information Technology',
  CRM: 'Information Technology',
  NOW: 'Information Technology',
  PANW: 'Information Technology',
  CRWD: 'Information Technology',
  PLTR: 'Information Technology',
  SHOP: 'Information Technology',
  UBER: 'Information Technology',

  // 2. Health Care (inclui Farmacêuticas, Biotecnologia e Dispositivos Médicos)
  JNJ: 'Health Care',
  PFE: 'Health Care',
  MRK: 'Health Care',
  ABBV: 'Health Care',
  LLY: 'Health Care',
  BMY: 'Health Care',
  UNH: 'Health Care',
  CVS: 'Health Care',
  ISRG: 'Health Care',
  SYK: 'Health Care',
  BSX: 'Health Care',

  // 3. Financials (inclui Bancos Comerciais/Investimento, Corretoras e Meios de Pagamento)
  JPM: 'Financials',
  BAC: 'Financials',
  WFC: 'Financials',
  GS: 'Financials',
  MS: 'Financials',
  BLK: 'Financials',
  AXP: 'Financials',
  V: 'Financials',
  MA: 'Financials',
  PYPL: 'Financials',
  COIN: 'Financials',
  HOOD: 'Financials',
  SOFI: 'Financials',

  // 4. Consumer Discretionary (inclui E-commerce, Automóveis, Restaurantes e Varejo Cíclico)
  AMZN: 'Consumer Discretionary',
  TSLA: 'Consumer Discretionary',
  F: 'Consumer Discretionary',
  GM: 'Consumer Discretionary',
  RIVN: 'Consumer Discretionary',
  MCD: 'Consumer Discretionary',
  NKE: 'Consumer Discretionary',
  CCL: 'Consumer Discretionary',

  // 5. Consumer Staples (inclui Alimentos, Bebidas, Tabaco e Varejo Básico)
  PG: 'Consumer Staples',
  KO: 'Consumer Staples',
  PEP: 'Consumer Staples',
  WMT: 'Consumer Staples',
  TGT: 'Consumer Staples',

  // 6. Communication Services (inclui Mídia, Redes Sociais, Streaming e Telecomunicações)
  GOOGL: 'Communication Services',
  META: 'Communication Services',
  NFLX: 'Communication Services',
  WBD: 'Communication Services',
  T: 'Communication Services',
  VZ: 'Communication Services',

  // 7. Industrials (inclui Aeroespacial, Defesa, Logística e Maquinário Pesado)
  CAT: 'Industrials',
  GE: 'Industrials',
  BA: 'Industrials',
  RTX: 'Industrials',
  LMT: 'Industrials',
  ETN: 'Industrials',
  UPS: 'Industrials',
  AAL: 'Industrials',

  // 8. Energy (inclui Exploração, Refino e Serviços Petrolíferos)
  XOM: 'Energy',
  CVX: 'Energy',
  SLB: 'Energy',

  // 9. Utilities (inclui Geração, Distribuição de Energia e Saneamento)
  NEE: 'Utilities',
  SO: 'Utilities',

  // 10. Materials (inclui Mineração e Químicos Básicos)
  VALE: 'Materials',

  // 11. Real Estate (fundos imobiliários e REITs corporativos)
  PLD: 'Real Estate',
  LIN: 'Materials',

  // 12. ETF (Agrupamento próprio sujeito ao mesmo teto setorial)
  SPY: 'ETF',
  QQQ: 'ETF',
  IWM: 'ETF',
};

/**
 * Normaliza o setor de um ativo com base no seu símbolo ou mapeamento fallback de string.
 */
export function normalizeSector(symbol: string, rawSector?: string): GicsSector {
  const sym = symbol.toUpperCase().trim();
  if (TICKER_GICS_MAPPING[sym]) {
    return TICKER_GICS_MAPPING[sym];
  }

  // Fallbacks de tradução caso apareça um símbolo fora da tabela estrita
  if (!rawSector) return 'Information Technology';
  const s = rawSector.toLowerCase().trim();

  if (s.includes('etf')) return 'ETF';
  if (s.includes('saúde') || s.includes('health')) return 'Health Care';
  if (s.includes('tecnologia') || s.includes('tech') || s.includes('semiconductor') || s.includes('software')) return 'Information Technology';
  if (s.includes('finance') || s.includes('banco')) return 'Financials';
  if (s.includes('cíclico') || s.includes('discretionary') || s.includes('automóveis') || s.includes('restaurante')) return 'Consumer Discretionary';
  if (s.includes('básico') || s.includes('staples')) return 'Consumer Staples';
  if (s.includes('comunicação') || s.includes('communication') || s.includes('telecom')) return 'Communication Services';
  if (s.includes('industrial') || s.includes('industrials') || s.includes('aeroespacial') || s.includes('transporte')) return 'Industrials';
  if (s.includes('energy') || s.includes('energia') || s.includes('petróleo')) return 'Energy';
  if (s.includes('utilit') || s.includes('utilities') || s.includes('elétrica')) return 'Utilities';
  if (s.includes('material') || s.includes('materials') || s.includes('mineração')) return 'Materials';
  if (s.includes('real estate') || s.includes('imobiliário')) return 'Real Estate';

  return 'Information Technology';
}
