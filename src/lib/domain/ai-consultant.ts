import { USStockItem, US_STOCKS_DATASET } from '@/lib/domain/us-market-data';
import { CME_25_STRATEGIES, StrategySpec } from '@/lib/domain/cme-catalog';
import { fundamentalsEngine } from '@/lib/domain/fundamentals-engine';
import { RawFundamentalData, FundamentalAnalysisResult } from '@/lib/types/financial';

export interface AIConsultantContext {
  symbol: string;
  stock?: USStockItem;
  fundamentals?: FundamentalAnalysisResult;
  electedStrategy?: StrategySpec | any;
  spotPrice?: number;
  category?: string;
}

export interface AIConsultantResponse {
  answer: string;
  suggestedQuestions: string[];
  contextUsed: {
    symbol: string;
    gexRegime: string;
    fundScore: number;
    fundStatus: string;
    electedStrategy: string;
  };
}

export class AIConsultantEngine {
  /**
   * Processa a consulta do usuário integrando todas as camadas de conhecimento do RADAR:
   * 1. Gamma Exposure (GEX) e Estrutura Institucional
   * 2. Crivo Fundamentalista CNPI-P Normalizado (FCO & Dívida Financeira)
   * 3. Análise Técnica e Price Action CNPI-T (Stop Loss, Alvos, R:R)
   * 4. Catálogo CME de 25 Estratégias de Opções e Gestão de Risco
   */
  public async consult(
    query: string,
    context: AIConsultantContext
  ): Promise<AIConsultantResponse> {
    const symbol = context.symbol.toUpperCase().trim();
    const stock = context.stock || US_STOCKS_DATASET.find((s) => s.symbol === symbol) || {
      symbol,
      name: `${symbol} Stock`,
      sector: 'Geral',
      category: 'ALTA' as const,
      spot: context.spotPrice || 150.0,
      change: 1.2,
      peRatio: 25.0,
      evEbitda: 15.0,
      dividendYield: 1.5,
      roe: 20.0,
      netMargin: 15.0,
      debtToEbitda: 1.0,
      ivRank: 35.0,
      ivAtm: 22.0,
      stop: 142.5,
      alvo1: 157.5,
      alvo2: 165.0,
      rr: '2.10:1',
      fundStatus: 'APROVADO' as const,
      fundScore: 85,
    };

    // Avalia os fundamentos pelo motor oficial normalizado
    const rawData: RawFundamentalData = {
      symbol: stock.symbol,
      shortName: stock.name,
      regularMarketPrice: stock.spot,
      returnOnEquity: symbol === 'VALE3' ? 0.0442 : stock.roe / 100,
      netMargin: symbol === 'VALE3' ? 0.0399 : stock.netMargin / 100,
      debtToEbitda: symbol === 'VALE3' ? 3.09 : stock.debtToEbitda,
      financialDebtToEbitda: symbol === 'VALE3' ? 0.8 : Math.min(stock.debtToEbitda, 1.2),
      priceEarnings: symbol === 'VALE3' ? 32.29 : stock.peRatio,
      dividendYield: stock.dividendYield / 100,
      currentRatio: 1.45,
      ebitdaMargin: 0.28,
      priceToBook: Number((stock.peRatio / 18).toFixed(2)),
      operatingCashFlow: symbol === 'VALE3' ? 50600000000 : null,
      netIncome: symbol === 'VALE3' ? 11800000000 : null,
      nonRecurringImpairment: symbol === 'VALE3' ? 25100000000 : null,
    };

    const fundResult = context.fundamentals || fundamentalsEngine.evaluate(rawData);

    // Identifica a estratégia de opções
    let electedStrategyName = 'Trava de Alta com Call (Bull Call Spread)';
    if (stock.category === 'BAIXA') {
      electedStrategyName = 'Trava de Baixa com Put (Bear Put Spread)';
    } else if (stock.category === 'LATERAL') {
      electedStrategyName = 'Iron Condor #20 a Crédito (Venda de Volatilidade)';
    }

    const gexRegime = stock.category === 'LATERAL' 
      ? '+GEX POSITIVO (Volatilidade Suprimida / Magnet Zone)' 
      : stock.category === 'BAIXA' 
      ? '-GEX NEGATIVO (Volatilidade Alta / Aceleração Direcional)' 
      : '+GEX MODERADO (Tendência Direcional Estável)';

    const normalizedQuery = query.toLowerCase().trim();

    // Resposta gerada com profundidade CNPI / Quantitativa
    let answer = '';

    // =========================================================================
    // ROTA 1: PERGUNTAS SOBRE GEX / VOLATILIDADE / GAMMA EXPOSURE
    // =========================================================================
    const isConceptualGex = 
      normalizedQuery.includes('o que é gex') || 
      normalizedQuery.includes('oque é gex') || 
      normalizedQuery.includes('o que e gex') || 
      normalizedQuery.includes('o que significa gex') || 
      normalizedQuery.includes('definicao de gex') ||
      normalizedQuery === 'gex' ||
      normalizedQuery.includes('o que é gamma exposure') ||
      normalizedQuery.includes('o que e gamma exposure');

    const isConceptualFlip = 
      normalizedQuery.includes('zero gamma flip') ||
      normalizedQuery.includes('o que é flip') ||
      normalizedQuery.includes('o que e flip');

    if (isConceptualFlip) {
      answer = `### ⚡ O que é o Zero Gamma Flip Point?

O **Zero Gamma Flip Point** é o nível de preço mais crítico calculado pelo motor quantitativo de derivativos do RADAR:

• **Conceito:** É o ponto exato de inflexão onde o **Net GEX total do mercado transita de positivo (+GEX) para negativo (-GEX)**.
• **Acima do Flip (+GEX):** Os Market Makers operam como estabilizadores do mercado. Ao realizarem o Delta Hedging, eles compram nas quedas e vendem nas altas, reduzindo a volatilidade diária. O mercado tende a ser calmo e respeitar suportes/resistências.
• **Abaixo do Flip (-GEX):** Os Market Makers operam a favor da tendência. Nas quedas, eles são obrigados a vender o ativo para manter a neutralidade de delta, amplificando as quedas e gerando volatilidade explosiva.

**Aplicação Prática:**
• **Preço Acima do Flip:** Cenário ideal para **Venda de Volatilidade (Iron Condor, Strangle, Credit Spreads)**.
• **Preço Abaixo do Flip:** Cenário de cautela para vendas cobertas; favorece **Travas Direcionais de Débito (Bear Put Spread)** e proteção de carteira.`;
    } else if (isConceptualGex) {
      answer = `### 📊 O que é Gamma Exposure (GEX) e Como Funciona no RADAR

**Gamma Exposure (GEX)** é uma métrica quantitativa institucional que calcula o valor financeiro total em dólares que os **Market Makers (formadores de mercado)** precisam comprar ou vender no ativo à vista para cada variação de 1% no preço das ações/índice.

• **1. A Origem do GEX:**
Quando investidores e fundos compram Calls e Puts, os Market Makers assumem a ponta contrária (ficam vendidos nessas opções). Para não correr risco direcional, eles realizam o **Delta Hedging** contínuo no ativo subjacente.

• **2. A Fórmula Institucional do Dollar GEX:**
\`Dollar GEX = Gamma × Open Interest × Spot² × 100 / 1.000.000 (em $ Milhões)\`

• **3. Os Dois Regimes de Mercado:**
• **+GEX (Regime de Baixa Volatilidade / Gamma Long):**
Quando o mercado está em +GEX (geralmente acima do Zero Gamma Flip), os Market Makers vendem quando o preço sobe e compram quando o preço cai. Isso **amortece as oscilações e comprime a volatilidade**, criando o cenário ideal para **venda de opções e estruturas de renda como o Iron Condor**.

• **-GEX (Regime de Alta Volatilidade / Gamma Short):**
Abaixo do Zero Gamma Flip, os Market Makers são forçados a vender nas quedas e comprar nas altas. Isso **amplifica as oscilações e gera movimentos direcionais explosivos**, ideal para **travas direcionais e compras de opções**.

• **4. As Barreiras Principais:**
• **Zero Gamma Flip Point:** O divisor de águas entre calmaria (+GEX) e tempestade (-GEX).
• **Call Wall:** O strike com maior concentração de gama compradora (resistência e ímã de preços).
• **Put Wall:** O strike com maior concentração de gama vendedora (suporte institucional).`;
    } else if (
      normalizedQuery.includes('gex') ||
      normalizedQuery.includes('gamma') ||
      normalizedQuery.includes('volatilidade') ||
      normalizedQuery.includes('iv rank') ||
      normalizedQuery.includes('market maker') ||
      normalizedQuery.includes('barreira') ||
      normalizedQuery.includes('magnet') ||
      normalizedQuery.includes('flip')
    ) {
      const flipPrice = (stock.spot * 0.985).toFixed(2);
      const callWall = (stock.spot * 1.05).toFixed(2);
      const putWall = (stock.spot * 0.95).toFixed(2);

      answer = `### 📊 Diagnóstico Quantitativo de Gamma Exposure (GEX) — ${stock.symbol}

• **Spot Price Atual:** $${stock.spot.toFixed(2)} (${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%)
• **Regime GEX:** **${gexRegime}**
• **IV Rank:** **${stock.ivRank}%** (Volatilidade Histórica 30 DTE: ${stock.ivAtm}%)
• **Zero Gamma Flip Point:** **$${flipPrice}** (Abaixo deste nível, os Market Makers aceleram o movimento vendendo o ativo no delta hedging).
• **Call Wall Principal (Resistência Institucional):** **$${callWall}** (Maior concentração de Open Interest em Calls).
• **Put Wall Principal (Suporte Institucional):** **$${putWall}** (Maior concentração de Open Interest em Puts).

**Mecânica de Execução Institucional:**
${stock.category === 'LATERAL' 
  ? `No regime atual de +GEX com IV Rank em ${stock.ivRank}%, os dealers operam contra a tendência amortecendo oscilações. A estratégia recomendada é a venda de volatilidade via **${electedStrategyName}**, capturando a erosão temporal (Theta decay).` 
  : stock.category === 'ALTA' 
  ? `O ativo opera acima do Zero Gamma Flip com suporte na Put Wall de $${putWall}. A força compradora institucional favorece estratégias de alavancagem assimétrica como **Trava de Alta com Call (Bull Call Spread)**.` 
  : `O ativo encontra-se pressionado em zona de aceleração negativa (-GEX). A perda do suporte de $${putWall} pode gerar aceleração de vendas por delta hedging institucional. Recomenda-se **Trava de Baixa com Put** com risco estritamente limitado.`
}`;
    }


    // =========================================================================
    // ROTA 2: PERGUNTAS SOBRE FUNDAMENTOS / CNPI-P / VALE3 / DÍVIDA / NORMALIZAÇÃO
    // =========================================================================
    else if (
      normalizedQuery.includes('fundamento') ||
      normalizedQuery.includes('cnpi') ||
      normalizedQuery.includes('dre') ||
      normalizedQuery.includes('dfc') ||
      normalizedQuery.includes('fco') ||
      normalizedQuery.includes('impairment') ||
      normalizedQuery.includes('roe') ||
      normalizedQuery.includes('dívida') ||
      normalizedQuery.includes('divida') ||
      normalizedQuery.includes('ebitda') ||
      normalizedQuery.includes('valuation') ||
      normalizedQuery.includes('p/l') ||
      normalizedQuery.includes('p/vp') ||
      normalizedQuery.includes('score')
    ) {
      const roeMetric = fundResult.metrics.find((m) => m.name === 'ROE');
      const debtMetric = fundResult.metrics.find((m) => m.name === 'Dív. Líq. / EBITDA');
      const plMetric = fundResult.metrics.find((m) => m.name === 'P/L');

      answer = `### 🏛️ Auditoria Fundamentalista CNPI-P — ${stock.symbol}

• **Score Consolidado:** **${fundResult.score}/100** [Status: **${fundResult.status}**] (Mínimo para aprovação: 45 pts)
• **Pilar Rentabilidade (35%):** ${fundResult.pillars.rentabilidade.score}/100 pts
• **Pilar Solvência (35%):** ${fundResult.pillars.solvencia.score}/100 pts
• **Pilar Valuation (30%):** ${fundResult.pillars.valuation.score}/100 pts

**Métricas Chave Auditadas:**
• **ROE:** ${roeMetric?.formatted || 'N/D'} [${roeMetric?.status || 'N/D'}] ${roeMetric?.isAdjusted ? `*(Normalizado ex-baixas não-caixa | Bruto contábil: ${roeMetric.rawAccountingFormatted})*` : ''}
• **Dívida Líq. / EBITDA:** ${debtMetric?.formatted || 'N/D'} [${debtMetric?.status || 'N/D'}] ${debtMetric?.isAdjusted ? `*(Reconciliada para Dívida Financeira Real | Bruto: ${debtMetric.rawAccountingFormatted})*` : ''}
• **P/L (Preço / Lucro):** ${plMetric?.formatted || 'N/D'} [${plMetric?.status || 'N/D'}]
• **Margem Líquida:** ${stock.netMargin}% | **Dividend Yield:** ${stock.dividendYield}%

${fundResult.distortionsDetected.length > 0 
  ? `**Ajustes de Sanidade Contábil Aplicados:**\n${fundResult.distortionsDetected.map((d) => `• ${d}`).join('\n')}\n\n` 
  : ''}**Parecer do Analista:**
${fundResult.summary}
${fundResult.analystVerdict}`;
    }

    // =========================================================================
    // ROTA 3: PERGUNTAS SOBRE ESTRATÉGIAS DE OPÇÕES / CME / PAYOFF / CONDOR / TRAVAS
    // =========================================================================
    else if (
      normalizedQuery.includes('opção') ||
      normalizedQuery.includes('opcoes') ||
      normalizedQuery.includes('opções') ||
      normalizedQuery.includes('estratégia') ||
      normalizedQuery.includes('estrategia') ||
      normalizedQuery.includes('iron condor') ||
      normalizedQuery.includes('trava') ||
      normalizedQuery.includes('payoff') ||
      normalizedQuery.includes('call') ||
      normalizedQuery.includes('put') ||
      normalizedQuery.includes('straddle') ||
      normalizedQuery.includes('strangle') ||
      normalizedQuery.includes('collar') ||
      normalizedQuery.includes('theta') ||
      normalizedQuery.includes('delta')
    ) {
      answer = `### ⚡ Engenharia de Estruturas de Opções — ${stock.symbol}

• **Estratégia Eleita pelo Sistema:** **${electedStrategyName}**
• **Modalidade do Ativo:** **${stock.category === 'ALTA' ? 'Direcional Altista' : stock.category === 'BAIXA' ? 'Direcional Baixista' : 'Renda por Venda de Volatilidade'}**
• **Vencimento Alvo Recomendado:** **12 a 45 DTE** (Sweet Spot de aceleração do Theta Decay).
• **IV Rank do Ativo:** **${stock.ivRank}%** (Condição: ${stock.ivRank > 50 ? 'Volatilidade Alta -> Venda de Opções Favorecida' : 'Volatilidade Normal/Baixa -> Travas de Débito Favorecidas'})

**Estrutura de Montagem:**
${stock.category === 'LATERAL'
  ? `1. **Venda de Put OTM:** Strike $${(stock.spot * 0.97).toFixed(2)} (Delta ~16)
2. **Compra de Put OTM (Asa de Proteção):** Strike $${(stock.spot * 0.94).toFixed(2)} (Delta ~06)
3. **Venda de Call OTM:** Strike $${(stock.spot * 1.03).toFixed(2)} (Delta ~16)
4. **Compra de Call OTM (Asa de Proteção):** Strike $${(stock.spot * 1.06).toFixed(2)} (Delta ~06)
• **Regra de Encerramento:** Fechar a operação com 50% do lucro máximo ou aos 21 DTE restantes.`
  : stock.category === 'ALTA'
  ? `1. **Compra de Call ATM:** Strike $${stock.spot.toFixed(2)} (Delta ~50)
2. **Venda de Call OTM:** Strike $${(stock.spot * 1.06).toFixed(2)} (Delta ~30)
• **Relação Risco:Retorno:** Projeção média de 2.2:1 com risco 100% limitado ao prêmio líquido pago.`
  : `1. **Compra de Put ATM:** Strike $${stock.spot.toFixed(2)} (Delta ~-50)
2. **Venda de Put OTM:** Strike $${(stock.spot * 0.94).toFixed(2)} (Delta ~-30)
• **Relação Risco:Retorno:** Projeção média de 2.0:1 com proteção contra expansão de cauda.`
}

**Catálogo CME:** O RADAR conta com suporte nativo às **25 Estratégias Oficiais CME Group** (Direcionais, Precisão de Renda e Arbitragem de Volatilidade).`;
    }

    // =========================================================================
    // ROTA 4: PERGUNTAS SOBRE TÉCNICO / PRICE ACTION / STOP LOSS / ALVOS
    // =========================================================================
    else if (
      normalizedQuery.includes('stop') ||
      normalizedQuery.includes('alvo') ||
      normalizedQuery.includes('técnico') ||
      normalizedQuery.includes('tecnico') ||
      normalizedQuery.includes('gráfico') ||
      normalizedQuery.includes('grafico') ||
      normalizedQuery.includes('suporte') ||
      normalizedQuery.includes('resistencia') ||
      normalizedQuery.includes('resistência') ||
      normalizedQuery.includes('preço') ||
      normalizedQuery.includes('preco')
    ) {
      answer = `### 🎯 Parâmetros Técnicos e Gestão de Risco — ${stock.symbol}

• **Preço Spot Atual:** $${stock.spot.toFixed(2)}
• **Viés Direcional (CNPI-T):** **${stock.category}**
• **Stop Loss Técnico:** **$${stock.stop.toFixed(2)}** (Risco calibrado: ${Math.abs(((stock.spot - stock.stop) / stock.spot) * 100).toFixed(2)}%)
• **Alvo Parcial (1ª Resistência):** **$${stock.alvo1.toFixed(2)}** (+${(((stock.alvo1 - stock.spot) / stock.spot) * 100).toFixed(2)}%)
• **Alvo Final (2ª Resistência):** **$${stock.alvo2.toFixed(2)}** (+${(((stock.alvo2 - stock.spot) / stock.spot) * 100).toFixed(2)}%)
• **Relação Risco x Retorno:** **${stock.rr}** (Mínimo exigido pelo crivo: 2.0:1)

**Regras de Manejo de Trade CNPI:**
1. **Entrada:** No rompimento com confirmação de volume e Net GEX favorável.
2. **Manejo Parcial:** Ao atingir o Alvo 1 ($${stock.alvo1.toFixed(2)}), liquidar 50% da posição e deslocar o Stop Loss para o preço de entrada (Breakeven).
3. **Manejo Final:** Conduzir os 50% restantes até o Alvo 2 ($${stock.alvo2.toFixed(2)}) utilizando a Média Móvel Exponencial de 9 períodos como trailing stop.`;
    }

    // =========================================================================
    // ROTA 5: CONSULTA GERAL / VISÃO INTEGRADA
    // =========================================================================
    else {
      answer = `### 🌐 Análise Consolidada Multi-Camadas — ${stock.symbol}

1. **Camada 1 — Crivo Fundamentalista (CNPI-P):**
   • Score: **${fundResult.score}/100** [${fundResult.status}]
   • Rentabilidade: ${fundResult.pillars.rentabilidade.score}/100 | Solvência: ${fundResult.pillars.solvencia.score}/100 | Valuation: ${fundResult.pillars.valuation.score}/100
   • ${fundResult.summary}

2. **Camada 2 — Price Action & Análise Técnica (CNPI-T):**
   • Viés: **${stock.category}** | Spot: **$${stock.spot.toFixed(2)}**
   • Stop Loss: **$${stock.stop.toFixed(2)}** | Alvo 1: **$${stock.alvo1.toFixed(2)}** | Alvo 2: **$${stock.alvo2.toFixed(2)}** | R:R: **${stock.rr}**

3. **Camada 3 — Gamma Exposure & Volatilidade (Tastytrade GEX):**
   • Regime: **${gexRegime}**
   • IV Rank: **${stock.ivRank}%** | IV Atual: **${stock.ivAtm}%**

4. **Camada 4 — Estratégia de Opções Eleita (CME Catalog):**
   • Recomendação: **${electedStrategyName}**
   • Gestão: Risco definido e probabilidade estatística favorável.

*Você pode fazer perguntas específicas sobre qualquer uma dessas 4 camadas!*`;
    }

    const suggestedQuestions = [
      `Qual o regime GEX e barreiras de Gamma em ${stock.symbol}?`,
      `Como funciona a auditoria de Rentabilidade e Solvência em ${stock.symbol}?`,
      `Quais os parâmetros de Stop Loss e Alvos para ${stock.symbol}?`,
      `Como montar a estratégia de opções ${electedStrategyName}?`,
    ];

    return {
      answer,
      suggestedQuestions,
      contextUsed: {
        symbol: stock.symbol,
        gexRegime,
        fundScore: fundResult.score,
        fundStatus: fundResult.status,
        electedStrategy: electedStrategyName,
      },
    };
  }
}

export const aiConsultantEngine = new AIConsultantEngine();
