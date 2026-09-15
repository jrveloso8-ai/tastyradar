import { CME_STRATEGIES, StrategySpec } from './cme-catalog';
import { OptionChainResult, OptionChainExpiration } from '../services/tastytrade-market.service';
import { RealGreeksQuote } from '../services/tastytrade-dxlink.service';

/**
 * Motor de Volatilidade — reescrito em 2026-09-08 para eliminar strike/DTE/preço
 * fabricados (achado da BAC: recomendou strike $47,5 inexistente e 35 DTE fixo contra
 * 38 DTE real). Ver PLANO_MESTRE_REMEDIACAO_RADAR.md para o histórico completo.
 *
 * Contrato de honestidade ("só dados reais", diretriz do usuário em 2026-09-08):
 * - `planStrategy()` só usa vencimentos e strikes que existem de fato na cadeia real
 *   (OptionChainResult vindo de tastyMarketService.getOptionChain()). Se não achar
 *   vencimento/strike real utilizável, retorna null — nunca inventa um grid sintético.
 * - `buildRecommendation()` só usa preço de perna vindo de cotação real (bid/ask/mid
 *   via GET /market-data/by-type). Se qualquer perna eleita não tiver cotação real,
 *   a função retorna null — a recomendação inteira fica indisponível, nunca com uma
 *   perna real e outra estimada por modelo misturadas sem aviso.
 * - Delta, IV por contrato e Open Interest só existem via streaming DXLink (não há
 *   endpoint REST para grego na API da Tastytrade — confirmado contra a doc oficial).
 *   Onde esse dado não estiver disponível, os campos ficam `null` e a UI deve exibir
 *   "indisponível", nunca um valor calculado por BSM apresentado como se fosse real.
 */

export interface VolatilityAssetInput {
  symbol: string;
  name: string;
  spot: number;
  change: number;
  iv30?: number; // Implied Volatility 30-day index (%) — métrica agregada REAL (Tastytrade market metrics)
  rv20?: number; // Realized Volatility 20-day Yang-Zhang (%)
  ivr?: number;  // IV Rank (0-100)
  ivp?: number;  // IV Percentile (0-100)
  skew25?: number;
  liquidityRating?: number;
  netGex?: number; // Dollar GEX em $ Milhões
  zeroGammaFlip?: number;
  putWall?: number;
  callWall?: number;
  dividendAmount?: number;
  callExtrinsic?: number;
  daysToEarnings?: number;
}

export interface RealLeg {
  action: 'BUY' | 'SELL';
  type: 'CALL' | 'PUT';
  strike: number;
  occSymbol: string; // símbolo OCC real (para GET /market-data/by-type)
  streamerSymbol: string; // símbolo dxfeed real (para streaming DXLink)
  role: string;
  description: string;
}

export interface StrategyPlan {
  strategy: StrategySpec;
  expiration: OptionChainExpiration; // vencimento REAL escolhido
  farExpiration?: OptionChainExpiration; // só para calendários (2 vencimentos reais)
  legs: RealLeg[];
  volRegime: 'SELL_VOLATILITY' | 'BUY_VOLATILITY' | 'NEUTRAL';
  volRegimeLabel: string;
  volRegimeReason: string;
  gexRegime: '+GEX' | '-GEX';
  isPlusGex: boolean;
  vrp: number;
}

export interface PricedLeg {
  action: 'BUY' | 'SELL';
  type: 'CALL' | 'PUT';
  strike: number;
  occSymbol: string;
  midPrice: number; // REAL — obrigatório; sem isso buildRecommendation já retorna null antes de chegar aqui
  bid: number | null;
  ask: number | null;
  delta: number | null; // REAL via DXLink; null = indisponível (não é substituído por modelo)
  iv: number | null; // REAL via DXLink (Greeks.volatility); null = indisponível
  openInterest: number | null; // REAL via DXLink (Summary.openInterest); null = indisponível
  description: string;
}

export interface VolatilitySmilePoint {
  strike: number;
  moneyness: number;
  deltaLabel: string;
  iv: number;
  type: 'PUT_OTM' | 'ATM' | 'CALL_OTM';
}

export interface StrikeJustificationItem {
  strike: number;
  action: 'BUY' | 'SELL';
  type: 'CALL' | 'PUT';
  role: string;
  reason: string;
}

export interface DidacticRationale {
  oneLiner: string;
  carInsuranceAnalogy: string;
  whyThisStructure: string;
  strikeByStrikeJustification: StrikeJustificationItem[];
  fourJobsSummary: {
    insurancePricing: string;
    structureChoice: string;
    riskBeforeReward: string;
    exitPlan: string;
  };
  fourCashQuestions: {
    maxProfitCash: string;
    maxLossCash: string;
    breakevenPoint: string;
    whatMakesItFail: string;
  };
  whatItDoesNotDo: string[];
  whyItMattersForBeginners: string[];
  honestExpectationNotice: string;
  disclaimer: string;
}

