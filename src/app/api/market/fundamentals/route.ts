import { NextRequest, NextResponse } from 'next/server';
import { applyApiGuard, withSessionCookie } from '@/lib/security/api-guard';
import { brapiService } from '@/lib/services/brapi.service';
import { fundamentalsEngine } from '@/lib/domain/fundamentals-engine';
import { US_STOCKS_DATASET } from '@/lib/domain/us-market-data';
import { RawFundamentalData } from '@/lib/types/financial';

export async function GET(request: NextRequest) {
  // Guarda de origem + rate limit (Achados C-07/N-04) — rota antes totalmente aberta.
  const guard = applyApiGuard(request, { maxRequestsPerKey: 20, windowMs: 60_000, globalMaxRequests: 400 });
  if (!guard.ok) return withSessionCookie(guard.response!, guard);

  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get('symbol');
  const SYMBOL_REGEX = /^[A-Z0-9.]{1,10}$/;
  if (!rawSymbol || !rawSymbol.trim() || !SYMBOL_REGEX.test(rawSymbol.trim().toUpperCase())) {
    return withSessionCookie(
      NextResponse.json(
        { success: false, error: 'Parâmetro symbol inválido (ex: ?symbol=AAPL ou ?symbol=VALE3)' },
        { status: 400 }
      ),
      guard
    );
  }
  const symbol = rawSymbol.trim().toUpperCase();

  try {
    // 1. Verifica se é um ativo do dataset US
    const usStock = US_STOCKS_DATASET.find((s) => s.symbol === symbol);

    if (usStock) {
      const rawData: RawFundamentalData = {
        symbol: usStock.symbol,
        shortName: usStock.name,
        regularMarketPrice: usStock.spot,
        returnOnEquity: usStock.roe / 100,
        netMargin: usStock.netMargin / 100,
        debtToEbitda: usStock.debtToEbitda,
        priceEarnings: usStock.peRatio,
        dividendYield: usStock.dividendYield / 100,
        // currentRatio/ebitdaMargin/priceToBook não são levantados para os tickers de
        // US_STOCKS_DATASET (diferente do branch BRAPI abaixo, que traz esses 3 campos
        // reais da API). Antes eram constantes fixas (1.5/0.30/2.0) aplicadas idênticas
        // aos ~64 tickers — como os 3 caíam exatamente no limiar "BOM" do fundamentals-
        // engine, todo ticker recebia nota máxima nesses critérios (100 dos pontos de
        // Rentabilidade+Solvência+Valuation), mascarando diferença real entre ativos.
        // O motor já trata `null` como "Dado não disponível na fonte" (Achado Nível 3,
        // Ciclo 4) — corrigido nesta sessão em conjunto com QuoteView.tsx, que tinha sua
        // própria cópia divergente (1.45/0.28) da mesma fabricação.
        currentRatio: null,
        ebitdaMargin: null,
        priceToBook: null,
      };

      const result = fundamentalsEngine.evaluate(rawData);
      return withSessionCookie(NextResponse.json({ success: true, data: result }), guard);
    }

    // 2. Consulta via BRAPI Service com cashflowHistory e isolamento de dívida financeira
    const rawData = await brapiService.getFundamentals(symbol);
    const result = fundamentalsEngine.evaluate(rawData);

    return withSessionCookie(
      NextResponse.json({
        success: true,
        data: result,
        raw: rawData,
      }),
      guard
    );
  } catch (error: any) {
    return withSessionCookie(
      NextResponse.json(
        {
          success: false,
          error: error.message || 'Erro ao processar crivo fundamentalista',
        },
        { status: 500 }
      ),
      guard
    );
  }
}
