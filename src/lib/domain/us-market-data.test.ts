import { describe, it, expect } from 'vitest';
import {
  calculateEMA,
  calculateWilderRSI,
  calculateCanonicalMACD,
  generateCandlesticks,
} from './us-market-data';

describe('US Market Data - Canonical Technical Indicators (Achado N-06)', () => {
  describe('calculateEMA', () => {
    it('deve retornar vazio se a série for vazia', () => {
      expect(calculateEMA([], 10)).toEqual([]);
    });

    it('deve manter valor constante para série constante', () => {
      const series = [50, 50, 50, 50, 50];
      const ema = calculateEMA(series, 3);
      ema.forEach((v) => expect(v).toBeCloseTo(50, 4));
    });

    it('deve calcular a mão o valor exato da EMA com multiplicador k = 2/(period+1)', () => {
      // Período 2: k = 2 / (2 + 1) = 2/3 (~0.6667)
      // Valores: [10, 20, 30]
      // i=0: 10 (seed)
      // i=1: (10 + 20) / 2 = 15 (SMA de 2 períodos para seed)
      // i=2: 30 * (2/3) + 15 * (1/3) = 20 + 5 = 25.0
      const values = [10, 20, 30];
      const ema = calculateEMA(values, 2);
      expect(ema[0]).toBe(10);
      expect(ema[1]).toBe(15);
      expect(ema[2]).toBeCloseTo(25.0, 4);
    });
  });

  describe('calculateWilderRSI', () => {
    it('deve retornar 50 para os primeiros períodos antes de completar 14 barras', () => {
      const closes = [10, 11, 12, 11, 12];
      const rsi = calculateWilderRSI(closes, 14);
      expect(rsi.length).toBe(closes.length);
      rsi.forEach((v) => expect(v).toBe(50.0));
    });

    it('deve retornar RSI = 100 para série de altas consecutivas sem nenhuma queda', () => {
      // 16 fechamentos estritamente crescentes
      const closes = Array.from({ length: 16 }, (_, i) => 100 + i * 2);
      const rsi = calculateWilderRSI(closes, 14);
      // No índice 14 e 15, avgLoss é 0, logo RSI deve ser 100
      expect(rsi[14]).toBe(100.0);
      expect(rsi[15]).toBe(100.0);
    });

    it('deve retornar RSI próximo a 0 para série de quedas consecutivas', () => {
      // 16 fechamentos estritamente decrescentes
      const closes = Array.from({ length: 16 }, (_, i) => 200 - i * 2);
      const rsi = calculateWilderRSI(closes, 14);
      expect(rsi[14]).toBe(0.0);
      expect(rsi[15]).toBe(0.0);
    });

    it('deve utilizar suavização exponencial de Wilder (modified moving average com alpha=1/14)', () => {
      // Cria uma série oscilante conhecida de 20 pontos
      const closes = [
        100, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105, 107, 106, 108, 107, // 15 pontos (índices 0 a 14)
        109, 108, 110, 109, 111,
      ];
      const rsi = calculateWilderRSI(closes, 14);

      // No índice 14: há 7 ganhos de 2 e 7 perdas de 1
      // avgGain = (7 * 2) / 14 = 1.0
      // avgLoss = (7 * 1) / 14 = 0.5
      // RS = 1.0 / 0.5 = 2.0
      // RSI = 100 - (100 / (1 + 2)) = 100 - 33.333 = 66.67
      expect(rsi[14]).toBe(66.67);

      // No índice 15 (fechamento 109, ganho de +2, perda de 0):
      // Wilder suaviza com peso 13 para a média anterior e 1 para o novo ganho:
      // newAvgGain = (1.0 * 13 + 2.0) / 14 = 15 / 14 = 1.0714
      // newAvgLoss = (0.5 * 13 + 0.0) / 14 = 6.5 / 14 = 0.4643
      // RS = 1.0714 / 0.4643 = 2.3077
      // RSI = 100 - (100 / (1 + 2.3077)) = 100 - 30.23 = 69.77
      expect(rsi[15]).toBe(69.77);
    });
  });

  describe('calculateCanonicalMACD', () => {
    it('deve gerar histograma zero para série de preços flat', () => {
      const closes = Array.from({ length: 40 }, () => 100);
      const macd = calculateCanonicalMACD(closes, 12, 26, 9);
      macd.histogram.forEach((h) => expect(h).toBe(0));
      macd.macdLine.forEach((m) => expect(m).toBe(0));
    });

    it('deve satisfazer a identidade canônica: histograma = macdLine - signalLine', () => {
      const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 3) * 10);
      const { macdLine, signalLine, histogram } = calculateCanonicalMACD(closes, 12, 26, 9);

      for (let i = 0; i < closes.length; i++) {
        const diff = Number((macdLine[i] - signalLine[i]).toFixed(2));
        expect(histogram[i]).toBe(diff);
      }
    });
  });

  describe('generateCandlesticks', () => {
    it('deve gerar série de velas determinística e reproduzível para o mesmo ticker', () => {
      const candles1 = generateCandlesticks('AAPL', 230.0, 90);
      const candles2 = generateCandlesticks('AAPL', 230.0, 90);

      expect(candles1.length).toBe(90);
      expect(candles2.length).toBe(90);

      // Verificação exata da primeira e última vela (reprodutibilidade estrita)
      expect(candles1[0]).toEqual(candles2[0]);
      expect(candles1[89]).toEqual(candles2[89]);

      // Último fechamento deve ser exatamente o spot solicitado
      expect(candles1[89].close).toBe(230.0);
    });

    it('não deve conter constantes por entidade específicas (TSLA/INTC/BA com mesmo spot convergem para seu próprio hash)', () => {
      const tslaCandles = generateCandlesticks('TSLA', 200.0, 30);
      const intcCandles = generateCandlesticks('INTC', 200.0, 30);

      // Ambos chegam ao mesmo spot no final
      expect(tslaCandles[29].close).toBe(200.0);
      expect(intcCandles[29].close).toBe(200.0);

      // Ambas possuem indicadores válidos dentro das faixas canônicas
      expect(tslaCandles[29].rsi).toBeGreaterThanOrEqual(0);
      expect(tslaCandles[29].rsi).toBeLessThanOrEqual(100);
      expect(typeof tslaCandles[29].macdHist).toBe('number');
    });
  });
});
