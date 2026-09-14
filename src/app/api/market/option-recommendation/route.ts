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
  if (!body?.symbol) {
    return withSessionCookie(NextResponse.json({ available: false, reason: 'Campo "symbol" é obrigatório.' }, { status: 400 }), guard);
  }

  // Consulta cotação de mercado real (spot) e métricas oficiais de volatilidade (IV Rank, IV30) direto da Tastytrade
  const [equityQuotes, liveMetrics] = await Promise.all([
    tastyMarketService.getEquityQuotes([body.symbol]),
    tastyMarketService.getMarketMetrics([body.symbol]),
  ]);

  const liveSpot = equityQuotes[body.symbol]?.last ?? (typeof body.spot === 'number' && body.spot > 0 ? body.spot : null);

  if (!liveSpot || liveSpot <= 0) {
    return withSessionCookie(
      NextResponse.json({
        available: false,
        reason: `Cotação real do ativo (spot) indisponível na Tastytrade para ${body.symbol}. Não fabricamos preço para montar estratégia de opções.`,
      }),
      guard
    );
  }

  const liveMetric = liveMetrics[body.symbol];
  const liveIvr = liveMetric?.ivRank ?? body.ivr;
  const liveIvp = liveMetric?.ivPercentile ?? body.ivp;
  const liveIv30 = liveMetric?.iv30 ?? body.iv30;

  const assetInput: VolatilityAssetInput = {
    ...body,
    spot: liveSpot,
    ivr: liveIvr,
    ivp: liveIvp,
    iv30: liveIv30,
  };

  const chain = await tastyMarketService.getOptionChain(body.symbol);
  const plan = planStrategy(assetInput, chain);
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

  const [optionQuotes, greeks] = await Promise.all([
    tastyMarketService.getOptionQuotes(legOccSymbols),
    fetchRealGreeks(allStreamerSymbols, 10000),
  ]);

  const recommendation = buildRecommendation(assetInput, plan, optionQuotes, greeks, body.includeSmile ? greeks : null);
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
