import { GexAnalysisResult, GexByStrike } from '../types';

export interface RawOptionData {
  symbol: string;
  strike: number;
  type: 'CALL' | 'PUT';
  gamma: number;
  openInterest: number;
  volume: number;
  delta: number;
  iv: number;
}

export function calculateGex(
  symbol: string,
  spotPrice: number,
  options: RawOptionData[]
): GexAnalysisResult {
  if (!options || options.length === 0 || spotPrice <= 0) {
    return {
      symbol,
      spotPrice,
      totalNetGex: 0,
      totalCallGex: 0,
      totalPutGex: 0,
      zeroGammaFlip: spotPrice,
      maxGexMagnetStrike: spotPrice,
      putCallRatioOi: 0,
      putCallRatioVolume: 0,
      gammaRegime: 'NEUTRAL',
      strikes: [],
      callWalls: [],
      putWalls: [],
      calculatedAt: new Date().toISOString(),
    };
  }

  const strikeMap = new Map<number, GexByStrike>();
  let totalCallGex = 0;
  let totalPutGex = 0;
  let totalCallOi = 0;
  let totalPutOi = 0;
  let totalCallVol = 0;
  let totalPutVol = 0;

  for (const opt of options) {
    const strike = opt.strike;
    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, {
        strike,
        callGex: 0,
        putGex: 0,
        netGex: 0,
        callOi: 0,
        putOi: 0,
        callVolume: 0,
        putVolume: 0,
      });
    }

    const entry = strikeMap.get(strike)!;
    const rawGex = (opt.gamma || 0) * (opt.openInterest || 0) * 100 * spotPrice;

    if (opt.type === 'CALL') {
      entry.callGex += rawGex;
      entry.callOi += opt.openInterest || 0;
      entry.callVolume += opt.volume || 0;
      totalCallGex += rawGex;
      totalCallOi += opt.openInterest || 0;
      totalCallVol += opt.volume || 0;
    } else {
      entry.putGex += rawGex;
      entry.putOi += opt.openInterest || 0;
      entry.putVolume += opt.volume || 0;
      totalPutGex += rawGex;
      totalPutOi += opt.openInterest || 0;
      totalPutVol += opt.volume || 0;
    }

    entry.netGex = entry.callGex - entry.putGex;
  }

  const sortedStrikes = Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);
  const totalNetGex = totalCallGex - totalPutGex;

  let zeroGammaFlip = spotPrice;
  for (let i = 0; i < sortedStrikes.length - 1; i++) {
    const s1 = sortedStrikes[i];
    const s2 = sortedStrikes[i + 1];
    if ((s1.netGex <= 0 && s2.netGex >= 0) || (s1.netGex >= 0 && s2.netGex <= 0)) {
      zeroGammaFlip = (s1.strike + s2.strike) / 2;
      break;
    }
  }

  let maxGexMagnetStrike = spotPrice;
  let maxCallGex = -Infinity;
  for (const s of sortedStrikes) {
    if (s.callGex > maxCallGex) {
      maxCallGex = s.callGex;
      maxGexMagnetStrike = s.strike;
    }
  }

  const callOptions = options.filter(o => o.type === 'CALL').sort((a, b) => (b.openInterest || 0) - (a.openInterest || 0));
  const putOptions = options.filter(o => o.type === 'PUT').sort((a, b) => (b.openInterest || 0) - (a.openInterest || 0));

  const callWalls = callOptions.slice(0, 5).map(o => ({
    strike: o.strike,
    symbol: o.symbol,
    contracts: o.openInterest,
    delta: o.delta,
    iv: o.iv,
    distancePct: ((o.strike - spotPrice) / spotPrice) * 100,
  }));

  const putWalls = putOptions.slice(0, 5).map(o => ({
    strike: o.strike,
    symbol: o.symbol,
    contracts: o.openInterest,
    delta: o.delta,
    iv: o.iv,
    distancePct: ((o.strike - spotPrice) / spotPrice) * 100,
  }));

  const putCallRatioOi = totalCallOi > 0 ? Number((totalPutOi / totalCallOi).toFixed(2)) : 0;
  const putCallRatioVolume = totalCallVol > 0 ? Number((totalPutVol / totalCallVol).toFixed(2)) : 0;
  const gammaRegime = totalNetGex > 0 ? 'LONG_GAMMA_STABLE' : totalNetGex < 0 ? 'SHORT_GAMMA_VOLATILE' : 'NEUTRAL';

  return {
    symbol,
    spotPrice,
    totalNetGex,
    totalCallGex,
    totalPutGex,
    zeroGammaFlip,
    maxGexMagnetStrike,
    putCallRatioOi,
    putCallRatioVolume,
    gammaRegime,
    strikes: sortedStrikes,
    callWalls,
    putWalls,
    calculatedAt: new Date().toISOString(),
  };
}