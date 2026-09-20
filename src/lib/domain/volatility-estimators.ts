/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * Estimadores de Volatilidade Histórica (Puros, sem I/O, matematicamente auditáveis).
 *
 * Estimador Garman-Klass (1980):
 * Incorpora Open, High, Low e Close, sendo até 8x mais eficiente que o estimador de Close-to-Close.
 * Fórmula por barra i:
 *   gk_i = 0.5 * (ln(H_i / L_i))^2 - (2*ln(2) - 1) * (ln(C_i / O_i))^2
 *   onde (2*ln(2) - 1) ~= 0.3862943611198906
 *
 * Anualização:
 *   sigma = sqrt( (1 / N) * sum(gk_i) * 252 ) * 100
 */

import { OHLCVBar } from '../types/low-vol-screener.types';

const GK_CONST = 2 * Math.LN2 - 1; // 0.3862943611198906

export interface GarmanKlassResult {
  annualizedHv: number; // Em percentual (ex: 28.5%)
  validBarsCount: number;
}

/**
 * Calcula a variância individual Garman-Klass para uma única barra.
 */
export function calculateGarmanKlassBarVariance(bar: OHLCVBar): number {
  if (bar.low <= 0 || bar.open <= 0 || bar.high <= 0 || bar.close <= 0) {
    throw new Error(`Barra inválida com preço menor ou igual a zero na data ${bar.date}`);
  }
  if (bar.high < bar.low) {
    throw new Error(`Barra inconsistente (High < Low) na data ${bar.date}`);
  }

  const logHl = Math.log(bar.high / bar.low);
  const logCo = Math.log(bar.close / bar.open);

  const term1 = 0.5 * logHl * logHl;
  const term2 = GK_CONST * logCo * logCo;

  return term1 - term2;
}

/**
 * Calcula a volatilidade histórica anualizada Garman-Klass sobre uma série de barras.
 * Requer no mínimo 20 barras para relevância estatística.
 */
export function calculateGarmanKlassHV(bars: OHLCVBar[]): GarmanKlassResult {
  if (!bars || bars.length < 20) {
    throw new Error(`Série de barras insuficiente para Garman-Klass (mínimo 20 barras, recebidas ${bars ? bars.length : 0})`);
  }

  let sumVariance = 0;
  for (let i = 0; i < bars.length; i++) {
    sumVariance += calculateGarmanKlassBarVariance(bars[i]);
  }

  const meanVariance = sumVariance / bars.length;
  if (meanVariance < 0) {
    // Casos patológicos de arredondamento onde H == L e C != O
    return { annualizedHv: 0, validBarsCount: bars.length };
  }

  const annualizedHv = Math.sqrt(meanVariance * 252) * 100;
  return {
    annualizedHv: Number(annualizedHv.toFixed(4)),
    validBarsCount: bars.length,
  };
}

/**
 * Filtro de Robustez (Estabilidade do HV 12m):
 * Recalcula o Garman-Klass excluindo os 5% de dias com maior retorno absoluto |ln(C_t / C_{t-1})|.
 * Se a volatilidade despencar mais de 40%, indica que o HV foi distorcido por picos isolados.
 *
 * ACOPLAMENTO DE DEPENDÊNCIA:
 * Esta função exige rigorosamente bars.length >= 50 para garantir relevância estatística no cálculo de 5% de corte
 * (pelo menos 3 barras excluídas). A Camada 0 (screener-layer0.ts) consome esta função operando com minBarsRequired=250.
 * Caso o minBarsRequired de Camada 0 seja alterado no futuro, ele jamais deve ser inferior a 50.
 */
export interface RobustnessTestResult {
  originalHv: number;
  trimmedHv: number;
  dropRatio: number; // (originalHv - trimmedHv) / originalHv
  excludedBarsCount: number;
  isRobust: boolean; // true se dropRatio <= 0.40
}

export function testHvRobustness(bars: OHLCVBar[], dropThreshold = 0.40): RobustnessTestResult {
  if (!bars || bars.length < 50) {
    throw new Error(`Série insuficiente para teste de robustez (mínimo 50 barras, recebidas ${bars ? bars.length : 0})`);
  }

  const originalResult = calculateGarmanKlassHV(bars);
  const originalHv = originalResult.annualizedHv;

  // Calcula os retornos absolutos de fechamento a fechamento
  // Para a barra 0, usamos |ln(C_0 / O_0)| como proxy de retorno
  interface BarWithReturn {
    bar: OHLCVBar;
    absReturn: number;
    originalIndex: number;
  }

  const barsWithReturn: BarWithReturn[] = [];
  for (let i = 0; i < bars.length; i++) {
    const prevClose = i > 0 ? bars[i - 1].close : bars[i].open;
    const absReturn = Math.abs(Math.log(bars[i].close / prevClose));
    barsWithReturn.push({ bar: bars[i], absReturn, originalIndex: i });
  }

  // Identifica os 5% de dias com maior retorno absoluto
  const trimCount = Math.ceil(0.05 * bars.length);
  const sortedByReturn = [...barsWithReturn].sort((a, b) => b.absReturn - a.absReturn);
  const excludedIndices = new Set<number>(sortedByReturn.slice(0, trimCount).map(item => item.originalIndex));

  // Filtra as barras mantendo a ordem cronológica
  const trimmedBars = bars.filter((_, idx) => !excludedIndices.has(idx));

  const trimmedResult = calculateGarmanKlassHV(trimmedBars);
  const trimmedHv = trimmedResult.annualizedHv;

  const dropRatio = originalHv > 0 ? Number(((originalHv - trimmedHv) / originalHv).toFixed(4)) : 0;
  const isRobust = dropRatio <= dropThreshold;

  return {
    originalHv,
    trimmedHv,
    dropRatio,
    excludedBarsCount: trimCount,
    isRobust,
  };
}

/**
 * Calcula o percentil de uma amostra de valores (0 a 100).
 * Usado para classificar o HV no universo e o BBW na série própria.
 */
export function calculatePercentileRank(value: number, allValues: number[]): number {
  if (!allValues || allValues.length === 0) return 0;
  if (allValues.length === 1) return 50;

  // Conta quantos valores são estritamente menores
  let strictlyLess = 0;
  let equalCount = 0;

  for (let i = 0; i < allValues.length; i++) {
    if (allValues[i] < value) {
      strictlyLess++;
    } else if (allValues[i] === value) {
      equalCount++;
    }
  }

  // Fórmula padrão de percentil empírico com interpolação de empates:
  // rank = (strictlyLess + 0.5 * equalCount) / N * 100
  const rank = ((strictlyLess + 0.5 * equalCount) / allValues.length) * 100;
  return Number(rank.toFixed(2));
}
