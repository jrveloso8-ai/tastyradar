import { NextRequest, NextResponse } from 'next/server';
import { tastyMarketService } from '@/lib/services/tastytrade-market.service';

const SYMBOL_REGEX = /^[A-Z0-9.\-\/]{1,10}$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolParam = searchParams.get('symbols') || searchParams.get('symbol') || 'SPY';
  const refresh = searchParams.get('refresh') === 'true';

  // 1. Sanitização e Validação Estrita de Símbolos (Achado A-05)
  const rawSymbols = symbolParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const symbols = rawSymbols.filter((s) => SYMBOL_REGEX.test(s)).slice(0, 25); // Limite máximo de 25 símbolos

  if (symbols.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Símbolo(s) inválido(s) ou não fornecido(s).' },
      { status: 400 }
    );
  }

  try {
    const metrics = await tastyMarketService.getMarketMetrics(symbols, refresh);
    const isLive = Object.values(metrics).some((m) => m.source === 'tastytrade-live');

    return NextResponse.json({
      success: true,
      live: isLive,
      count: Object.keys(metrics).length,
      data: metrics,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Erro temporário ao consultar serviço de métricas.',
      },
      { status: 500 }
    );
  }
}
