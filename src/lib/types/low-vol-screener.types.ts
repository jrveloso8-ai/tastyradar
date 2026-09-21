/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * Contratos de tipos e DTOs para o módulo:
 * Screening de Volatilidade Baixa + Seleção de Estrutura (Straddle/Strangle)
 *
 * Todos os valores analíticos e métricas carregam explicitamente:
 * - value: T
 * - provenance: ProvenanceBadge (MEDIDO | DERIVADO | ESTIMADO | SIMULADO | INDISPONIVEL)
 * - source: string (identificação auditável da fonte ou da fórmula)
 */

import { ProvenanceBadge, ProvenanceValue } from './provenance';

/**
 * Representa uma barra diária OHLCV de mercado (Fonte: Tastytrade DXLink WebSocket evento Candle).
 */
export interface OHLCVBar {
  date: string;       // ISO YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Ativo candidato com sua série diária e dados cadastrais.
 */
export interface ScreenerCandidateInput {
  symbol: string;
  sector: string; // Setor GICS (ex.: Technology, Healthcare)
  bars: OHLCVBar[]; // Série histórica (~252 barras diárias)
  barsProvenance: ProvenanceBadge; // Esperado: MEDIDO
  barsSource: string; // Esperado: "tastytrade-dxlink-candles"
  spotPrice?: number; // Cotação spot atual se disponível diretamente (opcional)
}

export type ScreenerRejectionCode =
  | 'INSUFFICIENT_HISTORY'
  | 'PRICE_ABOVE_THRESHOLD'
  | 'HV_PERCENTILE_FAIL'
  | 'STABILITY_FAIL'
  | 'SECTOR_QUOTA_FAIL'
  | 'BBW_SQUEEZE_FAIL'
  | 'NO_VALID_EXPIRATION_CYCLE'
  | 'IV_FILTER_FAIL'
  | 'IV_HISTORY_UNAVAILABLE'
  | 'IV_UNAVAILABLE'
  | 'LIQUIDITY_SPREAD_FAIL'
  | 'LIQUIDITY_OI_FAIL'
  | 'INVALID_BAR_DATA'
  | 'CANDLE_STREAM_TIMEOUT'
  | 'CANDLE_STREAM_INCOMPLETE'
  | 'API_FAILURE';

/**
 * Output da Camada 0: Filtro Estrutural de Volatilidade Histórica.
 */
export interface Layer0Output {
  symbol: string;
  sector: string;
  spotPrice?: ProvenanceValue<number>; // Preço spot avaliado no filtro
  passesPriceThreshold?: boolean; // true se spot < maxSpotPrice (default 100)
  hv12m: ProvenanceValue<number>; // HV anualizado Garman-Klass / Parkinson (em %)
  hv12mTrimmed: ProvenanceValue<number>; // HV recalculado excluindo os 5% maiores retornos absolutos
  hvDropRatio: ProvenanceValue<number>; // (hv12m - hv12mTrimmed) / hv12m
  hv12mPercentile: ProvenanceValue<number>; // Percentil no universo analisado (0 a 100)
  passesHvPercentile: boolean; // true se hv12mPercentile >= 65
  passesStability: boolean; // true se hvDropRatio <= 0.40 (queda <= 40%)
  sectorQuotaApproved: boolean; // true se respeitou teto setorial ceil(0.25 * N)
  rejectionCode?: ScreenerRejectionCode;
  rejectionReason?: string;
}

/**
 * Output da Camada 1: Squeeze de Bollinger Band Width.
 */
export interface Layer1Output extends Layer0Output {
  bbwCurrent: ProvenanceValue<number>; // BBW atual: (Upper - Lower) / SMA * 100
  bbwHistoryPercentile: ProvenanceValue<number>; // Posição percentil na série histórica própria (0 a 100)
  passesSqueeze: boolean; // true se bbwHistoryPercentile <= 15
}

/**
 * Informações de catalisador de eventos (Earnings).
 * A proveniência é estrita:
 * - Se a empresa já confirmou oficialmente a data: MEDIDO
 * - Se a data for projeção/estimativa da corretora/vendor: ESTIMADO
 * - Se a consulta falhou na API: INDISPONIVEL
 * - Se a API respondeu mas não há evento previsto: catalisador ausente (hasCatalyst = false, provenance = MEDIDO/ESTIMADO conforme fonte)
 */
export interface CatalystEvent {
  hasCatalyst: boolean;
  expectedDate?: string; // YYYY-MM-DD
  isConfirmed: boolean; // true se confirmed (MEDIDO), false se estimated (ESTIMADO)
  daysUntilEvent?: number; // dias corridos até o evento
  businessDaysUntilEvent?: number; // dias úteis até o evento
  provenance: ProvenanceBadge;
  source: string;
}

/**
 * Vencimento selecionado deterministicamente para o candidato.
 */
export interface SelectedExpiration {
  expirationDate: string; // YYYY-MM-DD
  dte: number; // Days to Expiration
  selectionRule: 'CASO_A_CATALISADOR' | 'CASO_B_SQUEEZE_GERAL';
  bufferDaysApplied: number; // 7 dias corridos no Caso A
  isMonthlyStandard: boolean;
  provenance: ProvenanceBadge; // Herda ESTIMADO se o catalisador foi ESTIMADO
  source: string;
}

/**
 * Output da Camada 2: Confirmação por IV Rank / IV Percentile.
 */
export interface Layer2Output extends Layer1Output {
  selectedExpiration: SelectedExpiration;
  atmIv: ProvenanceValue<number>; // IV ATM ancorado ao vencimento selecionado
  ivRank: ProvenanceValue<number>; // IV Rank ancorado (52 semanas / 252 dias)
  ivPercentile: ProvenanceValue<number>; // IV Percentile ancorado (252 dias)
  passesIvFilter: boolean; // true se ivRank <= 30 AND ivPercentile <= 30
}

/**
 * Métrica de liquidez de uma perna individual de opção.
 */
export interface OptionLegLiquidity {
  symbol: string;
  strike: number;
  optionType: 'CALL' | 'PUT';
  action?: 'BUY' | 'SELL'; // Direção da perna individual (default BUY para Long Strangle)
  isAtm: boolean;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  relativeSpread: number | null; // (ask - bid) / mid
  openInterest: number | null; // null = OI nao obtido da fonte (nunca 0/constante)
  delta?: ProvenanceValue<number>; // Delta BSM da perna (ex: +0.25 para Call, -0.25 para Put)
  passesLiquidity: boolean;
  rejectionReason?: string;
  provenance: ProvenanceBadge;
  source: string;
}

/**
 * Output da Camada 3: Filtro de Catalisador e Liquidez.
 */
export interface Layer3Output extends Layer2Output {
  catalyst: CatalystEvent;
  isSpeculativeNoCatalyst: boolean; // true se passou nas camadas 0, 1 e 2 mas não possui catalisador com folga
  callLeg: OptionLegLiquidity;
  putLeg: OptionLegLiquidity;
  passesLiquidityFilter: boolean; // true se ambas as pernas cumprem spread <= 10% e OI (>=500 ATM, >=250 OTM)
}

/**
 * Estrutura eleita de opções sugerida (Straddle vs Strangle).
 */
export type StrategyStructureType = 'STRADDLE' | 'STRANGLE';

export interface StrategySelectionResult {
  structureType: StrategyStructureType;
  positionDirection: 'LONG'; // Direção explícita: compra de volatilidade (posição de DÉBITO)
  totalDebitMid: number; // Custo teórico de entrada (soma dos mids das pernas compradas)
  symbol: string;
  expiration: SelectedExpiration;
  callLeg: OptionLegLiquidity;
  putLeg: OptionLegLiquidity;
  deterministicReason: string; // Justificativa auditável da regra disparada
  provenance: ProvenanceBadge; // Contágio de todas as pernas, vencimento e insumos
  source: string;
}

/**
 * Status do candidato no Funil de 4 Camadas.
 */
export type ScreenerCandidateStatus = 'APPROVED_FOR_EXECUTION' | 'SPECULATIVE_NO_CATALYST' | 'REJECTED';

/**
 * Estágio de rejeição do funil.
 */
export type ScreenerRejectionStage = 'LAYER_0' | 'LAYER_1' | 'LAYER_2' | 'LAYER_3_LIQUIDITY' | 'API_FAILURE';

/**
 * Resultado completo do candidato no Funil de 4 Camadas.
 */
export interface ScreenerFullCandidateResult {
  candidate: ScreenerCandidateInput;
  layer0: Layer0Output;
  layer1?: Layer1Output;
  layer2?: Layer2Output;
  layer3?: Layer3Output;
  strategy?: StrategySelectionResult;
  status: ScreenerCandidateStatus;
  rejectionStage?: ScreenerRejectionStage;
  rejectionReason?: string;
}
