import { NextRequest, NextResponse } from 'next/server';
import { tastyMarketService, OptionChainExpiration } from '@/lib/services/tastytrade-market.service';
import { fetchRealGreeks } from '@/lib/services/tastytrade-dxlink.service';
import { rankTopByOpenInterest } from '@/lib/domain/top-oi-ranking';

export const dynamic = 'force-dynamic';

// Quantos strikes (os mais proximos do spot) tem o OI consultado no DXLink. Limita a assinatura
// do streaming; o ranking e feito SOMENTE dentro deste universo e a resposta declara isso.
const OI_UNIVERSE_STRIKES = 30;
const OI_STREAM_WAIT_MS = 8000;

/**
 * REGRA 00: o Open Interest exibido aqui e REAL (evento Summary do DXLink). Strike sem OI
 * informado pela fonte fica fora do ranking; nunca ha OI estimado por distancia ao spot.
 * Sem spot real ou sem nenhum OI real, a rota responde erro — nunca numeros plausiveis.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get('symbol') || searchParams.get('underlying') || 'NVDA';
    const cleanSymbol = rawSymbol.trim().toUpperCase();
    const requestedExp = searchParams.get('expiration') || '';

    // 1. Spot real via Tastytrade Equity Quotes
    const quotes = await tastyMarketService.getEquityQuotes([cleanSymbol]);
    const spotPrice = quotes[cleanSymbol]?.last ?? null;
    if (spotPrice === null || !(spotPrice > 0)) {
      return NextResponse.json(
        { success: false, error: `Spot real indisponivel na Tastytrade para ${cleanSymbol}.` },
        { status: 502 }
      );
    }

    // 2. Cadeia de opcoes real
    const chain = await tastyMarketService.getOptionChain(cleanSymbol);
    if (!chain || !chain.expirations || chain.expirations.length === 0) {
      return NextResponse.json(
        { success: false, error: `Cadeia de opções oficial indisponível na Tastytrade para ${cleanSymbol}.` },
        { status: 404 }
      );
    }

    const availableExpirations = chain.expirations
      .map((e: OptionChainExpiration) => ({ date: e.expirationDate, dte: e.daysToExpiration }))
      .filter((e: { date: string; dte: number }) => e.dte >= 0);

    let selectedExp = chain.expirations.find((e: OptionChainExpiration) => e.expirationDate === requestedExp);
    if (!selectedExp) {
      selectedExp =
        chain.expirations.find((e: OptionChainExpiration) => e.daysToExpiration >= 20 && e.daysToExpiration <= 55) ||
        chain.expirations[0];
    }

    if (!selectedExp || !selectedExp.strikes) {
      return NextResponse.json(
        { success: false, error: `Vencimento selecionado sem strikes na Tastytrade.` },
        { status: 404 }
      );
    }

    // 3. Universo: os N strikes mais proximos do spot; OI real desses contratos via DXLink
    const universe = [...selectedExp.strikes]
      .sort((a, b) => Math.abs(a.strike - spotPrice) - Math.abs(b.strike - spotPrice))
      .slice(0, OI_UNIVERSE_STRIKES);
    const streamerSymbols = universe
      .flatMap((s) => [s.callStreamerSymbol, s.putStreamerSymbol])
      .filter((s): s is string => Boolean(s));
    const greeks = await fetchRealGreeks(streamerSymbols, OI_STREAM_WAIT_MS);
    const oiBySymbol = new Map<string, number | null>();
    for (const [sym, q] of greeks) oiBySymbol.set(sym, q.openInterest);

    const ranking = rankTopByOpenInterest(universe, oiBySymbol, spotPrice, 10);
    if (ranking.calls.length === 0 && ranking.puts.length === 0) {
      return NextResponse.json(
        { success: false, error: `Open Interest real indisponível (DXLink não respondeu) para ${cleanSymbol}.` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol: cleanSymbol,
        spotPrice,
        selectedExpiration: selectedExp.expirationDate,
        availableExpirations,
        top10Calls: ranking.calls,
        top10Puts: ranking.puts,
        totalCallOI: ranking.totalCallOI,
        totalPutOI: ranking.totalPutOI,
        pcRatioOI: ranking.pcRatioOI,
        rankingUniverse: `${OI_UNIVERSE_STRIKES} strikes mais próximos do spot`,
        source: 'Tastytrade DXLink (Summary/Open Interest) + Nested Options API',
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Falha ao processar Top 10 de opções.' },
      { status: 500 }
    );
  }
}
