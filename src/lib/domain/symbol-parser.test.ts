import { describe, it, expect } from 'vitest';
import { parseOptionSymbol } from './symbol-parser';

describe('SymbolParser Domain', () => {
  it('should parse dot OCC standard symbol correctly (.SPXW260918C6000)', () => {
    const res = parseOptionSymbol('.SPXW260918C6000');
    expect(res).not.toBeNull();
    expect(res?.underlying).toBe('SPXW');
    expect(res?.type).toBe('CALL');
    expect(res?.strike).toBe(6000);
    expect(res?.expiration).toBe('2026-09-18');
  });

  it('should parse put option correctly (.SPY260918P595)', () => {
    const res = parseOptionSymbol('.SPY260918P595');
    expect(res).not.toBeNull();
    expect(res?.underlying).toBe('SPY');
    expect(res?.type).toBe('PUT');
    expect(res?.strike).toBe(595);
    expect(res?.expiration).toBe('2026-09-18');
  });

  it('should return null for invalid symbol format', () => {
    const res = parseOptionSymbol('INVALID_TICKER');
    expect(res).toBeNull();
  });
});