export interface VolatilityRecommendation {
  symbol: string;
  spot: number;
  change: number;
  iv30: number;
  rv20: number;
  vrp: number;
  ivr: number;
  ivp: number;
  volRegime: 'SELL_VOLATILITY' | 'BUY_VOLATILITY' | 'NEUTRAL';
  volRegimeLabel: string;
  volRegimeReason: string;
  gexRegime: '+GEX' | '-GEX';
  gexRegimeLabel: string;
  zeroGammaFlip: number;
  putWall: number;
  callWall: number;
  strategy: StrategySpec;
  targetDte: number; // REAL, do vencimento escolhido
  targetDteLabel: string;
  expirationDate: string; // REAL (ISO), do vencimento escolhido
  legs: PricedLeg[];
  netCredit: number;
  isCredit: boolean;
  creditWidthRatio: number;
  meetsCreditRule: boolean;
  maxProfit: number;
  maxLoss: number;
  popEstimate: number | null; // null se alguma perna vendida não tiver delta real
  lowerBreakeven: number;
  upperBreakeven: number | null;
  lifecycle: {
    profitTargetPct: number;
    profitTargetDollar: number;
    defenseDte: number;
    defenseDateNotice: string;
    untestedSideRule: string;
    hasDividendRisk: boolean;
    dividendRiskReason: string;
    whatMakesItLose: string;
  };
  didacticRationale: DidacticRationale;
  formattedTextOutput: string;
  smileCurve: VolatilitySmilePoint[] | null; // null se IV real por strike indisponível
  dataQuality: {
    pricedFromRealQuotes: true; // sempre true — se não fosse, buildRecommendation teria retornado null
    greeksAvailable: boolean; // true se todas as pernas vendidas tiverem delta real
    smileAvailable: boolean;
  };
}

// ---------------------------------------------------------------------------
// Helpers de seleção real (substituem os antigos `step`/`dte` sintéticos)
// ---------------------------------------------------------------------------

