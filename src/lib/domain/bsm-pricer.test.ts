import { describe, it, expect } from 'vitest';
import { calculateBsm, normalCdf } from './bsm-pricer';

describe('Black-Scholes Merton (BSM) Engine', () => {
  it('deve calcular a normal cumulativa Φ(0) = 0.5 e limites assintóticos', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it('deve coincidir com o valor teórico clássico de livro (Golden Test)', () => {
    // S=100, K=100, T=1.0, sigma=0.20, r=0.05
    // Call teórica exata de livro = 10.45
    // Put teórica exata de livro = 5.57
    const call = calculateBsm(100, 100, 1.0, 0.20, 0.05, 'CALL');
    const put = calculateBsm(100, 100, 1.0, 0.20, 0.05, 'PUT');

    expect(call.price).toBe(10.45);
    expect(call.delta).toBe(0.64);
    expect(put.price).toBe(5.57);
    expect(put.delta).toBe(-0.36);

    // Paridade Put-Call: C - P = S - K * exp(-r * T) -> 10.45 - 5.57 = 4.88; 100 - 95.12 = 4.88
    expect(Number((call.price - put.price).toFixed(2))).toBe(4.88);
  });

  it('deve aumentar o prêmio da opção proporcionalmente ao aumento de volatilidade', () => {
    const lowVol = calculateBsm(142.50, 142.50, 35 / 365, 0.22, 0.045, 'CALL');
    const highVol = calculateBsm(142.50, 142.50, 35 / 365, 0.80, 0.045, 'CALL');

    // Com 80% de vol o prêmio deve ser dramaticamente maior que com 22%
    expect(highVol.price).toBeGreaterThan(lowVol.price * 2.5);
  });
});
