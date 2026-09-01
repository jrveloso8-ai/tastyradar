import { NextRequest, NextResponse } from 'next/server';
import { brapiService } from '@/lib/services/brapi.service';
import { fundamentalsEngine } from '@/lib/domain/fundamentals-engine';
import { US_STOCKS_DATASET } from '@/lib/domain/us-market-data';
import { RawFundamentalData } from '@/lib/types/financial';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get('symbol') || 'VALE3';
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
        currentRatio: 1.5,
        ebitdaMargin: 0.30,
        priceToBook: 2.0,
      };

      const result = fundamentalsEngine.evaluate(rawData);
      return NextResponse.json({ success: true, data: result });
    }

    // 2. Consulta via BRAPI Service com cashflowHistory e isolamento de dívida financeira
    const rawData = await brapiService.getFundamentals(symbol);
    const result = fundamentalsEngine.evaluate(rawData);

    return NextResponse.json({
      success: true,
      data: result,
      raw: rawData,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao processar crivo fundamentalista',
      },
      { status: 500 }
    );
  }
}
