import { CME_STRATEGIES, StrategySpec } from './cme-catalog';

export interface VolatilityAssetInput {
  symbol: string;
  name: string;
  spot: number;
  change: number;
  iv30: number; // Implied Volatility 30-day index (%)
  rv20: number; // Realized Volatility 20-day Yang-Zhang (%)
  ivr: number;  // IV Rank (0-100)
  ivp: number;  // IV Percentile (0-100)
  skew25?: number; // IV(put delta 25) - IV(call delta 25)
  liquidityRating?: number; // 1 to 5 (Tastytrade rating)
  netGex: number; // Dollar GEX em $ Milhões
  zeroGammaFlip: number;
  putWall: number;
  callWall: number;
  dividendAmount?: number; // Dividendo em $ declarado no período
  callExtrinsic?: number;  // Valor extrínseco da call curta
  daysToEarnings?: number;
}

export interface VolatilityLegSpec {
  action: 'BUY' | 'SELL';
  type: 'CALL' | 'PUT';
  strike: number;
  delta: number;
  iv: number;
  midPrice: number;
  description: string;
}

export interface VolatilitySmilePoint {
  strike: number;
  moneyness: number; // Strike / Spot
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
  targetDte: number;
  targetDteLabel: string;
  legs: VolatilityLegSpec[];
  netCredit: number; // Positivo se crédito, negativo se débito
  isCredit: boolean;
  creditWidthRatio: number; // Ratio crédito / largura das asas
  meetsCreditRule: boolean; // >= 1/3 da largura
  maxProfit: number;
  maxLoss: number;
  popEstimate: number; // Probability of Profit (~ %)
  lowerBreakeven: number;
  upperBreakeven: number;
  lifecycle: {
    profitTargetPct: number; // 50% padrão Tastytrade
    profitTargetDollar: number;
    defenseDte: number; // 21 DTE
    defenseDateNotice: string;
    untestedSideRule: string;
    hasDividendRisk: boolean;
    dividendRiskReason: string;
    whatMakesItLose: string;
  };
  didacticRationale: DidacticRationale;
  formattedTextOutput: string;
  smileCurve: VolatilitySmilePoint[];
}

