import { NextRequest, NextResponse } from 'next/server';
import { tastyMarketService } from '@/lib/services/tastytrade-market.service';
import { applyApiGuard, withSessionCookie } from '@/lib/security/api-guard';

const SYMBOL_REGEX = /^[A-Z0-9.\-\/]{1,10}$/;

export async function GET(request: NextRequest) {
  // Guarda de origem + rate limit com janela deslizante
  const guard = applyApiGuard(request, { maxRequestsPerKey: 60, windowMs: 60_000, globalMaxRequests: 600 });
  if (!guard.ok) return withSessionCookie(guard.response!, guard);

  const { searchParams } = new URL(request.url);
  const symbolParam = searchParams.get('symbols') || searchParams.get('symbol') || '';
  const refresh = searchParams.get('refresh') === 'true';

  // Sanitização e validação de até 100 símbolos por requisição (limite Tastytrade)
  const rawSymbols = symbolParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const symbols = rawSymbols.filter((s) => SYMBOL_REGEX.test(s)).slice(0, 100);

  if (symbols.length === 0) {
    return withSessionCookie(
      NextResponse.json(
        { success: false, error: 'Símbolo(s) inválido(s) ou não fornecido(s).' },
        { status: 400 }
      ),
      guard
    );
  }

  try {
    const quotes = await tastyMarketService.getEquityQuotes(symbols, refresh);
    const liveCount = Object.values(quotes).filter((q) => q.source === 'tastytrade-live').length;

    return withSessionCookie(
      NextResponse.json({
        success: true,
        count: Object.keys(quotes).length,
        liveCount,
        data: quotes,
      }),
      guard
    );
  } catch (error: any) {
    return withSessionCookie(
      NextResponse.json(
        {
          success: false,
          error: 'Erro temporário ao consultar cotações de ações na corretora.',
        },
        { status: 500 }
      ),
      guard
    );
  }
}
