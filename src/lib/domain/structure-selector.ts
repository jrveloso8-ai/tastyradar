/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * SELEÇÃO DE ESTRUTURA DETERMINÍSTICA (Função Pura, sem I/O)
 *
 * Seleção de Estrutura V1 (Caso B — Sem catalisador de data fixa):
 * 1. Default do Sistema: STRANGLE (calls e puts OTM).
 *    Justificativa: Pernas fora do dinheiro (OTM) exigem menor desembolso de débito inicial e
 *    reduzem o decaimento absoluto de theta pago em comparação a um Straddle ATM.
 * 2. Seleção de Strikes:
 *    - Call OTM: primeiro strike imediatamente superior ao spot price (OTM).
 *    - Put OTM: primeiro strike imediatamente inferior ao spot price (OTM).
 * 3. Validação de Liquidez por Perna:
 *    - Cada perna é submetida ao filtro de spread relativo (<= 10%) e Open Interest mínimo (>= 250 contratos OTM).
 *    - Se qualquer perna falhar, o candidato é descartado.
 * 4. Motivo Auditável: Cada decisão carrega a justificativa determinística registrada no output.
 */

import {
  Layer2Output,
  OptionLegLiquidity,
  ScreenerRejectionCode,
  StrategySelectionResult,
} from '../types/low-vol-screener.types';
import { combineProvenance } from '../types/provenance';
import { calculateBsm } from './bsm-pricer';
import { evaluateLegLiquidity, LiquidityFilterConfig } from './liquidity-filter';

export const DEFAULT_TARGET_DELTA = 0.25;
export const DEFAULT_RISK_FREE_RATE = 0.045;

export interface ChainStrikeQuote {
  strike: number;
  callSymbol: string;
  putSymbol: string;
  callBid: number | null;
  callAsk: number | null;
  callOi: number;
  putBid: number | null;
  putAsk: number | null;
  putOi: number;
}

export interface StrangleSelectionInput {
  layer2Candidate: Layer2Output;
  spotPrice: number;
  strikes: ChainStrikeQuote[];
  liquidityConfig?: LiquidityFilterConfig;
  targetDelta?: number; // default 0.25 (25 Delta)
  riskFreeRate?: number; // default 0.045
}

export interface StrangleSelectionOutput {
  success: boolean;
  strategy?: StrategySelectionResult;
  rejectionCode?: ScreenerRejectionCode;
  rejectionReason?: string;
  callLeg?: OptionLegLiquidity;
  putLeg?: OptionLegLiquidity;
}

/**
 * Seleciona a estrutura Strangle OTM determinística para o candidato do Caso B ancorada no delta-alvo.
 */
