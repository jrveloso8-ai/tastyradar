import { NextRequest, NextResponse } from 'next/server';
import { aiConsultantEngine } from '@/lib/domain/ai-consultant';
import { US_STOCKS_DATASET } from '@/lib/domain/us-market-data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, symbol = 'NVDA', spotPrice, category } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'O parâmetro "query" é obrigatório.' },
        { status: 400 }
      );
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const stock = US_STOCKS_DATASET.find((s) => s.symbol === cleanSymbol);

    const response = await aiConsultantEngine.consult(query, {
      symbol: cleanSymbol,
      stock,
      spotPrice,
      category,
    });

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao processar consulta da IA',
      },
      { status: 500 }
    );
  }
}
