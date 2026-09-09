import { NextRequest, NextResponse } from 'next/server';
import { tastyMarketService } from '@/lib/services/tastytrade-market.service';
import { applyApiGuard, withSessionCookie } from '@/lib/security/api-guard';

const SYMBOL_REGEX = /^[A-Z0-9.\-\/]{1,10}$/;

export async function GET(request: NextRequest) {
  // Guarda de origem + rate limit (Achados C-07/N-04) — rota antes totalmente aberta.
  const guard = applyApiGuard(request, { maxRequestsPerKey: 30, windowMs: 60_000, globalMaxRequests: 600 });
  if (!guard.ok) return withSessionCookie(guard.response!, guard);

  const { searchParams } = new URL(request.url);
  const symbolParam = searchParams.get('symbols') || searchParams.get('symbol') || 'SPY';
  const refresh = searchParams.get('refresh') === 'true';

  // 1. Sanitização e Validação Estrita de Símbolos (Achado A-05)
  const rawSymbols = symbolParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const symbols = rawSymbols.filter((s) => SYMBOL_REGEX.test(s)).slice(0, 25); // Limite máximo de 25 símbolos

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
    const metrics = await tastyMarketService.getMarketMetrics(symbols, refresh);
    const isLive = Object.values(metrics).some((m) => m.source === 'tastytrade-live');

    return withSessionCookie(
      NextResponse.json({
        success: true,
        live: isLive,
        count: Object.keys(metrics).length,
        data: metrics,
      }),
      guard
    );
  } catch (error: any) {
    return withSessionCookie(
      NextResponse.json(
        {
          success: false,
          error: 'Erro temporário ao consultar serviço de métricas.',
        },
        { status: 500 }
      ),
      guard
    );
  }
}
