/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * SELEÇÃO DE VENCIMENTO (Função Pura, sem I/O)
 *
 * Caso B: Squeeze sem catalisador com data fixa (Screener V1)
 *
 * Critérios:
 * 1. Janela de DTE configurável: default 30 a 45 dias corridos.
 *    NOTA: Este parâmetro é prática de mercado clássica, pendente de validação quantitativa por backtest.
 * 2. Preferência determinística por ciclos mensais padrão ('Standard' / 'Regular') sobre semanais dentro da janela.
 *    NOTA DE ESCOPO V1: O desempate entre mensal e semanal não compara liquidez de opções (filtro puramente por tipo de ciclo).
 * 3. Seleção determinística: entre os mensais elegíveis, escolhe o mais próximo de 38 DTE (centro da janela 30-45).
 * 4. Se nenhum ciclo estiver disponível na janela 30-45 DTE, retorna null (candidato sem ciclo elegível).
 */

import { SelectedExpiration } from '../types/low-vol-screener.types';

export interface ExpirationOptionChainItem {
  expirationDate: string; // YYYY-MM-DD
  daysToExpiration: number;
  expirationType: string; // 'Standard' | 'Weekly' | 'Regular'
  settlementType?: string; // 'AM' | 'PM'
}

export interface ExpirationSelectorCasoBConfig {
  minDte?: number; // default 30
  maxDte?: number; // default 45
  targetDte?: number; // default 38 (ponto central da janela 30-45)
}

/**
 * PENDENTE DE VALIDAÇÃO POR BACKTEST:
 * A faixa de 30-45 DTE no Caso B é ponto de partida da prática de mercado em derivativos dos EUA.
 * Não é uma constante definitiva imutável e permanece sujeita a calibração empírica.
 */
export const CASO_B_DEFAULT_CONFIG: Required<ExpirationSelectorCasoBConfig> = {
  minDte: 30,
  maxDte: 45,
  targetDte: 38,
};

/**
 * Seleciona deterministicamente o vencimento de opções para o Caso B (sem catalisador).
 */
export function selectExpirationCasoB(
  expirations: ExpirationOptionChainItem[],
  config: ExpirationSelectorCasoBConfig = {}
): SelectedExpiration | null {
  const cfg = { ...CASO_B_DEFAULT_CONFIG, ...config };

  if (!expirations || expirations.length === 0) {
    return null;
  }

  // 1. Filtra os ciclos que caem na janela configurada (30 a 45 DTE)
  const candidateCycles = expirations.filter(
    e => e.daysToExpiration >= cfg.minDte && e.daysToExpiration <= cfg.maxDte
  );

  if (candidateCycles.length === 0) {
    return null;
  }

  // 2. Separa ciclos mensais padrão de semanais
  // SIMPLIFICAÇÃO DELIBERADA DE ESCOPO NO V1:
  // A cláusula teórica "preferir mensal, salvo se a semanal tiver liquidez equivalente"
  // NÃO realiza comparação de liquidez (bid/ask spread ou OI) entre as opções dos ciclos nesta versão.
  // Trata-se de uma decisão de negócio consciente para o V1: o filtro é puramente binário por tipo
  // ('Standard' / 'Regular'), priorizando de forma determinística os ciclos mensais padrão sobre
  // semanais devido à maior liquidez e representatividade institucional histórica, sem consultar
  // cotações adicionais de semanas concorrentes.
  const isStandard = (e: ExpirationOptionChainItem) =>
    e.expirationType.toLowerCase() === 'standard' || e.expirationType.toLowerCase() === 'regular';

  const monthlyCycles = candidateCycles.filter(isStandard);

  // Se houver ciclos mensais padrão, escolhe exclusivamente entre eles; caso contrário, usa os semanais disponíveis
  const pool = monthlyCycles.length > 0 ? monthlyCycles : candidateCycles;

  // 3. Escolhe o ciclo com menor distância absoluta ao targetDte (38 dias).
  // REGRA DE DESEMPATE DETERMINÍSTICA: Havendo empate na distância absoluta (ex: 35 DTE vs 41 DTE,
  // ambos a 3 dias de 38), seleciona deterministicamente o ciclo de MAIOR DTE (41 dias), pois em compra
  // de volatilidade (long vol) mais dias até o vencimento reduzem o decaimento diário de theta.
  let chosen = pool[0];
  let minDiff = Math.abs(chosen.daysToExpiration - cfg.targetDte);

  for (let i = 1; i < pool.length; i++) {
    const diff = Math.abs(pool[i].daysToExpiration - cfg.targetDte);
    if (diff < minDiff) {
      minDiff = diff;
      chosen = pool[i];
    } else if (diff === minDiff && pool[i].daysToExpiration > chosen.daysToExpiration) {
      chosen = pool[i];
    }
  }

  return {
    expirationDate: chosen.expirationDate,
    dte: chosen.daysToExpiration,
    selectionRule: 'CASO_B_SQUEEZE_GERAL',
    bufferDaysApplied: 0,
    isMonthlyStandard: isStandard(chosen),
    provenance: 'DERIVADO',
    source: 'deterministic-expiration-caso-b-30-45dte',
  };
}
