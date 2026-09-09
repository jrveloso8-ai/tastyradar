import { NextRequest, NextResponse } from 'next/server';
import { applyApiGuard, withSessionCookie } from '@/lib/security/api-guard';
import { tastyMarketService } from '@/lib/services/tastytrade-market.service';
import { fetchRealGreeks } from '@/lib/services/tastytrade-dxlink.service';
import { planStrategy, buildRecommendation, VolatilityAssetInput } from '@/lib/domain/volatility-engine';

/**
 * Orquestra a Frente 1 ("só dados reais", diretriz do usuário em 2026-09-08): busca a
 * cadeia real (getOptionChain), escolhe estratégia/strikes/vencimento reais
 * (planStrategy), busca cotação real por perna (getOptionQuotes, REST) e gregas/IV
 * reais por streaming (fetchRealGreeks, DXLink) em paralelo, e monta a recomendação
 * final (buildRecommendation). Se qualquer etapa não confirmar dado real, a resposta
 * é `{ available: false, reason }` — nunca uma recomendação com dado fabricado.
 *
 * ATENÇÃO OPERACIONAL: a etapa de streaming DXLink mantém a conexão aberta por até
 * ~10s (mais autenticação/REST) para coletar os eventos FEED_DATA. Em Vercel, o plano
 * Hobby limita funções serverless a 10s por padrão — este endpoint pode precisar de
 * plano Pro (ou runtime com maxDuration maior) para não estourar o timeout. Verificar
 * o plano de deploy antes de considerar esta rota "pronta em produção".
 */
export const maxDuration = 30;

interface RequestBody extends VolatilityAssetInput {
  includeSmile?: boolean;
}

export async function POST(request: NextRequest) {
  const guard = applyApiGuard(request, { maxRequestsPerKey: 10, windowMs: 60_000, globalMaxRequests: 120 });
  if (!guard.ok) return withSessionCookie(guard.response!, guard);

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return withSessionCookie(NextResponse.json({ available: false, reason: 'Payload inválido.' }, { status: 400 }), guard);
  }
  if (!body?.symbol || typeof body.spot !== 'number') {
    return withSessionCookie(NextResponse.json({ available: false, reason: 'Campos "symbol" e "spot" são obrigatórios.' }, { status: 400 }), guard);
  }

  const chain = await tastyMarketService.getOptionChain(body.symbol);
  const plan = planStrategy(body, chain);
  if (!plan) {
    return withSessionCookie(
      NextResponse.json({
        available: false,
        reason: chain
          ? 'Cadeia de opções real obtida, mas sem vencimento/strikes utilizáveis nas faixas-alvo da estratégia.'
          : 'Cadeia de opções real indisponível para este ativo neste momento (API Tastytrade não respondeu ou símbolo sem opções listadas).',
      }),
      guard
    );
  }

  const legOccSymbols = plan.legs.map((l) => l.occSymbol);
  const legStreamerSymbols = plan.legs.map((l) => l.streamerSymbol);
  const smileStreamerSymbols = body.includeSmile
    ? plan.expiration.strikes.flatMap((s) => [s.callStreamerSymbol, s.putStreamerSymbol])
    : [];
  const allStreamerSymbols = Array.from(new Set([...legStreamerSymbols, ...smileStreamerSymbols]));

  const [quotes, greeks] = await Promise.all([
    tastyMarketService.getOptionQuotes(legOccSymbols),
    fetchRealGreeks(allStreamerSymbols, 10000),
  ]);

  const recommendation = buildRecommendation(body, plan, quotes, greeks, body.includeSmile ? greeks : null);
  if (!recommendation) {
    return withSessionCookie(
      NextResponse.json({
        available: false,
        reason: 'Cotação real de mercado (bid/ask/mid) indisponível para uma ou mais pernas da estrutura eleita neste momento.',
      }),
      guard
    );
  }

  return withSessionCookie(NextResponse.json({ available: true, recommendation }), guard);
}
