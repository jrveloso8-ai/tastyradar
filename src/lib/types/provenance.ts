/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * Todo número exibido carrega marca de proveniência visível na interface:
 * - MEDIDO       : veio de fonte externa nesta sessão, com timestamp
 * - DERIVADO     : calculado exclusivamente a partir de MEDIDO, fórmula auditável
 * - ESTIMADO     : modelo/proxy declarado, com premissa explícita (ex: Black-Scholes Merton BSM)
 * - SIMULADO     : sintético, demo, seed de teste — exige aviso de transparência na tela
 * - INDISPONIVEL : tentativa de busca externa falhou ou fonte não respondeu
 *
 * Regra de contágio:
 * SIMULADO > INDISPONIVEL > ESTIMADO > DERIVADO > MEDIDO
 * - Qualquer insumo SIMULADO contamina a cadeia para SIMULADO.
 * - Na ausência de SIMULADO, qualquer insumo INDISPONIVEL resulta em INDISPONIVEL.
 */

export type ProvenanceBadge = 'MEDIDO' | 'DERIVADO' | 'ESTIMADO' | 'SIMULADO' | 'INDISPONIVEL';

export interface ProvenanceMetadata {
  provenance: ProvenanceBadge;
  source: string;
  timestamp?: string;
  formula?: string;
  assumptions?: string;
}

export interface ProvenanceValue<T> extends ProvenanceMetadata {
  value: T;
}

/**
 * Aplica a regra estrita de contágio de proveniência:
 * SIMULADO > INDISPONIVEL > ESTIMADO > DERIVADO > MEDIDO
 */
export function combineProvenance(badges: ProvenanceBadge[]): ProvenanceBadge {
  if (badges.includes('SIMULADO')) return 'SIMULADO';
  if (badges.includes('INDISPONIVEL')) return 'INDISPONIVEL';
  if (badges.includes('ESTIMADO')) return 'ESTIMADO';
  if (badges.includes('DERIVADO')) return 'DERIVADO';
  return 'MEDIDO';
}
