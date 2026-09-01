import { describe, it, expect } from 'vitest';
import { calculateGex, RawOptionData } from './gex-engine';

describe('GexEngine Domain', () => {
  it('should calculate net GEX, zero gamma flip and max magnet strike', () => {
    const mockOptions: RawOptionData[] = [
      { symbol: '.SPX260918C5900', strike: 5900, type: 'CALL', gamma: 0.002, openInterest: 10000, volume: 5000, delta: 0.8, iv: 14.0 },
      { symbol: '.SPX260918C6000', strike: 6000, type: 'CALL', gamma: 0.005, openInterest: 30000, volume: 15000, delta: 0.5, iv: 13.5 },
      { symbol: '.SPX260918C6050', strike: 6050, type: 'CALL', gamma: 0.004, openInterest: 40000, volume: 20000, delta: 0.35, iv: 13.8 },
      { symbol: '.SPX260918P5900', strike: 5900, type: 'PUT', gamma: 0.002, openInterest: 35000, volume: 12000, delta: -0.2, iv: 14.5 },
      { symbol: '.SPX260918P5950', strike: 5950, type: 'PUT', gamma: 0.004, openInterest: 45000, volume: 18000, delta: -0.38, iv: 14.2 },
      { symbol: '.SPX260918P6000', strike: 6000, type: 'PUT', gamma: 0.005, openInterest: 15000, volume: 8000, delta: -0.5, iv: 13.5 },
    ];

    const result = calculateGex('SPX', 6000, mockOptions);

    expect(result.symbol).toBe('SPX');
    expect(result.spotPrice).toBe(6000);
    expect(result.totalCallGex).toBeGreaterThan(0);
    expect(result.totalPutGex).toBeGreaterThan(0);
    expect(result.strikes.length).toBe(4);
    expect(result.maxGexMagnetStrike).toBe(6050);
    expect(result.callWalls.length).toBeGreaterThan(0);
    expect(result.putWalls.length).toBeGreaterThan(0);
    expect(result.gammaRegime).toBeDefined();
  });

  it('should handle empty options list safely', () => {
    const result = calculateGex('SPX', 6000, []);
    expect(result.totalNetGex).toBe(0);
    expect(result.strikes.length).toBe(0);
    expect(result.gammaRegime).toBe('NEUTRAL');
  });
});