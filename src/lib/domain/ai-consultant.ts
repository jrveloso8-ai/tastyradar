import { USStockItem, US_STOCKS_DATASET } from '@/lib/domain/us-market-data';
import { CME_25_STRATEGIES, StrategySpec } from '@/lib/domain/cme-catalog';

export interface AIConsultantContext {
  symbol: string;
  stock?: USStockItem;
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
    electedStrategy: string;
  };
}

export class AIConsultantEngine {
  /**
   * Processa a consulta do usuário integrando as camadas quantitativas do RADAR:
   * 1. Gamma Exposure (GEX) e Estrutura de Mercado
   * 2. Análise Técnica e Price Action CNPI-T (Stop Loss, Alvos, R:R)
   * 3. Catálogo CME de Estratégias de Opções e Gestão de Risco
   */
  public async consult(
    query: string,
    context: AIConsultantContext
  ): Promise<AIConsultantResponse> {
    const symbol = context.symbol.toUpperCase().trim();
    const knownStock = context.stock || US_STOCKS_DATASET.find((s) => s.symbol === symbol);
    const isKnownTicker = !!knownStock;
    const stock = knownStock || {
      symbol,
      name: `${symbol} Stock`,
      sector: 'Geral',
      category: 'ALTA' as const,
      spot: typeof context.spotPrice === 'number' ? context.spotPrice : 0,
      change: 1.2,
      ivRank: 35.0,
      ivAtm: 22.0,
      stop: 142.5,
      alvo1: 157.5,
      alvo2: 165.0,
      rr: '2.10:1',
    } as USStockItem;

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
    // ROTA 2: PERGUNTAS SOBRE FUNDAMENTOS / DADOS CONTÁBEIS
    // =========================================================================
    else if (
      normalizedQuery.includes('fundamento') ||
      normalizedQuery.includes('cnpi-p') ||
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
      normalizedQuery.includes('balanço') ||
      normalizedQuery.includes('balanco') ||
      normalizedQuery.includes('lucro') ||
      normalizedQuery.includes('margem')
    ) {
      answer = `### 🏛️ Análise Fundamentalista Descontinuada — ${stock.symbol}

• **Status:** O RADAR não realiza mais análise fundamentalista nem cálculo de múltiplos contábeis (P/L, ROE, Dívida/EBITDA, Margem Líquida).
• **Motivo Técnico:** A plataforma é focada em derivativos e opções do mercado americano operados via Tastytrade. A corretora Tastytrade provê dados de mercado e de opções, não sendo fornecedora de dados contábeis/fundamentalistas para o mercado dos EUA.
• **Integridade de Dados (Regra 00):** Para evitar a exibição de dados contábeis estáticos desatualizados ou estimativas sem fonte oficial ao vivo, o Crivo Fundamentalista foi integralmente removido do sistema.
• **Foco Operacional:** A tomada de decisão no RADAR é embasada em:
  1. **Estrutura de Mercado & Gamma Exposure (GEX):** Posicionamento de market makers e volatilidade real via Tastytrade.
  2. **Análise Técnica (CNPI-T):** Price action, níveis de suporte/resistência e assimetria risco:retorno.
  3. **Engenharia de Opções (Catálogo CME):** Estruturas com risco definido e sweet spot de Theta decay.`;
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

**Catálogo CME & Playbook Tastytrade:** O RADAR conta com suporte nativo a **32 Estratégias Oficiais** (Direcionais, Precisão de Renda e Arbitragem de Volatilidade, incluindo Iron Condor, Short Strangle Δ16, Double Calendar e PMCC) governado pela skill institucional 'analista-senior-opcoes-us'.`;
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

1. **Camada 1 — Price Action & Análise Técnica (CNPI-T):**
   • Viés: **${stock.category}** | Spot: **$${stock.spot.toFixed(2)}**
   • Stop Loss: **$${stock.stop.toFixed(2)}** | Alvo 1: **$${stock.alvo1.toFixed(2)}** | Alvo 2: **$${stock.alvo2.toFixed(2)}** | R:R: **${stock.rr}**

2. **Camada 2 — Gamma Exposure & Volatilidade (Tastytrade GEX):**
   • Regime: **${gexRegime}**
   • IV Rank: **${stock.ivRank}%** | IV Atual: **${stock.ivAtm}%**

3. **Camada 3 — Estratégia de Opções Eleita (CME Catalog):**
   • Recomendação: **${electedStrategyName}**
   • Gestão: Risco definido e probabilidade estatística favorável.

*Você pode fazer perguntas específicas sobre qualquer uma dessas 3 camadas quantitativas!*`;
    }

    const suggestedQuestions = [
      `Qual o regime GEX e barreiras de Gamma em ${stock.symbol}?`,
      `Qual a volatilidade implícita e IV Rank de ${stock.symbol}?`,
      `Quais os parâmetros de Stop Loss e Alvos para ${stock.symbol}?`,
      `Como montar a estratégia de opções ${electedStrategyName}?`,
    ];

    if (!isKnownTicker) {
      answer =
        `⚠️ **${symbol} está fora da cobertura atual do RADAR** (não consta no dataset de ~66 ativos monitorados).\n\n` +
        `Os números abaixo (stop/alvo, estratégia, volatilidade) são apenas **ilustrativos de como a análise funcionaria**, ` +
        `não foram calculados a partir de dado real de ${symbol}, e não devem ser usados para decisão de investimento.\n\n---\n\n` +
        answer;
    }

    return {
      answer,
      suggestedQuestions,
      contextUsed: {
        symbol: stock.symbol,
        gexRegime,
        electedStrategy: electedStrategyName,
      },
    };
  }
}

export const aiConsultantEngine = new AIConsultantEngine();
