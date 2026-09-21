/**
 * REGRA 00 — RANKING DE OPEN INTEREST
 *
 * Ranqueia strikes por Open Interest REAL (evento Summary do DXLink). Strike sem OI
 * informado pela fonte e EXCLUIDO do ranking: nunca recebe um OI estimado a partir da
 * distancia ao spot ou de qualquer outra heuristica.
 */

export interface OiStrikeInput {
  strike: number;
  callSymbol?: string | null;
  putSymbol?: string | null;
  callStreamerSymbol?: string | null;
  putStreamerSymbol?: string | null;
}

export interface RankedOiItem {
  strike: number;
  symbol: string;
  type: 'CALL' | 'PUT';
  openInterest: number;
  distancePct: number;
  inTheMoney: boolean;
}

export interface TopOiRanking {
  calls: RankedOiItem[];
  puts: RankedOiItem[];
  totalCallOI: number;
  totalPutOI: number;
  /** null quando nao ha OI de call medido (razao indefinida) — nunca 1.0 por padrao. */
  pcRatioOI: number | null;
}

function rankSide(
  strikes: OiStrikeInput[],
  side: 'CALL' | 'PUT',
  oiByStreamerSymbol: Map<string, number | null>,
  spot: number,
  topN: number
): RankedOiItem[] {
  const items: RankedOiItem[] = [];
  for (const s of strikes) {
    const occ = side === 'CALL' ? s.callSymbol : s.putSymbol;
    const streamer = side === 'CALL' ? s.callStreamerSymbol : s.putStreamerSymbol;
    if (!occ || !streamer) continue;
    const oi = oiByStreamerSymbol.get(streamer);
    if (typeof oi !== 'number' || !Number.isFinite(oi) || oi < 0) continue; // sem OI real => fora do ranking
    items.push({
      strike: s.strike,
      symbol: occ,
      type: side,
      openInterest: oi,
      distancePct: ((s.strike - spot) / spot) * 100,
      inTheMoney: side === 'CALL' ? spot >= s.strike : spot <= s.strike,
    });
  }
  return items
    .sort((a, b) => b.openInterest - a.openInterest || Math.abs(a.distancePct) - Math.abs(b.distancePct))
    .slice(0, topN);
}

export function rankTopByOpenInterest(
  strikes: OiStrikeInput[],
  oiByStreamerSymbol: Map<string, number | null>,
  spot: number,
  topN = 10
): TopOiRanking {
  const calls = rankSide(strikes, 'CALL', oiByStreamerSymbol, spot, topN);
  const puts = rankSide(strikes, 'PUT', oiByStreamerSymbol, spot, topN);
  const totalCallOI = calls.reduce((sum, c) => sum + c.openInterest, 0);
  const totalPutOI = puts.reduce((sum, p) => sum + p.openInterest, 0);
  return {
    calls,
    puts,
    totalCallOI,
    totalPutOI,
    pcRatioOI: totalCallOI > 0 ? totalPutOI / totalCallOI : null,
  };
}