export function selectStrangleStructure(input: StrangleSelectionInput): StrangleSelectionOutput {
  const { layer2Candidate, spotPrice, strikes, liquidityConfig } = input;
  const targetDelta = input.targetDelta ?? DEFAULT_TARGET_DELTA;
  const riskFreeRate = input.riskFreeRate ?? DEFAULT_RISK_FREE_RATE;

  if (!layer2Candidate.passesIvFilter) {
    return {
      success: false,
      rejectionCode: layer2Candidate.rejectionCode,
      rejectionReason: layer2Candidate.rejectionReason,
    };
  }

  if (spotPrice <= 0 || !strikes || strikes.length < 2) {
    return {
      success: false,
      rejectionCode: 'API_FAILURE',
      rejectionReason: 'Grade de strikes insuficiente para seleção de Strangle OTM',
    };
  }

  const dte = layer2Candidate.selectedExpiration?.dte;
  if (!dte || dte <= 0 || !Number.isFinite(dte)) {
    return {
      success: false,
      rejectionCode: 'NO_VALID_EXPIRATION_CYCLE',
      rejectionReason: 'DTE do vencimento selecionado inválido ou menor ou igual a zero',
    };
  }
  const timeToExpiry = dte / 365;

  // IV anualizada em decimal (ex: 28% -> 0.28). Zero proxies ou fallbacks permitidos pela Regra 00.
  const rawIv = layer2Candidate.atmIv?.value;
  if (
    !layer2Candidate.atmIv ||
    layer2Candidate.atmIv.provenance !== 'MEDIDO' ||
    typeof rawIv !== 'number' ||
    !Number.isFinite(rawIv) ||
    rawIv <= 0
  ) {
    return {
      success: false,
      rejectionCode: 'IV_HISTORY_UNAVAILABLE',
      rejectionReason: 'IV ATM não disponível ou não medida na corretora (proxy proibido pela Regra 00)',
    };
  }
  const volatility = rawIv > 1.5 ? rawIv / 100 : rawIv;

  // Ordena a grade de strikes por valor crescente
  const sortedStrikes = [...strikes].sort((a, b) => a.strike - b.strike);

  // 1. Identifica os strikes Call estritamente OTM (strike > spot) e calcula seus deltas BSM
  const callCandidates = sortedStrikes
    .filter(s => s.strike > spotPrice)
    .map(s => {
      const greeks = calculateBsm(spotPrice, s.strike, timeToExpiry, volatility, riskFreeRate, 'CALL');
      const delta = greeks.delta;
      const deltaDistance = Math.abs(delta - targetDelta);
      return { strikeQuote: s, delta, deltaDistance };
    });

  // 2. Identifica os strikes Put estritamente OTM (strike < spot) e calcula seus deltas BSM
  const putCandidates = sortedStrikes
    .filter(s => s.strike < spotPrice)
    .map(s => {
      const greeks = calculateBsm(spotPrice, s.strike, timeToExpiry, volatility, riskFreeRate, 'PUT');
      const delta = greeks.delta;
      const absDelta = Math.abs(delta);
      const deltaDistance = Math.abs(absDelta - targetDelta);
      return { strikeQuote: s, delta, absDelta, deltaDistance };
    });

  if (callCandidates.length === 0 || putCandidates.length === 0) {
    return {
      success: false,
      rejectionCode: 'API_FAILURE',
      rejectionReason: `Strikes OTM insuficientes ao redor do spot $${spotPrice.toFixed(2)}`,
    };
  }

  // 3. Seleção da Call: mais próxima de targetDelta (0.25).
  // Desempate determinístico: se distâncias iguais, escolhe o menor delta (mais OTM)
  callCandidates.sort((a, b) => {
    const diffDist = a.deltaDistance - b.deltaDistance;
    if (Math.abs(diffDist) > 1e-6) return diffDist;
    return a.delta - b.delta; // Menor delta = mais OTM
  });
  const bestCall = callCandidates[0];
  const selectedCallStrike = bestCall.strikeQuote;

  // 4. Seleção da Put: mais próxima de targetDelta (|delta| ~ 0.25).
  // Desempate determinístico: se distâncias iguais, escolhe o menor |delta| (mais OTM)
  putCandidates.sort((a, b) => {
    const diffDist = a.deltaDistance - b.deltaDistance;
    if (Math.abs(diffDist) > 1e-6) return diffDist;
    return a.absDelta - b.absDelta; // Menor |delta| = mais OTM
  });
  const bestPut = putCandidates[0];
  const selectedPutStrike = bestPut.strikeQuote;

  // 3. Avalia liquidez da perna Call OTM
  const callEval = evaluateLegLiquidity(
    {
      symbol: selectedCallStrike.callSymbol,
      strike: selectedCallStrike.strike,
      optionType: 'CALL',
      isAtm: false, // Perna OTM exige OI >= 250
      bid: selectedCallStrike.callBid,
      ask: selectedCallStrike.callAsk,
      openInterest: selectedCallStrike.callOi,
    },
    liquidityConfig
  );

  // 4. Avalia liquidez da perna Put OTM
  const putEval = evaluateLegLiquidity(
    {
      symbol: selectedPutStrike.putSymbol,
      strike: selectedPutStrike.strike,
      optionType: 'PUT',
      isAtm: false, // Perna OTM exige OI >= 250
      bid: selectedPutStrike.putBid,
      ask: selectedPutStrike.putAsk,
      openInterest: selectedPutStrike.putOi,
    },
    liquidityConfig
  );

  // 5. Se qualquer perna falhar na liquidez, rejeita
  if (!callEval.leg.passesLiquidity) {
    return {
      success: false,
      callLeg: callEval.leg,
      putLeg: putEval.leg,
      rejectionCode: callEval.rejectionCode,
      rejectionReason: `Perna Call OTM rejeitada na liquidez: ${callEval.rejectionReason}`,
    };
  }

  if (!putEval.leg.passesLiquidity) {
    return {
      success: false,
      callLeg: callEval.leg,
      putLeg: putEval.leg,
      rejectionCode: putEval.rejectionCode,
      rejectionReason: `Perna Put OTM rejeitada na liquidez: ${putEval.rejectionReason}`,
    };
  }

  // 6. Contágio de Proveniência: combina a proveniência do vencimento e das duas pernas
  const finalProvenance = combineProvenance([
    layer2Candidate.selectedExpiration.provenance,
    callEval.leg.provenance,
    putEval.leg.provenance,
  ]);

  const callLegWithAction: OptionLegLiquidity = {
    ...callEval.leg,
    action: 'BUY',
    delta: {
      value: Number(bestCall.delta.toFixed(3)),
      provenance: 'DERIVADO',
      source: 'black-scholes-merton-delta',
    },
  };

  const putLegWithAction: OptionLegLiquidity = {
    ...putEval.leg,
    action: 'BUY',
    delta: {
      value: Number(bestPut.delta.toFixed(3)),
      provenance: 'DERIVADO',
      source: 'black-scholes-merton-delta',
    },
  };

  const callMid = callLegWithAction.mid;
  const putMid = putLegWithAction.mid;
  const totalDebitMid =
    callMid !== null && putMid !== null
      ? Number((callMid + putMid).toFixed(2))
      : 0;

  const deterministicReason =
    'STRANGLE default eleito: candidato em squeeze de volatilidade sem catalisador iminente de curto prazo (Caso B, DTE 30-45d), selecionado por delta-alvo 25 (OTM), priorizando convexidade e menor custo de débito/theta relativo com pernas OTM';

  const strategy: StrategySelectionResult = {
    structureType: 'STRANGLE',
    positionDirection: 'LONG',
    totalDebitMid,
    symbol: layer2Candidate.symbol,
    expiration: layer2Candidate.selectedExpiration,
    callLeg: callLegWithAction,
    putLeg: putLegWithAction,
    deterministicReason,
    provenance: finalProvenance,
    source: 'strangle-structure-selector-v1',
  };

  return {
    success: true,
    strategy,
    callLeg: callLegWithAction,
    putLeg: putLegWithAction,
  };
}