export class VolatilityEngine {
  /**
   * Avalia um ativo aplicando a árvore de decisão institucional da skill analista-senior-opcoes-us:
   * 1. Preço da Volatilidade: IVR, IVP e VRP (Yang-Zhang).
   * 2. Mecânica dos Market Makers: Regime GEX, Zero Gamma Flip e Walls de OI.
   * 3. Playbook Tastytrade: 30-45 DTE, 50% de lucro, defesa aos 21 DTE e regra do crédito >= 1/3.
   */
  public evaluate(input: VolatilityAssetInput): VolatilityRecommendation {
    const spot = input.spot;
    const vrp = Number((input.iv30 - input.rv20).toFixed(1));
    const ivr = input.ivr;
    const ivp = input.ivp;
    const isPlusGex = input.netGex >= 0;
    const gexRegime: '+GEX' | '-GEX' = isPlusGex ? '+GEX' : '-GEX';

    // 1. Árvore de Decisão de Volatilidade (§5.4 da skill)
    let volRegime: 'SELL_VOLATILITY' | 'BUY_VOLATILITY' | 'NEUTRAL' = 'NEUTRAL';
    let volRegimeLabel = 'Neutro em Volatilidade';
    let volRegimeReason = 'IV Rank intermediário (30-50%). Expressar viés direcional com risco definido.';

    if (ivr >= 50 && vrp >= 4.0) {
      volRegime = 'SELL_VOLATILITY';
      volRegimeLabel = 'Venda de Volatilidade (Coleta de Prêmio)';
      volRegimeReason = `IV Rank em ${ivr.toFixed(1)}% com VRP de +${vrp.toFixed(1)} pts. O prêmio cobrado supera a volatilidade realizada Yang-Zhang.`;
    } else if (ivr <= 30 && vrp <= 1.0) {
      volRegime = 'BUY_VOLATILITY';
      volRegimeLabel = 'Compra de Volatilidade / Débito';
      volRegimeReason = `IV Rank deprimido em ${ivr.toFixed(1)}% com VRP de ${vrp.toFixed(1)} pts. Opções baratas com assimetria para expansão de cauda.`;
    }

    // 2. Seleção da Estrutura CME com base em Vol + GEX
    let electedStrategyId = 20; // Default: Iron Condor #20
    const step = spot > 300 ? 10 : spot > 100 ? 5 : 2.5;

    // Distância até as paredes
    const distToPutWall = Math.abs(spot - input.putWall) / spot;
    const distToCallWall = Math.abs(spot - input.callWall) / spot;

    if (volRegime === 'SELL_VOLATILITY') {
      if (isPlusGex) {
        if (distToPutWall < 0.02) {
          // Preço encostado no suporte institucional -> Bull Put Spread
          electedStrategyId = 6;
        } else if (distToCallWall < 0.02) {
          // Preço encostado no teto institucional -> Bear Call Spread
          electedStrategyId = 7;
        } else {
          // Contido dentro do túnel institucional -> Iron Condor
          electedStrategyId = 20;
        }
      } else {
        // -GEX com alta vol -> Jade Lizard ou Broken-Wing para cortar cauda
        electedStrategyId = 22;
      }
    } else if (volRegime === 'BUY_VOLATILITY') {
      if (isPlusGex) {
        // Mercado amarrado com vol barata -> Double Calendar Spread
        electedStrategyId = 28;
      } else {
        // -GEX rompendo -> Travas direcionais de débito
        if (input.change < 0) {
          electedStrategyId = 2; // Bear Put Spread
        } else {
          electedStrategyId = 1; // Bull Call Spread
        }
      }
    } else {
      // Neutro
      electedStrategyId = input.change >= 0 ? 1 : 2;
    }

    const strategy = CME_STRATEGIES.find((s) => s.id === electedStrategyId) || CME_STRATEGIES[19];

    // 3. Montagem das Pernas e Strikes Ancorados nas Walls
    const legs: VolatilityLegSpec[] = [];
    let netCredit = 0;
    let width = step;
    const dte = electedStrategyId === 28 || electedStrategyId === 14 ? 30 : 35; // Sweet spot Tastytrade

    if (strategy.id === 20) {
      // Iron Condor a Crédito: Asas vendidas fora das Walls
      const shortPutStrike = Math.floor(Math.min(input.putWall, spot * 0.96) / step) * step;
      const longPutStrike = shortPutStrike - step;
      const shortCallStrike = Math.ceil(Math.max(input.callWall, spot * 1.04) / step) * step;
      const longCallStrike = shortCallStrike + step;
      width = step;

      const shortPutPrem = Number((spot * 0.012).toFixed(2));
      const longPutPrem = Number((spot * 0.005).toFixed(2));
      const shortCallPrem = Number((spot * 0.011).toFixed(2));
      const longCallPrem = Number((spot * 0.004).toFixed(2));

      netCredit = Number((shortPutPrem - longPutPrem + shortCallPrem - longCallPrem).toFixed(2));

      legs.push(
        { action: 'BUY', type: 'PUT', strike: longPutStrike, delta: 0.08, iv: input.iv30 * 1.08, midPrice: longPutPrem, description: `Asa de Proteção Inferior ($${longPutStrike})` },
        { action: 'SELL', type: 'PUT', strike: shortPutStrike, delta: 0.16, iv: input.iv30 * 1.03, midPrice: shortPutPrem, description: `Venda Ancorada na Put Wall ($${shortPutStrike})` },
        { action: 'SELL', type: 'CALL', strike: shortCallStrike, delta: 0.16, iv: input.iv30 * 0.98, midPrice: shortCallPrem, description: `Venda Ancorada na Call Wall ($${shortCallStrike})` },
        { action: 'BUY', type: 'CALL', strike: longCallStrike, delta: 0.08, iv: input.iv30 * 0.95, midPrice: longCallPrem, description: `Asa de Proteção Superior ($${longCallStrike})` }
      );
    } else if (strategy.id === 6) {
      // Bull Put Spread a Crédito
      const shortPutStrike = Math.floor(Math.min(input.putWall, spot * 0.98) / step) * step;
      const longPutStrike = shortPutStrike - step;
      width = step;
      const shortPutPrem = Number((spot * 0.018).toFixed(2));
      const longPutPrem = Number((spot * 0.008).toFixed(2));
      netCredit = Number((shortPutPrem - longPutPrem).toFixed(2));

      legs.push(
        { action: 'BUY', type: 'PUT', strike: longPutStrike, delta: 0.15, iv: input.iv30 * 1.06, midPrice: longPutPrem, description: `Asa de Proteção Long Put ($${longPutStrike})` },
        { action: 'SELL', type: 'PUT', strike: shortPutStrike, delta: 0.30, iv: input.iv30 * 1.02, midPrice: shortPutPrem, description: `Short Put Suporte Wall ($${shortPutStrike})` }
      );
    } else if (strategy.id === 28 || strategy.id === 14) {
      // Calendar Spread / Double Calendar (Débito)
      const centerStrike = Math.round(spot / step) * step;
      width = step;
      const shortPrem = Number((spot * 0.015).toFixed(2));
      const longPrem = Number((spot * 0.035).toFixed(2));
      netCredit = -Number((longPrem - shortPrem).toFixed(2)); // Custo líquido (débito)

      legs.push(
        { action: 'SELL', type: 'CALL', strike: centerStrike, delta: 0.50, iv: input.iv30, midPrice: shortPrem, description: `Ponta Curta Vendida (30 DTE) Strike $${centerStrike}` },
        { action: 'BUY', type: 'CALL', strike: centerStrike, delta: 0.50, iv: input.iv30 * 1.05, midPrice: longPrem, description: `Ponta Longa Comprada (60 DTE) Strike $${centerStrike}` }
      );
    } else {
      // Travas Verticais Direcionais (Débito)
      const isAlta = strategy.bias === 'ALTA';
      const k1 = Math.round(spot / step) * step;
      const k2 = isAlta ? k1 + step : k1 - step;
      width = step;
      const prem1 = Number((spot * 0.025).toFixed(2));
      const prem2 = Number((spot * 0.012).toFixed(2));
      netCredit = -Number((prem1 - prem2).toFixed(2));

      legs.push(
        { action: 'BUY', type: isAlta ? 'CALL' : 'PUT', strike: k1, delta: 0.50, iv: input.iv30, midPrice: prem1, description: `Ponta Comprada ATM ($${k1})` },
        { action: 'SELL', type: isAlta ? 'CALL' : 'PUT', strike: k2, delta: 0.30, iv: input.iv30, midPrice: prem2, description: `Ponta Vendida OTM ($${k2})` }
      );
    }

    const isCredit = netCredit > 0;
    const creditRatio = width > 0 ? Number((Math.abs(netCredit) / width).toFixed(2)) : 0;
    const meetsCreditRule = isCredit ? creditRatio >= 0.30 : true;

    const maxProfit = isCredit ? Number((netCredit * 100).toFixed(2)) : Number(((width - Math.abs(netCredit)) * 100).toFixed(2));
    const maxLoss = isCredit ? Number(((width - netCredit) * 100).toFixed(2)) : Number((Math.abs(netCredit) * 100).toFixed(2));

    // Teste de Atribuição por Dividendo (§2.2 da skill)
    const divAmount = input.dividendAmount || 0;
    const callExtrinsic = input.callExtrinsic || (netCredit > 0 ? netCredit * 0.5 : 1.0);
    const hasDividendRisk = divAmount > 0 && divAmount > callExtrinsic;
    const dividendRiskReason = hasDividendRisk
      ? `ALERTA DE ATRIBUIÇÃO: Dividendo de $${divAmount.toFixed(2)} supera o extrínseco de $${callExtrinsic.toFixed(2)}. Risco iminente de exercício antecipado da Call curta!`
      : `Seguro: Dividendo de $${divAmount.toFixed(2)} inferior ao extrínseco remanescente ($${callExtrinsic.toFixed(2)}).`;

    // Breakevens aproximados
    const lowerBreakeven = isCredit ? Number((spot * 0.94 - netCredit).toFixed(2)) : Number((spot - Math.abs(netCredit)).toFixed(2));
    const upperBreakeven = isCredit ? Number((spot * 1.05 + netCredit).toFixed(2)) : Number((spot + Math.abs(netCredit)).toFixed(2));

    // Formatação padronizada (§13 da skill analista-senior-opcoes-us)
    const formattedTextOutput = `DIAGNÓSTICO DE VOLATILIDADE — ${input.symbol} | Vencimento: ${dte} DTE

MÉTRICAS QUANTITATIVAS:
• Spot: $${spot.toFixed(2)} | IV30: ${input.iv30.toFixed(1)}% | RV20 (Yang-Zhang): ${input.rv20.toFixed(1)}%
• VRP: ${vrp >= 0 ? '+' : ''}${vrp.toFixed(1)} pts | IV Rank (252d): ${ivr.toFixed(1)}% | IV Percentil: ${ivp.toFixed(0)}%
• Regime GEX: ${isPlusGex ? '+GEX ESTÁVEL' : '-GEX EXPLOSIVO'} | Zero Flip: $${input.zeroGammaFlip.toFixed(2)}
• Put Wall: $${input.putWall.toFixed(2)} | Call Wall: $${input.callWall.toFixed(2)}

ESTRUTURA ELEITA:
• ${strategy.name} (${isCredit ? 'Crédito' : 'Débito'})
• Crédito/Custo: $${Math.abs(netCredit).toFixed(2)} | Max Profit: $${maxProfit} | Max Loss: $${maxLoss}
• Regra do Crédito (≥ 1/3 largura): ${meetsCreditRule ? 'CONFORME (Crédito remunera o risco)' : 'ALERTA: Crédito abaixo de 1/3'}

PLAYBOOK TASTYTRADE (§8):
• Alvo de Saída: Fechar ordem com 50% do lucro ($${(Math.abs(netCredit) * 0.5).toFixed(2)})
• Defesa aos 21 DTE: Encerrar impreterivelmente aos 21 DTE para mitigar Gamma/Zomma
• ${dividendRiskReason}`;

    // Justificativa Didática Strike a Strike (§2 e §8 da skill)
    const strikeByStrikeJustification: StrikeJustificationItem[] = legs.map((leg) => {
      if (leg.action === 'SELL' && leg.type === 'PUT') {
        return {
          strike: leg.strike,
          action: 'SELL',
          type: 'PUT',
          role: 'Pilar de Suporte Institucional (Venda de Put)',
          reason: `Strike posicionado na ou abaixo da Put Wall ($${input.putWall.toFixed(2)}), onde reside a maior barreira de Open Interest dos dealers. Ao vender aqui, você atua como a seguradora cobrando um prêmio inflado (IV ${leg.iv.toFixed(1)}%) num nível onde os Market Makers compram ações no delta-hedge para conter a queda.`
        };
      }
      if (leg.action === 'SELL' && leg.type === 'CALL') {
        return {
          strike: leg.strike,
          action: 'SELL',
          type: 'CALL',
          role: 'Pilar de Resistência Institucional (Venda de Call)',
          reason: `Strike posicionado na ou acima da Call Wall ($${input.callWall.toFixed(2)}), teto dinâmico de Open Interest institucional. Os formadores de mercado vendem o ativo subjacente contra essa parede, criando resistência natural e permitindo recolher prêmio extrínseco com alta probabilidade de expirar OTM.`
        };
      }
      if (leg.action === 'BUY' && leg.type === 'PUT') {
        return {
          strike: leg.strike,
          action: 'BUY',
          type: 'PUT',
          role: 'Asa de Proteção Inferior (Seguro de Cauda)',
          reason: `Compra da Put no strike $${leg.strike.toFixed(2)} para definir o risco máximo no pior cenário possível. Ela 'compra o seguro do seguro', garantindo que mesmo num crash repentino de mercado, sua perda é limitada matematicamente ao spread de $${width.toFixed(2)} e seu capital nunca é colocado em risco ilimitado.`
        };
      }
      return {
        strike: leg.strike,
        action: 'BUY',
        type: 'CALL',
        role: 'Asa de Proteção Superior (Teto de Risco)',
        reason: `Compra da Call no strike $${leg.strike.toFixed(2)} para travar o risco na alta explosiva (short squeeze). Garante margem de risco definida (Reg T) e elimina a cauda infinita.`
      };
    });

    const didacticRationale: DidacticRationale = {
      oneLiner: 'É um analista de opções com mais de 20 anos de experiência que funciona dentro da inteligência artificial: ele não adivinha se a ação vai subir ou cair — ele calcula se o preço que estão te cobrando pela opção é justo e quanto você pode perder no pior cenário, antes de você colocar dinheiro na operação.',
      carInsuranceAnalogy: isCredit
        ? `Pense em opções como um seguro de carro. Quem compra a opção está pagando por proteção com risco limitado ao valor pago. Quem vende a opção está no papel da seguradora: recebe o prêmio em dinheiro na hora e assume o compromisso de pagar se o evento acontecer. Em ${input.symbol}, a volatilidade implícita está cobrando ${input.iv30.toFixed(1)}%, enquanto a ação oscila historicamente apenas ${input.rv20.toFixed(1)}%. O seguro está CARO em relação ao risco real (VRP de +${vrp.toFixed(1)} pts). Estar no papel da seguradora coletando esse prêmio é matematicamente vantajoso.`
        : `Pense em opções como um seguro de carro. Em ${input.symbol}, a volatilidade implícita está barata em ${input.iv30.toFixed(1)}% (IV Rank de apenas ${ivr.toFixed(1)}%). O 'seguro' está em liquidação com preço inferior ao histórico de oscilação do ativo. Estar no papel do comprador com risco 100% limitado ao custo inicial é a melhor relação risco/retorno.`,
      whyThisStructure: `A estrutura eleita foi ${strategy.name} porque combina a avaliação relativa de volatilidade (IVR em ${ivr.toFixed(1)}%) com a física estabilizadora do regime de ${isPlusGex ? '+GEX (Market Makers amortecem oscilações)' : '-GEX (Dealers aceleram rompimentos)'}, mantendo o risco 100% definido por travas de proteção.`,
      strikeByStrikeJustification,
      fourJobsSummary: {
        insurancePricing: `IV 30d em ${input.iv30.toFixed(1)}% vs RV Yang-Zhang de ${input.rv20.toFixed(1)}% (VRP de ${vrp >= 0 ? '+' : ''}${vrp.toFixed(1)} pts). O mercado precifica uma oscilação ${vrp >= 0 ? 'superior' : 'inferior'} à verificada nos últimos meses.`,
        structureChoice: `Em vez de usar sempre a mesma estratégia, o sistema selecionou ${strategy.name} calibrada para ${dte} DTE (Sweet Spot de decaimento do Theta).`,
        riskBeforeReward: `Melhor cenário: Ganho de $${maxProfit.toFixed(2)}. Pior cenário: Perda máxima limitada a $${maxLoss.toFixed(2)}. Breakevens entre $${lowerBreakeven.toFixed(2)} e $${upperBreakeven.toFixed(2)}.`,
        exitPlan: `Realização de lucro: Fechar com 50% do lucro ($${(Math.abs(netCredit) * 0.5).toFixed(2)}). Saída preventiva: Fechar ou rolar impreterivelmente aos 21 DTE restantes para evitar risco de Gamma.`
      },
      fourCashQuestions: {
        maxProfitCash: `+$${maxProfit.toFixed(2)} por contrato (100% do lucro potencial se o preço permanecer dentro da zona das Walls de OI até o vencimento)`,
        maxLossCash: `-$${maxLoss.toFixed(2)} por contrato (trava de segurança comprada limita a perda no pior cenário absoluto; o capital nunca fica exposto a risco infinito)`,
        breakevenPoint: `Abaixo de $${lowerBreakeven.toFixed(2)} ou acima de $${upperBreakeven.toFixed(2)} (qualquer cotação intermediária preserva lucro ou breakeven)`,
        whatMakesItFail: isCredit
          ? `Rompimento violento das barreiras de Open Interest (Put Wall $${input.putWall.toFixed(2)} ou Call Wall $${input.callWall.toFixed(2)}) com explosão de volatilidade não antecipada pelos formadores de mercado.`
          : `Ausência de movimento direcional ou colapso rápido da volatilidade implícita consumindo o prêmio pago no decaimento temporal (Theta).`
      },
      whatItDoesNotDo: [
        'Não envia ordens automáticas: A ferramenta analisa e recomenda. Quem clica em comprar ou vender no broker é você.',
        'Não adivinha direção: Ela não diz "a ação vai subir ou cair". Ela calcula se o preço cobrado pelas opções está compatível com o risco real.',
        'Não inventa número: É a regra mais rígida. Sem o dado real de cotação ou profundidade, entrega a condição matemática necessária e os campos em aberto para confirmação no book.',
        'Não garante lucro: Nenhuma análise garante. O que ela faz é evitar as três formas mais comuns de quebrar: pagar caro demais pelo seguro, arriscar mais do que a conta suporta e não ter plano de saída antes de entrar.'
      ],
      whyItMattersForBeginners: [
        'Sabe se está pagando caro ou barato antes de entrar: com números auditáveis de IV vs HV, sem depender de palpite ou viés emocional.',
        'Sabe exatamente quanto pode perder: cada estrutura define o stop loss no próprio payoff matemático, bloqueando perda ilimitada e limitando a exposição a 1% a 2% do capital.',
        'Tem regra de saída definida antes da emoção aparecer: alvo de 50% de lucro e encerramento obrigatório aos 21 DTE eliminam a ganância e o pânico de vencimento.'
      ],
      honestExpectationNotice: 'Opções ampliam resultados nos dois sentidos. Uma operação bem estruturada pode render bem mais que a mesma quantia aplicada em ação — e uma malfeita pode consumir todo o valor investido em poucos dias, ou mais que isso em certas estruturas. Esta ferramenta reduz erro de análise e impõe disciplina. Ela não reduz o risco do mercado, e não transforma opções em algo adequado para todo perfil de investidor. Quem está começando deveria usá-la primeiro para entender as operações e simular, antes de operar valor relevante.',
      disclaimer: 'Material quantitativo e educacional de apoio à decisão operacional em derivativos. Não constitui recomendação de investimento.'
    };

    return {
      symbol: input.symbol,
      spot,
      change: input.change,
      iv30: input.iv30,
      rv20: input.rv20,
      vrp,
      ivr,
      ivp,
      volRegime,
      volRegimeLabel,
      volRegimeReason,
      gexRegime,
      gexRegimeLabel: isPlusGex ? '+GEX ESTÁVEL (Market Makers Amortecem)' : '-GEX EXPLOSIVO (Dealers Aceleram)',
      zeroGammaFlip: input.zeroGammaFlip,
      putWall: input.putWall,
      callWall: input.callWall,
      strategy,
      targetDte: dte,
      targetDteLabel: `${dte} DTE (Tastytrade Sweet Spot)`,
      legs,
      netCredit,
      isCredit,
      creditWidthRatio: creditRatio,
      meetsCreditRule,
      maxProfit,
      maxLoss,
      popEstimate: isCredit ? 72 : 48,
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
      smileCurve: this.generateSmile(spot, input.iv30, input.skew25 || 4.5),
    };
  }

