/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * ORQUESTRADOR DO FUNIL V1 (Função Pura, sem I/O)
 *
 * Integração determinística das camadas funcionais do V1:
 * Camada 0: Filtro Estrutural de Volatilidade Histórica (Garman-Klass, Winsorização 5%, Teto Setorial)
 * Camada 1: Squeeze de Bollinger Band Width (BBW(20, 2) <= 15% na série própria)
 * Camada 2: Confirmação por IVR e IVP <= 30.0 (em precisão completa) + Seleção de Vencimento Caso B (DTE 30-45d)
 * Liquidez & Estrutura: Validação de pernas OTM (spread <= 10%, OI >= 250) + Eleição de Strangle Default
 */

import {
  Layer1Output,
  Layer2Output,
  ScreenerCandidateInput,
  ScreenerFullCandidateResult,
} from '../types/low-vol-screener.types';
import { Layer0Config, processLayer0 } from './screener-layer0';
import { Layer1Config, processLayer1 } from './screener-layer1';
import { CandidateOptionMetrics, Layer2Config, processLayer2 } from './screener-layer2';
import { ChainStrikeQuote, selectStrangleStructure } from './structure-selector';

export interface CandidateMarketDataV1 {
  optionMetrics?: CandidateOptionMetrics;
  spotPrice?: number | null;
  chainStrikes?: ChainStrikeQuote[];
}

export interface ScreenerV1Config {
  layer0?: Layer0Config;
  layer1?: Layer1Config;
  layer2?: Layer2Config;
}

/**
 * Executa o funil completo do Screener V1 de ponta a ponta de forma puramente determinística.
 */
export function runScreenerV1Pipeline(
  candidates: ScreenerCandidateInput[],
  marketDataMap: Map<string, CandidateMarketDataV1>,
  config: ScreenerV1Config = {}
): ScreenerFullCandidateResult[] {
  // 1. Enriquece candidates com spotPrice de marketDataMap se disponível
  const candidatesWithSpot = candidates.map(c => {
    const md = marketDataMap.get(c.symbol);
    if (md && typeof md.spotPrice === 'number' && md.spotPrice > 0 && !c.spotPrice) {
      return { ...c, spotPrice: md.spotPrice };
    }
    return c;
  });

  // 1. Executa a Camada 0
  const l0Outputs = processLayer0(candidatesWithSpot, config.layer0);

  // 2. Executa a Camada 1
  const l1Outputs = processLayer1(l0Outputs, candidatesWithSpot, config.layer1);
  const l1Map = new Map<string, Layer1Output>(l1Outputs.map(o => [o.symbol, o]));

  // 3. Monta o mapa de métricas para a Camada 2
  const metricsMap = new Map<string, CandidateOptionMetrics>();
  for (const [sym, data] of marketDataMap.entries()) {
    if (data.optionMetrics) {
      metricsMap.set(sym, data.optionMetrics);
    }
  }

  // 4. Executa a Camada 2
  const l2Outputs = processLayer2(l1Outputs, metricsMap, config.layer2);
  const l2Map = new Map<string, Layer2Output>(l2Outputs.map(o => [o.symbol, o]));

  // 5. Integração Final com Liquidez e Seleção de Estrutura
  const results: ScreenerFullCandidateResult[] = [];

  for (const candidate of candidatesWithSpot) {
    const sym = candidate.symbol;
    const l0 = l0Outputs.find(o => o.symbol === sym)!;
    const l1 = l1Map.get(sym);
    const l2 = l2Map.get(sym);
    const marketData = marketDataMap.get(sym);

    // Verificação de falha na Camada 0 (Preço < $100, Percentil HV, Estabilidade e Cota Setorial)
    if (l0.passesPriceThreshold === false || !l0.passesHvPercentile || !l0.passesStability || !l0.sectorQuotaApproved) {
      results.push({
        candidate,
        layer0: l0,
        layer1: l1,
        layer2: l2,
        status: 'REJECTED',
        rejectionStage: 'LAYER_0',
        rejectionReason: l0.rejectionReason,
      });
      continue;
    }

    // Verificação de falha na Camada 1
    if (!l1 || !l1.passesSqueeze) {
      results.push({
        candidate,
        layer0: l0,
        layer1: l1,
        layer2: l2,
        status: 'REJECTED',
        rejectionStage: 'LAYER_1',
        rejectionReason: l1?.rejectionReason,
      });
      continue;
    }

    // Verificação de falha na Camada 2
    if (!l2 || !l2.passesIvFilter) {
      results.push({
        candidate,
        layer0: l0,
        layer1: l1,
        layer2: l2,
        status: 'REJECTED',
        rejectionStage: 'LAYER_2',
        rejectionReason: l2?.rejectionReason,
      });
      continue;
    }

    // Verificação de dados de mercado para montagem de opções
    if (!marketData || marketData.spotPrice == null || marketData.spotPrice <= 0 || !marketData.chainStrikes) {
      results.push({
        candidate,
        layer0: l0,
        layer1: l1,
        layer2: l2,
        status: 'REJECTED',
        rejectionStage: 'LAYER_3_LIQUIDITY',
        rejectionReason: 'Cotações de strikes ou spot price indisponíveis para este ativo',
      });
      continue;
    }

    // Seleção determinística do Strangle OTM
    const strangleRes = selectStrangleStructure({
      layer2Candidate: l2,
      spotPrice: marketData.spotPrice,
      strikes: marketData.chainStrikes,
    });

    if (!strangleRes.success || !strangleRes.strategy) {
      results.push({
        candidate,
        layer0: l0,
        layer1: l1,
        layer2: l2,
        status: 'REJECTED',
        rejectionStage: 'LAYER_3_LIQUIDITY',
        rejectionReason: strangleRes.rejectionReason,
      });
      continue;
    }

    // Candidato aprovado com sucesso no Funil V1!
    results.push({
      candidate,
      layer0: l0,
      layer1: l1,
      layer2: l2,
      strategy: strangleRes.strategy,
      status: 'APPROVED_FOR_EXECUTION',
    });
  }

  return results;
}
