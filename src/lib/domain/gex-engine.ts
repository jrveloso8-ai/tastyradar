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

export interface GexOperationalDiagnostics {
  isClustered: boolean; // Walls encavaladas
  clusteringDistancePct: number;
  pinCandidateStrike: number;
  sniperEntryCallWall: number;
  sniperEntryPutWall: number;
  regimeDescription: string;
  recommendedPlay: string;
}

export function calculateGex(
  symbol: string,
  spotPrice: number,
  options: RawOptionData[]
): GexAnalysisResult & { diagnostics: GexOperationalDiagnostics } {
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
      diagnostics: {
        isClustered: false,
        clusteringDistancePct: 0,
        pinCandidateStrike: spotPrice,
        sniperEntryCallWall: spotPrice,
        sniperEntryPutWall: spotPrice,
        regimeDescription: 'Sem dados suficientes',
        recommendedPlay: 'Aguardar dados de mercado',
      },
    };
  }

  const strikeMap = new Map<number, GexByStrike>();
  let totalCallGex = 0;
  let totalPutGex = 0;
  let totalCallOi = 0;
  let totalPutOi = 0;
  let totalCallVol = 0;
  let totalPutVol = 0;

  // Formula rigorosa institucional:
  // Dollar GEX = Gamma * Open Interest * Spot^2 * Contract Size (100) / 1,000,000 (em $ Milhões)
  const contractSize = 100;
  const spotSquared = spotPrice * spotPrice;

  for (const opt of options) {
    if (opt.strike <= 0) continue;

    let item = strikeMap.get(opt.strike);
    if (!item) {
      item = {
        strike: opt.strike,
        callGex: 0,
        putGex: 0,
        netGex: 0,
        absoluteGex: 0,
        callOi: 0,
        putOi: 0,
        callOpenInterest: 0,
        putOpenInterest: 0,
        callVolume: 0,
        putVolume: 0,
        callIv: 0,
        putIv: 0,
        callDelta: 0,
        putDelta: 0,
      };
      strikeMap.set(opt.strike, item);
    }

    const dollarGamma = (opt.gamma * opt.openInterest * spotSquared * contractSize) / 1000000;

    if (opt.type === 'CALL') {
      item.callGex += dollarGamma;
      item.callOi += opt.openInterest;
      item.callOpenInterest += opt.openInterest;
      item.callVolume += opt.volume;
      item.callIv = opt.iv;
      item.callDelta = opt.delta;
      totalCallGex += dollarGamma;
      totalCallOi += opt.openInterest;
      totalCallVol += opt.volume;
    } else {
      // Put GEX é negativo para os Market Makers
      item.putGex -= dollarGamma;
      item.putOi += opt.openInterest;
      item.putOpenInterest += opt.openInterest;
      item.putVolume += opt.volume;
      item.putIv = opt.iv;
      item.putDelta = opt.delta;
      totalPutGex -= dollarGamma;
      totalPutOi += opt.openInterest;
      totalPutVol += opt.volume;
    }

    item.netGex = Number((item.callGex + item.putGex).toFixed(2));
    item.absoluteGex = Number((Math.abs(item.callGex) + Math.abs(item.putGex)).toFixed(2));
  }

  const sortedStrikes = Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);
  const totalNetGex = Number((totalCallGex + totalPutGex).toFixed(2));

  // Top Call Walls & Put Walls baseados em Gamma Exposure
  const topCallStrikes = [...sortedStrikes].sort((a, b) => b.callGex - a.callGex).slice(0, 5);
  const topPutStrikes = [...sortedStrikes].sort((a, b) => Math.abs(b.putGex) - Math.abs(a.putGex)).slice(0, 5);

  const callWalls = topCallStrikes.map(s => ({
    strike: s.strike,
    symbol: `.${symbol.toUpperCase()}260918C${Math.round(s.strike)}`,
    contracts: s.callOi || s.callOpenInterest || 0,
    delta: s.callDelta || 0.5,
    iv: s.callIv || 35,
    distancePct: Number((((s.strike - spotPrice) / spotPrice) * 100).toFixed(1)),
  }));

  const putWalls = topPutStrikes.map(s => ({
    strike: s.strike,
    symbol: `.${symbol.toUpperCase()}260918P${Math.round(s.strike)}`,
    contracts: s.putOi || s.putOpenInterest || 0,
    delta: s.putDelta || -0.5,
    iv: s.putIv || 35,
    distancePct: Number((((s.strike - spotPrice) / spotPrice) * 100).toFixed(1)),
  }));

  const topCallWall = topCallStrikes[0]?.strike || spotPrice * 1.05;
  const topPutWall = topPutStrikes[0]?.strike || spotPrice * 0.95;

  // Pin Candidate (Ancoragem por maior Open Interest consolidado)
  const pinCandidate = [...sortedStrikes].sort((a, b) => (b.callOpenInterest + b.putOpenInterest) - (a.callOpenInterest + a.putOpenInterest))[0]?.strike || spotPrice;

  // Zero Gamma Flip (Nível onde o Net GEX cruza o zero)
  let zeroGammaFlip = spotPrice;
  for (let i = 0; i < sortedStrikes.length - 1; i++) {
    const s1 = sortedStrikes[i];
    const s2 = sortedStrikes[i + 1];
    if ((s1.netGex <= 0 && s2.netGex >= 0) || (s1.netGex >= 0 && s2.netGex <= 0)) {
      zeroGammaFlip = Number(((s1.strike + s2.strike) / 2).toFixed(2));
      break;
    }
  }

  // Max GEX Magnet (Strike com maior magnitude absoluta de GEX)
  const maxGexMagnetStrike = [...sortedStrikes].sort((a, b) => b.absoluteGex - a.absoluteGex)[0]?.strike || spotPrice;

  const wallDistancePct = Number((((topCallWall - topPutWall) / spotPrice) * 100).toFixed(1));
  const isClustered = wallDistancePct <= 4.0; // Menos de 4% de distância = encavaladas

  return {
    symbol,
    spotPrice,
    totalNetGex,
    totalCallGex: Number(totalCallGex.toFixed(2)),
    totalPutGex: Number(totalPutGex.toFixed(2)),
    zeroGammaFlip,
    maxGexMagnetStrike,
    putCallRatioOi: totalCallOi > 0 ? Number((totalPutOi / totalCallOi).toFixed(2)) : 0,
    putCallRatioVolume: totalCallVol > 0 ? Number((totalPutVol / totalCallVol).toFixed(2)) : 0,
    gammaRegime: totalNetGex > 0 ? 'LONG_GAMMA_STABLE' : totalNetGex < 0 ? 'SHORT_GAMMA_VOLATILE' : 'NEUTRAL',
    strikes: sortedStrikes,
    callWalls,
    putWalls,
    calculatedAt: new Date().toISOString(),
    diagnostics: {
      isClustered,
      clusteringDistancePct: wallDistancePct,
      pinCandidateStrike: pinCandidate,
      sniperEntryCallWall: topCallWall,
      sniperEntryPutWall: topPutWall,
      regimeDescription: totalNetGex >= 0 
        ? '+GEX (Market Makers compram quedas e vendem altas -> Suprime Volatilidade e favorece Reversão à Média)' 
        : '-GEX (Market Makers vendem quedas e compram altas -> Propulsão de Volatilidade e Risco de Squeeze)',
      recommendedPlay: isClustered 
        ? 'Walls Encavaladas: Viés de Consolidação Estrita -> Iron Condor ou Coleta de Teta' 
        : totalNetGex >= 0 
        ? 'Walls Abertas + GEX Positivo -> Sniper Entry no Primeiro Toque na Wall' 
        : 'GEX Negativo -> Atenção a Rompimentos com Aceleração de Momentum',
    },
  };
}