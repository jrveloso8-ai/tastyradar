import { describe, it, expect } from 'vitest';
import {
  calculateExpirationDte,
  getAvailableExpirations,
  getDefaultExpirationId,
  buildActiveExpiration,
  TASTYTRADE_EXPIRATIONS,
} from '@/components/options/UnifiedGexBarreirasView';

describe('Vencimentos Tastytrade — Cálculo Dinâmico de DTE e Filtragem', () => {
  const mockToday = new Date(2026, 8, 10); // 10 de Setembro de 2026

  it('calcula DTE exato contra a data de referência (10/09/2026)', () => {
    // 2026-09-04 venceu há 6 dias (-6 DTE)
    expect(calculateExpirationDte('2026-09-04', mockToday)).toBe(-6);

    // 2026-09-10 vence hoje (0 DTE)
    expect(calculateExpirationDte('2026-09-10', mockToday)).toBe(0);

    // 2026-09-11 vence amanhã (1 DTE)
    expect(calculateExpirationDte('2026-09-11', mockToday)).toBe(1);

    // 2026-09-18 vence em 8 dias (8 DTE)
    expect(calculateExpirationDte('2026-09-18', mockToday)).toBe(8);

    // 2026-09-25 vence em 15 dias (15 DTE)
    expect(calculateExpirationDte('2026-09-25', mockToday)).toBe(15);

    // 2026-10-02 vence em 22 dias (22 DTE)
    expect(calculateExpirationDte('2026-10-02', mockToday)).toBe(22);

    // 2026-10-16 vence em 36 dias (36 DTE)
    expect(calculateExpirationDte('2026-10-16', mockToday)).toBe(36);
  });

  it('filtra vencimentos que já passaram e nunca exibe expirado na lista', () => {
    const available = getAvailableExpirations(mockToday);

    // 2026-09-04 está no passado, não deve constar
    expect(available.some((e) => e.id === '2026-09-04')).toBe(false);

    // O primeiro item deve ser 2026-09-11 (1 DTE)
    expect(available[0].id).toBe('2026-09-11');
    expect(available[0].dte).toBe(1);
    expect(available[0].dateStr).toBe('11 Set (1 DTE - Semanal W)');

    // Todos os itens retornados devem ter DTE >= 0
    expect(available.every((e) => e.dte >= 0)).toBe(true);
  });

  it('regenera dateStr com o DTE recalculado mantendo a classificação', () => {
    const activeSep18 = buildActiveExpiration(
      TASTYTRADE_EXPIRATIONS.find((e) => e.id === '2026-09-18')!,
      mockToday
    );
    expect(activeSep18.dte).toBe(8);
    expect(activeSep18.dateStr).toBe('18 Set (8 DTE - Mais Líquida)');

    const activeOct16 = buildActiveExpiration(
      TASTYTRADE_EXPIRATIONS.find((e) => e.id === '2026-10-16')!,
      mockToday
    );
    expect(activeOct16.dte).toBe(36);
    expect(activeOct16.dateStr).toBe('16 Out (36 DTE - Mensal Standard)');
  });

  it('seleciona default dinamicamente para o primeiro isLiquid não vencido', () => {
    // Em 10/09/2026, 2026-09-18 é o primeiro isLiquid não vencido
    expect(getDefaultExpirationId(mockToday)).toBe('2026-09-18');

    // Em 20/09/2026 (após o vencimento de 18/09), deve avançar para 2026-10-16
    const futureDate = new Date(2026, 8, 20);
    expect(getDefaultExpirationId(futureDate)).toBe('2026-10-16');
  });

  it('em execução ao vivo com a data do sistema, nenhum vencimento expirado é retornado', () => {
    const liveAvailable = getAvailableExpirations();
    for (const exp of liveAvailable) {
      expect(exp.dte).toBeGreaterThanOrEqual(0);
    }
  });
});
