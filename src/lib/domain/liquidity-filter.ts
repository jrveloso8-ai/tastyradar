/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * FILTROS DE LIQUIDEZ (Função Pura, sem I/O)
 *
 * Aplicado ao vencimento selecionado para cada perna de opção da estrutura candidata:
 * 1. Spread Relativo Máximo por Perna:
 *    mid = (ask + bid) / 2
 *    relativeSpread = (ask - bid) / mid
 *    Critério: relativeSpread <= 10.0% (0.10) em precisão completa.
 *
 * 2. Open Interest Mínimo Diferenciado:
 *    - Pernas ATM (usadas em Straddle): OI >= 500 contratos.
 *    - Pernas OTM (usadas em Strangle): OI >= 250 contratos.
 *    Justificativa: strikes OTM carregam liquidez estruturalmente menor; travar 500 para ambos
 *    eliminaria o funil de Strangle sem ganho real de segurança.
 *
 * 3. Se qualquer perna falhar, o candidato é descartado antes de qualquer sugestão de execução.
 */

import { OptionLegLiquidity, ScreenerRejectionCode } from '../types/low-vol-screener.types';

export interface LegEvaluationInput {
  symbol: string;
  strike: number;
  optionType: 'CALL' | 'PUT';
  isAtm: boolean;
  bid: number | null | undefined;
  ask: number | null | undefined;
  openInterest: number | null | undefined;
  source?: string;
}

export interface LiquidityFilterConfig {
  maxRelativeSpread?: number; // default 0.10 (10%)
  minOiAtm?: number; // default 500
  minOiOtm?: number; // default 250
}

export const DEFAULT_LIQUIDITY_CONFIG: Required<LiquidityFilterConfig> = {
  maxRelativeSpread: 0.10,
  minOiAtm: 500,
  minOiOtm: 250,
};

export interface LegEvaluationResult {
  leg: OptionLegLiquidity;
  rejectionCode?: ScreenerRejectionCode;
  rejectionReason?: string;
}

/**
 * Avalia a liquidez determinística de uma perna individual de opção.
 */
export function evaluateLegLiquidity(
  input: LegEvaluationInput,
  config: LiquidityFilterConfig = {}
): LegEvaluationResult {
  const cfg = { ...DEFAULT_LIQUIDITY_CONFIG, ...config };

  const { symbol, strike, optionType, isAtm, bid, ask, openInterest } = input;
  const hasSource = Boolean(input.source && input.source.trim().length > 0);
  const source = hasSource ? input.source! : 'fonte-nao-informada';

  // 1. Validação de presença e integridade de cotação
  if (
    bid === null ||
    bid === undefined ||
    ask === null ||
    ask === undefined ||
    !Number.isFinite(bid) ||
    !Number.isFinite(ask)
  ) {
    const leg: OptionLegLiquidity = {
      symbol,
      strike,
      optionType,
      isAtm,
      bid: bid ?? null,
      ask: ask ?? null,
      mid: null,
      relativeSpread: null,
      openInterest: openInterest ?? null,
      passesLiquidity: false,
      rejectionReason: 'Cotação de bid/ask ausente na corretora',
      provenance: 'INDISPONIVEL',
      source,
    };
    return {
      leg,
      rejectionCode: 'LIQUIDITY_SPREAD_FAIL',
      rejectionReason: leg.rejectionReason,
    };
  }

  // Open Interest ausente: sem ele a liquidez nao e verificavel. Nunca assume constante.
  if (openInterest === null || openInterest === undefined || !Number.isFinite(openInterest)) {
    const leg: OptionLegLiquidity = {
      symbol,
      strike,
      optionType,
      isAtm,
      bid,
      ask,
      mid: null,
      relativeSpread: null,
      openInterest: null,
      passesLiquidity: false,
      rejectionReason: 'Open Interest ausente na fonte (liquidez nao verificavel)',
      provenance: 'INDISPONIVEL',
      source,
    };
    return {
      leg,
      rejectionCode: 'LIQUIDITY_OI_FAIL',
      rejectionReason: leg.rejectionReason,
    };
  }

  if (bid < 0 || ask < 0 || ask < bid) {
    const leg: OptionLegLiquidity = {
      symbol,
      strike,
      optionType,
      isAtm,
      bid,
      ask,
      mid: null,
      relativeSpread: null,
      openInterest,
      passesLiquidity: false,
      rejectionReason: `Cotação de spread inconsistente (bid: ${bid}, ask: ${ask})`,
      provenance: 'INDISPONIVEL',
      source,
    };
    return {
      leg,
      rejectionCode: 'LIQUIDITY_SPREAD_FAIL',
      rejectionReason: leg.rejectionReason,
    };
  }

  const mid = (ask + bid) / 2;
  if (mid <= 0) {
    const leg: OptionLegLiquidity = {
      symbol,
      strike,
      optionType,
      isAtm,
      bid,
      ask,
      mid: null,
      relativeSpread: null,
      openInterest,
      passesLiquidity: false,
      rejectionReason: 'Preço médio (mid) menor ou igual a zero',
      provenance: 'INDISPONIVEL',
      source,
    };
    return {
      leg,
      rejectionCode: 'LIQUIDITY_SPREAD_FAIL',
      rejectionReason: leg.rejectionReason,
    };
  }

  // 2. Spread Relativo em precisão completa: (ask - bid) / mid
  const relativeSpread = (ask - bid) / mid;
  const passesSpread = relativeSpread <= cfg.maxRelativeSpread;

  // 3. Open Interest mínimo diferenciado (ATM vs OTM)
  const minRequiredOi = isAtm ? cfg.minOiAtm : cfg.minOiOtm;
  const passesOi = openInterest >= minRequiredOi;

  let passesLiquidity = passesSpread && passesOi && hasSource;

  let rejectionCode: ScreenerRejectionCode | undefined;
  let rejectionReason: string | undefined;

  if (!passesSpread && !passesOi) {
    rejectionCode = 'LIQUIDITY_SPREAD_FAIL';
    rejectionReason = `Spread relativo de ${(relativeSpread * 100).toFixed(2)}% (> ${(cfg.maxRelativeSpread * 100).toFixed(0)}%) e Open Interest de ${openInterest} (< ${minRequiredOi}) para ${optionType} ${strike}`;
  } else if (!passesSpread) {
    rejectionCode = 'LIQUIDITY_SPREAD_FAIL';
    rejectionReason = `Spread relativo de ${(relativeSpread * 100).toFixed(2)}% acima do teto de ${(cfg.maxRelativeSpread * 100).toFixed(0)}% para ${optionType} ${strike}`;
  } else if (!passesOi) {
    rejectionCode = 'LIQUIDITY_OI_FAIL';
    rejectionReason = `Open Interest de ${openInterest} contratos abaixo do mínimo de ${minRequiredOi} (${isAtm ? 'ATM' : 'OTM'}) para ${optionType} ${strike}`;
  } else if (!hasSource) {
    rejectionCode = 'LIQUIDITY_SPREAD_FAIL';
    rejectionReason = 'Fonte de cotação não informada (rastreabilidade obrigatória pela Regra 00)';
  }

  const leg: OptionLegLiquidity = {
    symbol,
    strike,
    optionType,
    isAtm,
    bid,
    ask,
    mid: Number(mid.toFixed(4)),
    relativeSpread: Number(relativeSpread.toFixed(4)),
    openInterest,
    passesLiquidity,
    rejectionReason,
    provenance: hasSource ? 'MEDIDO' : 'INDISPONIVEL',
    source,
  };

  return {
    leg,
    rejectionCode,
    rejectionReason,
  };
}
