import { NextRequest, NextResponse } from 'next/server';
import { aiConsultantEngine } from '@/lib/domain/ai-consultant';
import { US_STOCKS_DATASET } from '@/lib/domain/us-market-data';
import { applyApiGuard, withSessionCookie } from '@/lib/security/api-guard';

export async function POST(request: NextRequest) {
  // Guarda de origem + rate limit (Achados C-07/N-04) — rota antes totalmente aberta,
  // sem limite de frequência ou de tamanho de payload.
  const guard = applyApiGuard(request, { maxRequestsPerKey: 15, windowMs: 60_000, globalMaxRequests: 300 });
  if (!guard.ok) return withSessionCookie(guard.response!, guard);

  try {
    const body = await request.json();
    const { query, symbol = 'NVDA', spotPrice, category } = body;

    if (!query || typeof query !== 'string') {
      return withSessionCookie(
        NextResponse.json(
          { success: false, error: 'O parâmetro "query" é obrigatório.' },
          { status: 400 }
        ),
        guard
      );
    }

    if (query.length > 500) {
      return withSessionCookie(
        NextResponse.json(
          { success: false, error: 'O parâmetro "query" excede o tamanho máximo permitido (500 caracteres).' },
          { status: 400 }
        ),
        guard
      );
    }

    const cleanSymbol = String(symbol).trim().toUpperCase();
    const stock = US_STOCKS_DATASET.find((s) => s.symbol === cleanSymbol);

    const response = await aiConsultantEngine.consult(query, {
      symbol: cleanSymbol,
      stock,
      spotPrice,
      category,
    });

    return withSessionCookie(
      NextResponse.json({
        success: true,
        data: response,
      }),
      guard
    );
  } catch (error: any) {
    return withSessionCookie(
      NextResponse.json(
        {
          success: false,
          error: error.message || 'Erro ao processar consulta da IA',
        },
        { status: 500 }
      ),
      guard
    );
  }
}
