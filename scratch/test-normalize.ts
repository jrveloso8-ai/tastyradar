import { SP500_DATASET } from '../src/lib/domain/sp500-dataset';
import { US_STOCKS_DATASET } from '../src/lib/domain/us-market-data';

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

// Tabela de mapeamento determinístico por ticker para garantir 100% de conformidade com os 11 setores GICS + ETF
export const TICKER_GICS_MAPPING: Record<string, GicsSector> = {
  // 1. Information Technology (inclui Semiconductors, Hardware, Software, IT Services)
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

  // 2. Health Care (inclui Pharma, Biotech, Medical Devices, Managed Care)
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

  // 3. Financials (inclui Bancos, Pagamentos, Corretoras, Asset Managers)
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

  // 4. Consumer Discretionary (inclui E-commerce, Automóveis, Restaurantes, Viagens/Varejo)
  AMZN: 'Consumer Discretionary',
  TSLA: 'Consumer Discretionary',
  F: 'Consumer Discretionary',
  GM: 'Consumer Discretionary',
  RIVN: 'Consumer Discretionary',
  MCD: 'Consumer Discretionary',
  NKE: 'Consumer Discretionary',
  CCL: 'Consumer Discretionary',

  // 5. Consumer Staples (inclui Alimentos, Bebidas, Higiene, Varejo Básico)
  PG: 'Consumer Staples',
  KO: 'Consumer Staples',
  PEP: 'Consumer Staples',
  WMT: 'Consumer Staples',
  TGT: 'Consumer Staples',

  // 6. Communication Services (inclui Mídia, Redes Sociais, Telecomunicações, Entretenimento)
  GOOGL: 'Communication Services',
  META: 'Communication Services',
  NFLX: 'Communication Services',
  WBD: 'Communication Services',
  T: 'Communication Services',
  VZ: 'Communication Services',

  // 7. Industrials (inclui Aeroespacial, Defesa, Transporte, Maquinário)
  CAT: 'Industrials',
  GE: 'Industrials',
  BA: 'Industrials',
  RTX: 'Industrials',
  LMT: 'Industrials',
  ETN: 'Industrials',
  UPS: 'Industrials',
  AAL: 'Industrials',

  // 8. Energy (inclui Petróleo, Gás, Serviços de Energia)
  XOM: 'Energy',
  CVX: 'Energy',
  SLB: 'Energy',

  // 9. Utilities (inclui Energia Elétrica, Renováveis, Saneamento)
  NEE: 'Utilities',
  SO: 'Utilities',

  // 10. Materials (inclui Mineração, Químicos)
  VALE: 'Materials',

  // 11. Real Estate (se houver, ex: PLD se estivesse no universo)
  // (Nenhum ticker dos 80 é Real Estate)

  // 12. ETF (Agrupamento setorial próprio com o mesmo teto setorial)
  SPY: 'ETF',
  QQQ: 'ETF',
  IWM: 'ETF',
};

// Verifica se todos os 80 tickers estão mapeados
import { CURATED_80_UNIVERSE } from '../scripts/run-shadow-screener';

console.log('=== TESTE DE MAPEAMENTO SETORIAL GICS ===');
let missing = 0;
for (const item of CURATED_80_UNIVERSE) {
  if (!TICKER_GICS_MAPPING[item.symbol]) {
    console.error(`FALTANDO: ${item.symbol}`);
    missing++;
  }
}
console.log(`Total de tickers analisados: ${CURATED_80_UNIVERSE.length}`);
console.log(`Faltando no mapa: ${missing}`);

// Agrupamento por setor
const sectorGroups = new Map<GicsSector, string[]>();
for (const item of CURATED_80_UNIVERSE) {
  const normSector = TICKER_GICS_MAPPING[item.symbol];
  const list = sectorGroups.get(normSector) || [];
  list.push(item.symbol);
  sectorGroups.set(normSector, list);
}

console.log('\n=== DISTRIBUIÇÃO DOS 80 TICKERS POR SETOR NORMALIZADO ===');
for (const [sec, list] of sectorGroups.entries()) {
  console.log(`\nSetor: ${sec} (${list.length} ativos)`);
  console.log(`Tickers: ${list.sort().join(', ')}`);
}
