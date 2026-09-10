import { describe, it, expect } from 'vitest';
import { combineProvenance, ProvenanceBadge } from '@/lib/types/provenance';

describe('Proveniência de Dados — Regra estrita de contágio', () => {
  it('retorna MEDIDO quando todos os insumos são puramente medidos', () => {
    const inputs: ProvenanceBadge[] = ['MEDIDO', 'MEDIDO', 'MEDIDO'];
    expect(combineProvenance(inputs)).toBe('MEDIDO');
  });

  it('retorna DERIVADO quando há mistura de MEDIDO e DERIVADO sem proxies', () => {
    const inputs: ProvenanceBadge[] = ['MEDIDO', 'DERIVADO', 'MEDIDO'];
    expect(combineProvenance(inputs)).toBe('DERIVADO');
  });

  it('retorna ESTIMADO quando qualquer insumo é modelo/proxy (na ausência de SIMULADO ou INDISPONIVEL)', () => {
    const inputs: ProvenanceBadge[] = ['MEDIDO', 'DERIVADO', 'ESTIMADO'];
    expect(combineProvenance(inputs)).toBe('ESTIMADO');
  });

  it('retorna INDISPONIVEL quando qualquer insumo falha na fonte (sem SIMULADO)', () => {
    // Caso: preço spot é MEDIDO, mas volatilidade da fonte é INDISPONIVEL -> cálculo fica INDISPONIVEL
    const inputs: ProvenanceBadge[] = ['MEDIDO', 'INDISPONIVEL', 'DERIVADO'];
    expect(combineProvenance(inputs)).toBe('INDISPONIVEL');
  });

  it('SIMULADO contamina mesmo sobrepondo INDISPONIVEL (pior caso absoluto)', () => {
    // Caso assimétrico: fonte falhou (INDISPONIVEL) mas alguém tentou alimentar com mock SIMULADO
    // -> deve permanecer SIMULADO para não mascarar dado sintético
    const inputs: ProvenanceBadge[] = ['INDISPONIVEL', 'SIMULADO', 'MEDIDO'];
    expect(combineProvenance(inputs)).toBe('SIMULADO');
  });

  it('lida com lista vazia retornando MEDIDO como caso base', () => {
    expect(combineProvenance([])).toBe('MEDIDO');
  });
});