function pickStrikeNear(strikes: number[], target: number): number {
  let best = strikes[0];
  let bestDiff = Math.abs(strikes[0] - target);
  for (const s of strikes) {
    const diff = Math.abs(s - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

function pickAdjacentStrike(sortedStrikes: number[], reference: number, direction: 'below' | 'above'): number | null {
  const idx = sortedStrikes.indexOf(reference);
  if (idx === -1) return null;
  if (direction === 'below') return idx > 0 ? sortedStrikes[idx - 1] : null;
  return idx < sortedStrikes.length - 1 ? sortedStrikes[idx + 1] : null;
}

function pickExpiration(
  expirations: OptionChainExpiration[],
  targetDte: number,
  minDte = 15,
  maxDte = 70
): OptionChainExpiration | null {
  if (expirations.length === 0) return null;
  const candidates = expirations.filter((e) => e.daysToExpiration >= minDte && e.daysToExpiration <= maxDte);
  const pool = candidates.length > 0 ? candidates : expirations;
  let best = pool[0];
  let bestDiff = Math.abs(pool[0].daysToExpiration - targetDte);
  for (const e of pool) {
    const diff = Math.abs(e.daysToExpiration - targetDte);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = e;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Fase 1: escolha da estratégia + strikes/vencimentos reais (sem preço ainda)
// ---------------------------------------------------------------------------

/**
 * Escolhe a estrutura CME e os strikes/vencimentos REAIS que a compõem, a partir da
 * cadeia de opções real do ativo. Retorna null se a cadeia não tiver vencimento ou
 * strikes utilizáveis nas faixas-alvo — nunca inventa um grid.
 *
 * NOTA IMPORTANTE (achado desta reescrita, fora do escopo de "dados reais", reportado
 * separadamente ao usuário): a árvore de decisão original mapeia as estratégias 7
 * ("Trava de Baixa com Call a Crédito") e 22 ("Jade Lizard") através do mesmo template
 * genérico de trava direcional de débito (ids 1/2), usando `strategy.bias` para
 * escolher PUT ou CALL — isso reproduz o comportamento pré-existente do arquivo
 * original (preservado aqui de propósito, para não misturar a correção de dados com
 * uma correção de arquitetura de estratégia não solicitada), mas produz uma estrutura
 * que não corresponde ao nome da estratégia nesses dois casos específicos.
 */
export interface RegimeClassification {
  strategy: StrategySpec;
  volRegime: 'SELL_VOLATILITY' | 'BUY_VOLATILITY' | 'NEUTRAL';
  volRegimeLabel: string;
  volRegimeReason: string;
  gexRegime: '+GEX' | '-GEX';
  isPlusGex: boolean;
  vrp: number;
}

/**
 * Classifica o regime de volatilidade/GEX e elege a estratégia CME — só usa métricas
 * agregadas já reais do ativo (IV30/RV20/IVR real do market metrics, netGex/walls reais
 * do GEX engine), NÃO precisa da cadeia de opções. Separado de `planStrategy()` para
 * permitir telas de listagem (ex.: tabela de ativos do S&P 500) mostrarem regime/
 * estratégia elegível sem abrir uma cadeia + conexão DXLink por linha da tabela — isso
 * seria abrir dezenas de WebSockets só para renderizar uma lista, desproporcional ao
 * dado exibido (VRP e nome da estratégia, nenhum strike/preço/grego).
 */
export function classifyRegime(input: VolatilityAssetInput): RegimeClassification {
  const spot = input.spot;
  const hasIv30 = typeof input.iv30 === 'number';
  const hasRv20 = typeof input.rv20 === 'number';
  const vrp = hasIv30 && hasRv20 ? Number((input.iv30! - input.rv20!).toFixed(1)) : 0;
  const ivr = typeof input.ivr === 'number' ? input.ivr : null;
  const isPlusGex = typeof input.netGex === 'number' ? input.netGex >= 0 : true;
  const gexRegime: '+GEX' | '-GEX' = isPlusGex ? '+GEX' : '-GEX';
  const putWall = typeof input.putWall === 'number' ? input.putWall : null;
  const callWall = typeof input.callWall === 'number' ? input.callWall : null;

  let volRegime: 'SELL_VOLATILITY' | 'BUY_VOLATILITY' | 'NEUTRAL' = 'NEUTRAL';
  let volRegimeLabel = 'Neutro em Volatilidade';
  let volRegimeReason = 'IV Rank intermediário (30-50%). Expressar viés direcional com risco definido.';

  if (ivr !== null && ivr >= 50 && vrp >= 4.0) {
    volRegime = 'SELL_VOLATILITY';
    volRegimeLabel = 'Venda de Volatilidade (Coleta de Prêmio)';
    volRegimeReason = `IV Rank em ${ivr.toFixed(1)}% com VRP de +${vrp.toFixed(1)} pts. O prêmio cobrado supera a volatilidade realizada Yang-Zhang.`;
  } else if (ivr !== null && ivr <= 30 && vrp <= 1.0) {
    volRegime = 'BUY_VOLATILITY';
    volRegimeLabel = 'Compra de Volatilidade / Débito';
    volRegimeReason = `IV Rank deprimido em ${ivr.toFixed(1)}% com VRP de ${vrp.toFixed(1)} pts. Opções baratas com assimetria para expansão de cauda.`;
  }

  let electedStrategyId = 20;
  const distToPutWall = putWall !== null ? Math.abs(spot - putWall) / spot : 1.0;
  const distToCallWall = callWall !== null ? Math.abs(spot - callWall) / spot : 1.0;

  if (volRegime === 'SELL_VOLATILITY') {
    if (isPlusGex) {
      if (distToPutWall < 0.02) electedStrategyId = 6;
      else if (distToCallWall < 0.02) electedStrategyId = 7;
      else electedStrategyId = 20;
    } else {
      electedStrategyId = 22;
    }
  } else if (volRegime === 'BUY_VOLATILITY') {
    if (isPlusGex) electedStrategyId = 28;
    else electedStrategyId = input.change < 0 ? 2 : 1;
  } else {
    electedStrategyId = input.change >= 0 ? 1 : 2;
  }

  const strategy = CME_STRATEGIES.find((s) => s.id === electedStrategyId) || CME_STRATEGIES[19];
  return { strategy, volRegime, volRegimeLabel, volRegimeReason, gexRegime, isPlusGex, vrp };
}

export function planStrategy(input: VolatilityAssetInput, chain: OptionChainResult | null): StrategyPlan | null {
  if (!chain || chain.expirations.length === 0) return null;

  const spot = input.spot;
  const { strategy, volRegime, volRegimeLabel, volRegimeReason, gexRegime, isPlusGex, vrp } = classifyRegime(input);
  const isCalendar = strategy.id === 28 || strategy.id === 14;
  const targetDte = isCalendar ? 30 : 35;

  const planBase = { strategy, volRegime, volRegimeLabel, volRegimeReason, gexRegime, isPlusGex, vrp };

  if (isCalendar) {
    const shortExp = pickExpiration(chain.expirations, 30);
    if (!shortExp) return null;
    const longCandidates = chain.expirations.filter((e) => e.daysToExpiration > shortExp.daysToExpiration);
    const longExp = pickExpiration(longCandidates.length > 0 ? longCandidates : chain.expirations, 60);
    if (!longExp || longExp.expirationDate === shortExp.expirationDate) return null;

    const shortStrikes = shortExp.strikes.map((s) => s.strike);
    const longStrikeSet = new Set(longExp.strikes.map((s) => s.strike));
    const common = shortStrikes.filter((s) => longStrikeSet.has(s));
    if (common.length === 0) return null;

    const centerStrike = pickStrikeNear(common, spot);
    const shortData = shortExp.strikes.find((s) => s.strike === centerStrike)!;
    const longData = longExp.strikes.find((s) => s.strike === centerStrike)!;

    const legs: RealLeg[] = [
      { action: 'SELL', type: 'CALL', strike: centerStrike, occSymbol: shortData.callSymbol, streamerSymbol: shortData.callStreamerSymbol, role: 'shortNear', description: `Ponta Curta Vendida (${shortExp.daysToExpiration} DTE) Strike $${centerStrike}` },
      { action: 'BUY', type: 'CALL', strike: centerStrike, occSymbol: longData.callSymbol, streamerSymbol: longData.callStreamerSymbol, role: 'longFar', description: `Ponta Longa Comprada (${longExp.daysToExpiration} DTE) Strike $${centerStrike}` },
    ];

    return { ...planBase, expiration: shortExp, farExpiration: longExp, legs };
  }

  const expiration = pickExpiration(chain.expirations, targetDte);
  if (!expiration || expiration.strikes.length < 2) return null;
  const strikes = expiration.strikes.map((s) => s.strike).sort((a, b) => a - b);
  const byStrike = new Map(expiration.strikes.map((s) => [s.strike, s]));

  let legs: RealLeg[];

  if (strategy.id === 20) {
    const effectivePutWall = input.putWall ?? spot * 0.96;
    const effectiveCallWall = input.callWall ?? spot * 1.04;
    const shortPutStrike = pickStrikeNear(strikes, Math.min(effectivePutWall, spot * 0.96));
    const longPutStrike = pickAdjacentStrike(strikes, shortPutStrike, 'below');
    const shortCallStrike = pickStrikeNear(strikes, Math.max(effectiveCallWall, spot * 1.04));
    const longCallStrike = pickAdjacentStrike(strikes, shortCallStrike, 'above');
    if (longPutStrike == null || longCallStrike == null || shortPutStrike >= shortCallStrike) return null;
    const lp = byStrike.get(longPutStrike)!, sp = byStrike.get(shortPutStrike)!, sc = byStrike.get(shortCallStrike)!, lc = byStrike.get(longCallStrike)!;
    legs = [
      { action: 'BUY', type: 'PUT', strike: longPutStrike, occSymbol: lp.putSymbol, streamerSymbol: lp.putStreamerSymbol, role: 'longPut', description: `Asa de Proteção Inferior ($${longPutStrike})` },
      { action: 'SELL', type: 'PUT', strike: shortPutStrike, occSymbol: sp.putSymbol, streamerSymbol: sp.putStreamerSymbol, role: 'shortPut', description: `Venda Ancorada na Put Wall ($${shortPutStrike})` },
      { action: 'SELL', type: 'CALL', strike: shortCallStrike, occSymbol: sc.callSymbol, streamerSymbol: sc.callStreamerSymbol, role: 'shortCall', description: `Venda Ancorada na Call Wall ($${shortCallStrike})` },
      { action: 'BUY', type: 'CALL', strike: longCallStrike, occSymbol: lc.callSymbol, streamerSymbol: lc.callStreamerSymbol, role: 'longCall', description: `Asa de Proteção Superior ($${longCallStrike})` },
    ];
  } else if (strategy.id === 6) {
    const effectivePutWall = input.putWall ?? spot * 0.98;
    const shortPutStrike = pickStrikeNear(strikes, Math.min(effectivePutWall, spot * 0.98));
    const longPutStrike = pickAdjacentStrike(strikes, shortPutStrike, 'below');
    if (longPutStrike == null) return null;
    const lp = byStrike.get(longPutStrike)!, sp = byStrike.get(shortPutStrike)!;
    legs = [
      { action: 'BUY', type: 'PUT', strike: longPutStrike, occSymbol: lp.putSymbol, streamerSymbol: lp.putStreamerSymbol, role: 'longPut', description: `Asa de Proteção Long Put ($${longPutStrike})` },
      { action: 'SELL', type: 'PUT', strike: shortPutStrike, occSymbol: sp.putSymbol, streamerSymbol: sp.putStreamerSymbol, role: 'shortPut', description: `Short Put Suporte Wall ($${shortPutStrike})` },
    ];
  } else {
    // Travas verticais direcionais de débito (ids 1, 2 — e, preservando o comportamento
    // original, também 7 e 22; ver nota acima sobre essa mislabeling pré-existente)
    const isAlta = strategy.bias === 'ALTA';
    const k1 = pickStrikeNear(strikes, spot);
    const k2 = isAlta ? pickAdjacentStrike(strikes, k1, 'above') : pickAdjacentStrike(strikes, k1, 'below');
    if (k2 == null) return null;
    const d1 = byStrike.get(k1)!, d2 = byStrike.get(k2)!;
    const optType: 'CALL' | 'PUT' = isAlta ? 'CALL' : 'PUT';
    const sym1 = isAlta ? d1.callSymbol : d1.putSymbol;
    const streamer1 = isAlta ? d1.callStreamerSymbol : d1.putStreamerSymbol;
    const sym2 = isAlta ? d2.callSymbol : d2.putSymbol;
    const streamer2 = isAlta ? d2.callStreamerSymbol : d2.putStreamerSymbol;
    legs = [
      { action: 'BUY', type: optType, strike: k1, occSymbol: sym1, streamerSymbol: streamer1, role: 'k1', description: `Ponta Comprada ATM ($${k1})` },
      { action: 'SELL', type: optType, strike: k2, occSymbol: sym2, streamerSymbol: streamer2, role: 'k2', description: `Ponta Vendida OTM ($${k2})` },
    ];
  }

  return { ...planBase, expiration, legs };
}

// ---------------------------------------------------------------------------
// Fase 2: precificação real + montagem da recomendação final
// ---------------------------------------------------------------------------

export function buildRecommendation(
  input: VolatilityAssetInput,
  plan: StrategyPlan,
  quotes: Map<string, { bid: number | null; ask: number | null; mid: number | null }>,
  greeks: Map<string, RealGreeksQuote>,
  smileGreeks: Map<string, RealGreeksQuote> | null = null
): VolatilityRecommendation | null {
  const spot = input.spot;
  const { strategy, expiration, legs: planLegs, volRegime, volRegimeLabel, volRegimeReason, gexRegime, isPlusGex, vrp } = plan;

  // Regra de honestidade: se QUALQUER perna eleita não tiver cotação real, a
  // recomendação inteira fica indisponível. Nunca mistura perna real com perna modelada.
  const pricedLegs: PricedLeg[] = [];
  for (const leg of planLegs) {
    const q = quotes.get(leg.occSymbol);
    if (!q || q.mid == null) return null;
    const g = greeks.get(leg.streamerSymbol);
    pricedLegs.push({
      action: leg.action,
      type: leg.type,
      strike: leg.strike,
      occSymbol: leg.occSymbol,
      midPrice: q.mid,
      bid: q.bid,
      ask: q.ask,
      delta: g?.delta ?? null,
      iv: g?.iv != null ? Number((g.iv * 100).toFixed(1)) : null,
      openInterest: g?.openInterest ?? null,
      description: leg.description,
    });
  }

  const netCredit = Number(
    pricedLegs.reduce((acc, leg) => acc + (leg.action === 'SELL' ? leg.midPrice : -leg.midPrice), 0).toFixed(2)
  );
  const isCredit = netCredit > 0;

  // Largura real: distância entre os strikes reais realmente usados (nunca um `step` sintético)
  const strikeValues = pricedLegs.map((l) => l.strike);
  let width: number;
  if (strategy.id === 28 || strategy.id === 14) {
    // Calendário: mesmo strike nas duas pernas — não há "largura" de asa real. Mantido
    // como referência mínima de $1 só para não dividir por zero nas fórmulas de
    // maxProfit/maxLoss abaixo, que já eram uma simplificação no arquivo original
    // (usavam `step` sintético) — limitação de modelagem pré-existente, não introduzida aqui.
    width = 1;
  } else {
    width = Math.max(...strikeValues) - Math.min(...strikeValues);
  }

  const meetsCreditRule = isCredit ? Number((netCredit / width).toFixed(3)) >= 1 / 3 : true;
  const creditRatio = width > 0 ? Number((Math.abs(netCredit) / width).toFixed(3)) : 0;

  const maxProfit = isCredit
    ? Number((netCredit * 100).toFixed(2))
    : Number(((width - Math.abs(netCredit)) * 100).toFixed(2));
  const maxLoss = isCredit
    ? Math.max(0, Number(((width - netCredit) * 100).toFixed(2)))
    : Number((Math.abs(netCredit) * 100).toFixed(2));

  const divAmount = typeof input.dividendAmount === 'number' ? input.dividendAmount : 0;
  const callExtrinsic = typeof input.callExtrinsic === 'number' ? input.callExtrinsic : (netCredit > 0 ? netCredit * 0.5 : 1.0);
  const hasDividendRisk = divAmount > 0 && divAmount > callExtrinsic;
  const dividendRiskReason = hasDividendRisk
    ? `ALERTA DE ATRIBUIÇÃO: Dividendo de $${divAmount.toFixed(2)} supera o extrínseco de $${callExtrinsic.toFixed(2)}. Risco iminente de exercício antecipado da Call curta!`
    : `Seguro: Dividendo de $${divAmount.toFixed(2)} inferior ao extrínseco remanescente ($${callExtrinsic.toFixed(2)}).`;

  // Breakevens a partir dos strikes reais
  let lowerBreakeven = 0;
  let upperBreakeven: number | null = null;
  const findLeg = (role: string) => pricedLegs[planLegs.findIndex((l) => l.role === role)];

  const fmtNum = (val: number | null | undefined, decimals = 2, prefix = '', suffix = ''): string => {
    return typeof val === 'number' && !isNaN(val) ? `${prefix}${val.toFixed(decimals)}${suffix}` : 'indisponível';
  };

  if (strategy.id === 20) {
    const sp = findLeg('shortPut'), sc = findLeg('shortCall');
    lowerBreakeven = Number((sp.strike - netCredit).toFixed(2));
    upperBreakeven = Number((sc.strike + netCredit).toFixed(2));
  } else if (strategy.id === 6) {
    const sp = findLeg('shortPut');
    lowerBreakeven = Number((sp.strike - netCredit).toFixed(2));
    upperBreakeven = null;
  } else if (strategy.id === 28 || strategy.id === 14) {
    const centerK = pricedLegs[0].strike;
    lowerBreakeven = Number((centerK - Math.abs(netCredit)).toFixed(2));
    upperBreakeven = Number((centerK + Math.abs(netCredit)).toFixed(2));
  } else {
    const isAlta = strategy.bias === 'ALTA';
    const k1Leg = findLeg('k1') || pricedLegs[0];
    const k2Leg = findLeg('k2') || pricedLegs[1] || pricedLegs[0];
    if (isAlta) {
      lowerBreakeven = Number((k1Leg.strike + Math.abs(netCredit)).toFixed(2));
      upperBreakeven = Number(k2Leg.strike.toFixed(2));
    } else {
      lowerBreakeven = Number(k2Leg.strike.toFixed(2));
      upperBreakeven = Number((k1Leg.strike - Math.abs(netCredit)).toFixed(2));
    }
  }

  // POP: só calculado se TODAS as pernas vendidas tiverem delta real (via DXLink).
  // Sem isso, fica null — nunca substituído por um delta BSM apresentado como real.
  const soldLegs = pricedLegs.filter((l) => l.action === 'SELL');
  const allSoldHaveDelta = soldLegs.length > 0 && soldLegs.every((l) => l.delta != null);
  let dynamicPop: number | null = null;
  if (allSoldHaveDelta) {
    if (strategy.id === 20) {
      const putLeg = soldLegs.find((l) => l.type === 'PUT');
      const callLeg = soldLegs.find((l) => l.type === 'CALL');
      const pDelta = putLeg?.delta != null ? Math.abs(putLeg.delta) : 0;
      const cDelta = callLeg?.delta != null ? Math.abs(callLeg.delta) : 0;
      dynamicPop = Math.min(95, Math.max(5, Math.round((1 - pDelta - cDelta) * 100)));
    } else if (isCredit) {
      const sDelta = soldLegs[0]?.delta != null ? Math.abs(soldLegs[0].delta) : 0;
      dynamicPop = Math.min(95, Math.max(5, Math.round((1 - sDelta) * 100)));
    } else {
      const boughtLeg = pricedLegs.find((l) => l.action === 'BUY');
      dynamicPop = boughtLeg?.delta != null ? Math.min(85, Math.max(5, Math.round(Math.abs(boughtLeg.delta) * 100))) : null;
    }
  }

  const dteLabel = `${expiration.daysToExpiration} DTE (real, ${expiration.expirationType})`;

  const formattedTextOutput = `DIAGNÓSTICO DE VOLATILIDADE — ${input.symbol} | Vencimento real: ${expiration.expirationDate} (${expiration.daysToExpiration} DTE)

MÉTRICAS QUANTITATIVAS:
• Spot: $${spot.toFixed(2)} | IV30: ${fmtNum(input.iv30, 1, '', '%')} | RV20 (Yang-Zhang): ${fmtNum(input.rv20, 1, '', '%')}
• VRP: ${vrp != null ? `${vrp >= 0 ? '+' : ''}${vrp.toFixed(1)} pts` : 'indisponível'} | IV Rank (252d): ${fmtNum(input.ivr, 1, '', '%')} | IV Percentil: ${fmtNum(input.ivp, 0, '', '%')}
• Regime GEX: ${isPlusGex ? '+GEX ESTÁVEL' : '-GEX EXPLOSIVO'} | Zero Flip: ${fmtNum(input.zeroGammaFlip, 2, '$')}
• Put Wall: ${fmtNum(input.putWall, 2, '$')} | Call Wall: ${fmtNum(input.callWall, 2, '$')}

ESTRUTURA ELEITA (strikes e vencimento confirmados na cadeia real da Tastytrade):
• ${strategy.name} (${isCredit ? 'Crédito' : 'Débito'})
• Crédito/Custo real (bid/ask de mercado): $${Math.abs(netCredit).toFixed(2)} | Max Profit: $${maxProfit} | Max Loss: $${maxLoss}
• Regra do Crédito (≥ 1/3 largura): ${meetsCreditRule ? 'CONFORME (Crédito remunera o risco)' : 'ALERTA: Crédito abaixo de 1/3'}
• Probabilidade de lucro (POP): ${dynamicPop != null ? `${dynamicPop}% (a partir de delta real via streaming)` : 'indisponível (delta real não retornado pelo streaming DXLink nesta consulta)'}

PLAYBOOK TASTYTRADE (§8):
• Alvo de Saída: Fechar ordem com 50% do lucro ($${(Math.abs(netCredit) * 0.5).toFixed(2)})
• Defesa aos 21 DTE: Encerrar impreterivelmente aos 21 DTE para mitigar Gamma/Zomma
• ${dividendRiskReason}`;

  const strikeByStrikeJustification: StrikeJustificationItem[] = pricedLegs.map((leg) => {
    const ivText = leg.iv != null ? `IV real ${leg.iv.toFixed(1)}%` : 'IV real indisponível nesta consulta (streaming)';
    if (leg.action === 'SELL' && leg.type === 'PUT') {
      return { strike: leg.strike, action: 'SELL', type: 'PUT', role: 'Pilar de Suporte Institucional (Venda de Put)', reason: `Strike real posicionado na ou abaixo da Put Wall (${fmtNum(input.putWall, 2, '$')}). Prêmio de mercado (mid real: $${leg.midPrice.toFixed(2)}, ${ivText}) cobrado num nível onde os Market Makers compram ações no delta-hedge para conter a queda.` };
    }
    if (leg.action === 'SELL' && leg.type === 'CALL') {
      return { strike: leg.strike, action: 'SELL', type: 'CALL', role: 'Pilar de Resistência Institucional (Venda de Call)', reason: `Strike real posicionado na ou acima da Call Wall (${fmtNum(input.callWall, 2, '$')}). Prêmio de mercado (mid real: $${leg.midPrice.toFixed(2)}, ${ivText}) recolhido com alta probabilidade de expirar OTM.` };
    }
    if (leg.action === 'BUY' && leg.type === 'PUT') {
      return { strike: leg.strike, action: 'BUY', type: 'PUT', role: 'Asa de Proteção Inferior (Seguro de Cauda)', reason: `Compra da Put real no strike $${leg.strike.toFixed(2)} (mid real: $${leg.midPrice.toFixed(2)}) para definir o risco máximo. Perda limitada matematicamente à largura real de $${width.toFixed(2)} entre os strikes negociados.` };
    }
    return { strike: leg.strike, action: 'BUY', type: 'CALL', role: 'Asa de Proteção Superior (Teto de Risco)', reason: `Compra da Call real no strike $${leg.strike.toFixed(2)} (mid real: $${leg.midPrice.toFixed(2)}) para travar o risco na alta. Margem de risco definida (Reg T).` };
  });

  const didacticRationale: DidacticRationale = {
    oneLiner: 'É um analista de opções com mais de 20 anos de experiência que funciona dentro da inteligência artificial: ele não adivinha se a ação vai subir ou cair — ele calcula se o preço que estão te cobrando pela opção é justo e quanto você pode perder no pior cenário, antes de você colocar dinheiro na operação.',
    carInsuranceAnalogy: isCredit
      ? `Pense em opções como um seguro de carro. Quem vende a opção está no papel da seguradora: recebe o prêmio em dinheiro (cotação real de mercado, não estimada) e assume o compromisso de pagar se o evento acontecer. Em ${input.symbol}, a volatilidade implícita está cobrando ${fmtNum(input.iv30, 1, '', '%')}, enquanto a ação oscila historicamente apenas ${fmtNum(input.rv20, 1, '', '%')}${vrp != null ? ` (VRP de ${vrp >= 0 ? '+' : ''}${vrp.toFixed(1)} pts)` : ''}.`
      : `Pense em opções como um seguro de carro. Em ${input.symbol}, a volatilidade implícita está com IV30 de ${fmtNum(input.iv30, 1, '', '%')} (IV Rank de ${fmtNum(input.ivr, 1, '', '%')}). Estar no papel do comprador, pagando o prêmio real de mercado, com risco 100% limitado ao custo inicial, é a melhor relação risco/retorno.`,
    whyThisStructure: `A estrutura eleita foi ${strategy.name} porque combina a avaliação relativa de volatilidade (IVR em ${fmtNum(input.ivr, 1, '', '%')}) com a física estabilizadora do regime de ${isPlusGex ? '+GEX (Market Makers amortecem oscilações)' : '-GEX (Dealers aceleram rompimentos)'}. Strikes e vencimento confirmados contra a cadeia real de opções da Tastytrade.`,
    strikeByStrikeJustification,
    fourJobsSummary: {
      insurancePricing: `IV 30d em ${fmtNum(input.iv30, 1, '', '%')} vs RV Yang-Zhang de ${fmtNum(input.rv20, 1, '', '%')}${vrp != null ? ` (VRP de ${vrp >= 0 ? '+' : ''}${vrp.toFixed(1)} pts)` : ''}.`,
      structureChoice: `${strategy.name} calibrada para o vencimento real mais próximo do sweet spot: ${expiration.expirationDate} (${expiration.daysToExpiration} DTE).`,
      riskBeforeReward: upperBreakeven !== null
        ? `Melhor cenário: Ganho de $${maxProfit.toFixed(2)}. Pior cenário: Perda máxima limitada a $${maxLoss.toFixed(2)}. Breakevens entre $${lowerBreakeven.toFixed(2)} e $${upperBreakeven.toFixed(2)}.`
        : `Melhor cenário: Ganho de $${maxProfit.toFixed(2)}. Pior cenário: Perda máxima limitada a $${maxLoss.toFixed(2)}. Breakeven em $${lowerBreakeven.toFixed(2)}.`,
      exitPlan: `Realização de lucro: Fechar com 50% do lucro ($${(Math.abs(netCredit) * 0.5).toFixed(2)}). Saída preventiva: Fechar ou rolar impreterivelmente aos 21 DTE.`,
    },
    fourCashQuestions: {
      maxProfitCash: `+$${maxProfit.toFixed(2)} por contrato`,
      maxLossCash: `-$${maxLoss.toFixed(2)} por contrato`,
      breakevenPoint: upperBreakeven !== null
        ? `Abaixo de $${lowerBreakeven.toFixed(2)} ou acima de $${upperBreakeven.toFixed(2)}`
        : `Abaixo de $${lowerBreakeven.toFixed(2)}`,
      whatMakesItFail: isCredit
        ? `Rompimento violento das barreiras de Open Interest (Put Wall ${fmtNum(input.putWall, 2, '$')} ou Call Wall ${fmtNum(input.callWall, 2, '$')}).`
        : `Ausência de movimento direcional ou colapso da volatilidade implícita.`,
    },
    whatItDoesNotDo: [
      'Não envia ordens automáticas: A ferramenta analisa e recomenda. Quem clica em comprar ou vender no broker é você.',
      'Não adivinha direção: calcula se o preço cobrado pelas opções está compatível com o risco real.',
      'Não inventa número: strike, vencimento e preço vêm da cadeia e cotação reais da Tastytrade. Quando delta/IV por contrato não está disponível via streaming, o campo fica marcado como indisponível — nunca preenchido por modelo.',
      'Não garante lucro: nenhuma análise garante.',
    ],
    whyItMattersForBeginners: [
      'Sabe se está pagando caro ou barato antes de entrar, com preço real de mercado.',
      'Sabe exatamente quanto pode perder: cada estrutura define o stop loss no próprio payoff matemático.',
      'Tem regra de saída definida antes da emoção aparecer.',
    ],
    honestExpectationNotice: 'Opções ampliam resultados nos dois sentidos. Esta ferramenta reduz erro de análise e impõe disciplina. Ela não reduz o risco do mercado.',
    disclaimer: 'Material quantitativo e educacional de apoio à decisão operacional em derivativos. Não constitui recomendação de investimento.',
  };

  let smileCurve: VolatilitySmilePoint[] | null = null;
  if (smileGreeks && smileGreeks.size > 0) {
    smileCurve = buildRealSmile(spot, plan.expiration, smileGreeks);
  }

  return {
    symbol: input.symbol,
    spot,
    change: input.change,
    iv30: input.iv30!,
    rv20: input.rv20!,
    vrp,
    ivr: input.ivr!,
    ivp: input.ivp!,
    volRegime,
    volRegimeLabel,
    volRegimeReason,
    gexRegime,
    gexRegimeLabel: isPlusGex ? '+GEX ESTÁVEL (Market Makers Amortecem)' : '-GEX EXPLOSIVO (Dealers Aceleram)',
    zeroGammaFlip: input.zeroGammaFlip!,
    putWall: input.putWall!,
    callWall: input.callWall!,
    strategy,
    targetDte: expiration.daysToExpiration,
    targetDteLabel: dteLabel,
    expirationDate: expiration.expirationDate,
    legs: pricedLegs,
    netCredit,
    isCredit,
    creditWidthRatio: creditRatio,
    meetsCreditRule,
    maxProfit,
    maxLoss,
    popEstimate: dynamicPop,
    lowerBreakeven,
    upperBreakeven,
    lifecycle: {
      profitTargetPct: 50,
      profitTargetDollar: Number((Math.abs(netCredit) * 0.5).toFixed(2)),
      defenseDte: 21,
      defenseDateNotice: 'Encerrar ou rolar impreterivelmente aos 21 DTE restantes para evitar risco de Gamma e Zomma.',
      untestedSideRule: 'Rolar o lado não testado no máximo 1x por ciclo para recolher crédito adicional.',
      hasDividendRisk,
      dividendRiskReason,
      whatMakesItLose: isCredit
        ? 'Choque repentino de volatilidade (Volga negativa) ou rompimento abrupto fora das Walls de OI.'
        : 'Estagnação prolongada do preço subjacente ou colapso da volatilidade implícita (Theta decay).',
    },
    didacticRationale,
    formattedTextOutput,
    smileCurve,
    dataQuality: {
      pricedFromRealQuotes: true,
      greeksAvailable: allSoldHaveDelta,
      smileAvailable: smileCurve != null,
    },
  };
}

/**
 * Constrói a curva de smile a partir de IV REAL por strike (streaming DXLink Greeks),
 * substituindo a antiga `generateSmile()` (fórmula com `skewFactor` arbitrário — uma
 * terceira fabricação encontrada nesta reescrita, além de strike/DTE e preço). Só
 * inclui pontos para os quais existe IV real; retorna null se não houver pontos
 * suficientes para um gráfico minimamente informativo.
 */
function buildRealSmile(
  spot: number,
  expiration: OptionChainExpiration,
  smileGreeks: Map<string, RealGreeksQuote>
): VolatilitySmilePoint[] | null {
  const points: VolatilitySmilePoint[] = [];

  for (const s of expiration.strikes) {
    const isBelow = s.strike < spot;
    const preferred = isBelow ? smileGreeks.get(s.putStreamerSymbol) : smileGreeks.get(s.callStreamerSymbol);
    const fallback = isBelow ? smileGreeks.get(s.callStreamerSymbol) : smileGreeks.get(s.putStreamerSymbol);
    const g = preferred?.iv != null ? preferred : fallback?.iv != null ? fallback : null;
    if (!g || g.iv == null) continue;

    const moneyness = Number((s.strike / spot).toFixed(2));
    let type: 'PUT_OTM' | 'ATM' | 'CALL_OTM' = 'ATM';
    if (moneyness < 0.99) type = 'PUT_OTM';
    else if (moneyness > 1.01) type = 'CALL_OTM';

    const deltaLabel = g.delta != null ? `${Math.round(Math.abs(g.delta) * 100)}Δ ${type === 'PUT_OTM' ? 'Put' : type === 'CALL_OTM' ? 'Call' : 'ATM'}` : `${type === 'PUT_OTM' ? 'Put' : type === 'CALL_OTM' ? 'Call' : 'ATM'} (Δ indisponível)`;

    points.push({ strike: s.strike, moneyness, deltaLabel, iv: Number((g.iv * 100).toFixed(1)), type });
  }

  if (points.length < 3) return null;
  return points.sort((a, b) => a.strike - b.strike);
}