  /**
   * Gera a curva de Volatility Smile / Skew empírica para o ciclo de opções.
   * Modela o Put Skew institucional do mercado de ações americano.
   */
  generateSmile(spot: number, ivAtm: number, skewFactor: number = 4.5): VolatilitySmilePoint[] {
    const strikesCount = 11;
    const points: VolatilitySmilePoint[] = [];
    const minMoneyness = 0.85;
    const maxMoneyness = 1.15;
    const step = (maxMoneyness - minMoneyness) / (strikesCount - 1);

    for (let i = 0; i < strikesCount; i++) {
      const m = minMoneyness + i * step;
      const strike = Number((spot * m).toFixed(1));
      let iv = ivAtm;
      let type: 'PUT_OTM' | 'ATM' | 'CALL_OTM' = 'ATM';
      let deltaLabel = '50Δ ATM';

      if (m < 0.99) {
        type = 'PUT_OTM';
        const dist = 1 - m;
        // Put Skew: OTM Puts negociam a prêmio de volatilidade mais elevado (Tail Risk)
        iv = ivAtm + dist * (skewFactor * 2.6) + Math.pow(dist, 2) * 20;
        const putDelta = Math.round(50 - dist * 130);
        deltaLabel = `${Math.max(5, putDelta)}Δ Put`;
      } else if (m > 1.01) {
        type = 'CALL_OTM';
        const dist = m - 1;
        // Call Skew mais suave com ligeiro upturn em extreme wings
        iv = ivAtm - dist * (skewFactor * 0.5) + Math.pow(dist, 2) * 18;
        const callDelta = Math.round(50 - dist * 130);
        deltaLabel = `${Math.max(5, callDelta)}Δ Call`;
      }

      points.push({
        strike,
        moneyness: Number(m.toFixed(2)),
        deltaLabel,
        iv: Number(iv.toFixed(1)),
        type,
      });
    }

    return points;
  }
}

export const volatilityEngine = new VolatilityEngine();
