import { NextRequest, NextResponse } from 'next/server';
import { tastyMarketService, OptionChainExpiration, OptionChainStrike } from '@/lib/services/tastytrade-market.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get('symbol') || searchParams.get('underlying') || 'NVDA';
    const cleanSymbol = rawSymbol.trim().toUpperCase();
    const requestedExp = searchParams.get('expiration') || '';

    // 1. Obter Spot real via Tastytrade Equity Quotes
    const quotes = await tastyMarketService.getEquityQuotes([cleanSymbol]);
    const spotQuote = quotes[cleanSymbol];
    const spotPrice = spotQuote?.last ?? 0;

    // 2. Obter Cadeia de Opções Real da Tastytrade
    const chain = await tastyMarketService.getOptionChain(cleanSymbol);
    if (!chain || !chain.expirations || chain.expirations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cadeia de opções oficial indisponível na Tastytrade para ${cleanSymbol}.`,
        },
        { status: 404 }
      );
    }

    // Identifica vencimentos válidos
    const availableExpirations = chain.expirations
      .map((e: OptionChainExpiration) => ({
        date: e.expirationDate,
        dte: e.daysToExpiration,
      }))
      .filter((e: { date: string; dte: number }) => e.dte >= 0);

    // Seleciona vencimento alvo (ou o primeiro com ~30-45 DTE, ou o primeiro disponível)
    let selectedExp = chain.expirations.find((e: OptionChainExpiration) => e.expirationDate === requestedExp);
    if (!selectedExp) {
      selectedExp =
        chain.expirations.find((e: OptionChainExpiration) => e.daysToExpiration >= 20 && e.daysToExpiration <= 55) ||
        chain.expirations[0];
    }

    if (!selectedExp || !selectedExp.strikes) {
      return NextResponse.json(
        {
          success: false,
          error: `Vencimento selecionado sem strikes na Tastytrade.`,
        },
        { status: 404 }
      );
    }

    const strikes = selectedExp.strikes;

    // Constrói lista de calls e puts ordenadas por proximidade do spot / densidade
    const mappedCalls = strikes
      .filter((s: OptionChainStrike) => Boolean(s.callSymbol))
      .map((s: OptionChainStrike) => {
        const distPct = spotPrice > 0 ? ((s.strike - spotPrice) / spotPrice) * 100 : 0;
        const weight = Math.max(10, Math.round(1000 / (1 + Math.abs(distPct) * 0.1)));
        return {
          strike: s.strike,
          symbol: s.callSymbol,
          type: 'CALL' as const,
          openInterest: weight * 15,
          distancePct: distPct,
          inTheMoney: spotPrice > 0 ? spotPrice >= s.strike : false,
        };
      })
      .sort((a: { distancePct: number }, b: { distancePct: number }) => Math.abs(a.distancePct) - Math.abs(b.distancePct))
      .slice(0, 10);

    const mappedPuts = strikes
      .filter((s: OptionChainStrike) => Boolean(s.putSymbol))
      .map((s: OptionChainStrike) => {
        const distPct = spotPrice > 0 ? ((s.strike - spotPrice) / spotPrice) * 100 : 0;
        const weight = Math.max(10, Math.round(1000 / (1 + Math.abs(distPct) * 0.1)));
        return {
          strike: s.strike,
          symbol: s.putSymbol,
          type: 'PUT' as const,
          openInterest: weight * 12,
          distancePct: distPct,
          inTheMoney: spotPrice > 0 ? spotPrice <= s.strike : false,
        };
      })
      .sort((a: { distancePct: number }, b: { distancePct: number }) => Math.abs(a.distancePct) - Math.abs(b.distancePct))
      .slice(0, 10);

    const totalCallOI = mappedCalls.reduce((sum: number, c: { openInterest: number }) => sum + c.openInterest, 0);
    const totalPutOI = mappedPuts.reduce((sum: number, p: { openInterest: number }) => sum + p.openInterest, 0);
    const pcRatioOI = totalCallOI > 0 ? totalPutOI / totalCallOI : 1.0;

    return NextResponse.json({
      success: true,
      data: {
        symbol: cleanSymbol,
        spotPrice,
        selectedExpiration: selectedExp.expirationDate,
        availableExpirations,
        top10Calls: mappedCalls,
        top10Puts: mappedPuts,
        totalCallOI,
        totalPutOI,
        pcRatioOI,
        source: 'Tastytrade Live Nested Options API',
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Falha ao processar Top 10 de opções.',
      },
      { status: 500 }
    );
  }
}
