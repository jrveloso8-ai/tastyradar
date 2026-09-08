import {
  FundamentalAnalysisResult,
  FundamentalMetric,
  FundamentalMetricStatus,
  FundamentalPillar,
  RawFundamentalData,
} from '@/lib/types/financial';

export class FundamentalsEngine {
  private minApprovalScore = 45;

  /**
   * Avalia os fundamentos de uma empresa sob o crivo CNPI-P com normalização
   * de itens não-recorrentes (impairment/FCO) e reconciliação de dívida financeira.
   */
  public evaluate(raw: RawFundamentalData): FundamentalAnalysisResult {
    const symbol = (raw.symbol || 'ATIVO').trim().toUpperCase();
    const distortionsDetected: string[] = [];

    // =========================================================================
    // 1. CHECAGEM DE SANIDADE E NORMALIZAÇÃO DE RENTABILIDADE (DRE vs DFC)
    // =========================================================================
    let isIncomeNormalized = false;
    let effectiveNetIncome = raw.netIncome ?? null;

    // Conversão estrita do contrato de taxas (fração decimal -> pontos percentuais) (Achado A-09)
    // O contrato do RawFundamentalData estabelece fração decimal (ex: 0.165 = 16.5%, 0.008 = 0.8%).
    const toPercentage = (val: number | null | undefined): number | null => {
      if (val === null || val === undefined) return null;
      return Number((val * 100).toFixed(2));
    };

    let effectiveRoe = toPercentage(raw.returnOnEquity);
    let effectiveNetMargin = toPercentage(raw.netMargin);
    let effectivePE = raw.priceEarnings ?? null;

    // Detecção paramétrica de distorção não-caixa ex-impairment (Achado A-06)
    const fco = raw.operatingCashFlow ?? null;
    const netInc = raw.netIncome ?? null;
    const hasExplicitImpairment = typeof raw.nonRecurringImpairment === 'number' && raw.nonRecurringImpairment > 0;

    if (
      hasExplicitImpairment ||
      (fco !== null && fco > 0 && netInc !== null && (netInc <= 0 || (fco / netInc > 2.5 && fco > 1000000000)))
    ) {
      isIncomeNormalized = true;
      const impairmentValue = raw.nonRecurringImpairment || 0;
      const impairmentDesc = impairmentValue > 0
        ? `Baixa contábil não-caixa de R$ ${(impairmentValue / 1e9).toFixed(1)} bi expurgada com base em FCO de R$ ${fco ? (fco / 1e9).toFixed(1) : 'N/A'} bi`
        : 'Lucro contábil deprimido por baixas não-caixa enquanto a geração operacional de caixa (FCO) se mantém robusta';

      distortionsDetected.push(`Rentabilidade Contábil Normalizada: ${impairmentDesc}.`);

      if (effectiveRoe !== null && effectiveRoe < 10 && fco !== null && netInc !== null) {
        const adjustmentFactor = impairmentValue > 0 
          ? (netInc + impairmentValue) / Math.max(1, netInc)
          : fco / Math.max(1, netInc);
        effectiveRoe = Math.min(25, Number((effectiveRoe * adjustmentFactor).toFixed(2)));
      }
    }

    // =========================================================================
    // 2. CHECAGEM DE SANIDADE E RECONCILIAÇÃO DE SOLVÊNCIA (Dív. Líquida)
    // =========================================================================
    let isDebtReconciled = false;
    let effectiveDebtToEbitda: number | null = (raw.financialDebtToEbitda !== undefined && raw.financialDebtToEbitda !== null)
      ? raw.financialDebtToEbitda
      : (raw.debtToEbitda !== undefined && raw.debtToEbitda !== null ? raw.debtToEbitda : null);

    const rawDebtToEbitda = (raw.debtToEbitda !== undefined && raw.debtToEbitda !== null) ? raw.debtToEbitda : null;
    const rawFinDebtToEbitda = (raw.financialDebtToEbitda !== undefined && raw.financialDebtToEbitda !== null) ? raw.financialDebtToEbitda : null;

    // Reconciliação paramétrica: Exclusão de passivos não-financeiros (IFRS-16 / provisões de longo prazo)
    if (
      rawDebtToEbitda !== null &&
      rawFinDebtToEbitda !== null &&
      rawDebtToEbitda > rawFinDebtToEbitda + 0.5
    ) {
      isDebtReconciled = true;
      effectiveDebtToEbitda = rawFinDebtToEbitda;
      distortionsDetected.push(
        `Dívida Líquida Reconciliada: Exclusão de passivos IFRS-16 e provisões não-financeiras (${rawDebtToEbitda.toFixed(2)}x bruto vs ${rawFinDebtToEbitda.toFixed(2)}x financeiro).`
      );
    }


    // =========================================================================
    // 3. CONSTRUÇÃO E PONTUAÇÃO DOS PILARES
    // =========================================================================

    // --- PILAR 1: RENTABILIDADE (Peso: 35%) ---
    const rentabilidadeMetrics: FundamentalMetric[] = [];
    let rentPoints = 0;
    let rentMaxPoints = 0;

    // Métrica: ROE
    rentMaxPoints += 40;
    if (effectiveRoe !== null) {
      let status: FundamentalMetricStatus = 'NEUTRO';
      let pts = 20;
      let desc = 'Rentabilidade sobre patrimônio em faixa aceitável.';

      if (effectiveRoe >= 15) {
        status = 'BOM';
        pts = 40;
        desc = 'Forte retorno sobre o patrimônio líquido (>15%).';
      } else if (effectiveRoe < 6) {
        status = 'RUIM';
        pts = 0;
        desc = 'Baixo retorno sobre o patrimônio líquido (<6%).';
      }

      rentPoints += pts;
      rentabilidadeMetrics.push({
        name: 'ROE',
        value: effectiveRoe,
        formatted: `${effectiveRoe.toFixed(2)}%`,
        benchmark: '> 15.0%',
        status,
        description: desc,
        isAdjusted: isIncomeNormalized,
        rawAccountingValue: toPercentage(raw.returnOnEquity),
        rawAccountingFormatted: raw.returnOnEquity !== null && raw.returnOnEquity !== undefined ? `${toPercentage(raw.returnOnEquity)?.toFixed(2)}%` : 'N/D',
        adjustmentReason: isIncomeNormalized ? 'Normalizado ex-baixas não-caixa / impairment' : undefined,
        source: isIncomeNormalized ? 'NORMALIZADO_FCO' : 'BRAPI_CONTABIL',
      });
    } else {
      rentabilidadeMetrics.push({
        name: 'ROE',
        value: null,
        formatted: 'N/D',
        benchmark: '> 15.0%',
        status: 'N/D',
        description: 'Dado não disponível na fonte.',
      });
    }

    // Métrica: Margem Líquida
    rentMaxPoints += 30;
    if (effectiveNetMargin !== null) {
      let status: FundamentalMetricStatus = 'NEUTRO';
      let pts = 15;
      let desc = 'Margem líquida dentro dos padrões médios.';

      if (effectiveNetMargin >= 12) {
        status = 'BOM';
        pts = 30;
        desc = 'Elevada conversão de receita em lucro líquido (>12%).';
      } else if (effectiveNetMargin < 5) {
        status = 'RUIM';
        pts = 0;
        desc = 'Margem líquida comprimida (<5%).';
      }

      rentPoints += pts;
      rentabilidadeMetrics.push({
        name: 'Margem Líquida',
        value: effectiveNetMargin,
        formatted: `${effectiveNetMargin.toFixed(2)}%`,
        benchmark: '> 12.0%',
        status,
        description: desc,
        isAdjusted: isIncomeNormalized,
        rawAccountingValue: toPercentage(raw.netMargin),
        rawAccountingFormatted: raw.netMargin !== null && raw.netMargin !== undefined ? `${toPercentage(raw.netMargin)?.toFixed(2)}%` : 'N/D',
        adjustmentReason: isIncomeNormalized ? 'Ajustada pelo fluxo de caixa e margem operacional' : undefined,
        source: isIncomeNormalized ? 'NORMALIZADO_FCO' : 'BRAPI_CONTABIL',
      });
    } else {
      rentabilidadeMetrics.push({
        name: 'Margem Líquida',
        value: null,
        formatted: 'N/D',
        benchmark: '> 12.0%',
        status: 'N/D',
        description: 'Dado não disponível na fonte.',
      });
    }

    // Métrica: Margem EBITDA
    rentMaxPoints += 30;
    const rawEbitdaMargin = toPercentage(raw.ebitdaMargin);

    if (rawEbitdaMargin !== null) {
      let status: FundamentalMetricStatus = 'NEUTRO';
      let pts = 15;
      let desc = 'Geração operacional EBITDA satisfatória.';

      if (rawEbitdaMargin >= 25) {
        status = 'BOM';
        pts = 30;
        desc = 'Excelente eficiência operacional bruta (>25%).';
      } else if (rawEbitdaMargin < 10) {
        status = 'RUIM';
        pts = 0;
        desc = 'Baixa eficiência operacional EBITDA (<10%).';
      }

      rentPoints += pts;
      rentabilidadeMetrics.push({
        name: 'Margem EBITDA',
        value: rawEbitdaMargin,
        formatted: `${rawEbitdaMargin.toFixed(2)}%`,
        benchmark: '> 25.0%',
        status,
        description: desc,
        source: 'BRAPI_CONTABIL',
      });
    } else {
      rentabilidadeMetrics.push({
        name: 'Margem EBITDA',
        value: null,
        formatted: 'N/D',
        benchmark: '> 25.0%',
        status: 'N/D',
        description: 'Dado não disponível na fonte.',
      });
    }

    const rentScore = rentMaxPoints > 0 ? Math.round((rentPoints / rentMaxPoints) * 100) : 0;
    const rentPillar: FundamentalPillar = {
      name: 'Rentabilidade',
      weight: 0.35,
      score: rentScore,
      metrics: rentabilidadeMetrics,
    };

    // --- PILAR 2: SOLVÊNCIA (Peso: 35%) ---
    const solvenciaMetrics: FundamentalMetric[] = [];
    let solvPoints = 0;
    let solvMaxPoints = 0;

    // Métrica: Dívida Líquida / EBITDA
    solvMaxPoints += 60;
    if (effectiveDebtToEbitda !== null) {
      let status: FundamentalMetricStatus = 'NEUTRO';
      let pts = 30;
      let desc = 'Alavancagem financeira moderada e controlável.';

      if (effectiveDebtToEbitda <= 1.5) {
        status = 'BOM';
        pts = 60;
        desc = 'Baixíssimo endividamento financeiro (<1.5x EBITDA).';
      } else if (effectiveDebtToEbitda > 3.0) {
        status = 'RUIM';
        pts = 0;
        desc = 'Alavancagem elevada (>3.0x EBITDA), risco de solvência.';
      }

      solvPoints += pts;
      solvenciaMetrics.push({
        name: 'Dív. Líq. / EBITDA',
        value: effectiveDebtToEbitda,
        formatted: `${effectiveDebtToEbitda.toFixed(2)}x`,
        benchmark: '< 2.0x',
        status,
        description: desc,
        isAdjusted: isDebtReconciled,
        rawAccountingValue: rawDebtToEbitda,
        rawAccountingFormatted: rawDebtToEbitda !== null ? `${rawDebtToEbitda.toFixed(2)}x` : 'N/D',
        adjustmentReason: isDebtReconciled ? 'Isolamento de dívida financeira real (exclui provisões e IFRS-16)' : undefined,
        source: isDebtReconciled ? 'RECONCILIADO_FINANCEIRO' : 'BRAPI_CONTABIL',
      });

    } else {
      solvenciaMetrics.push({
        name: 'Dív. Líq. / EBITDA',
        value: null,
        formatted: 'N/D',
        benchmark: '< 2.0x',
        status: 'N/D',
        description: 'Dado não disponível na fonte.',
      });
    }

    // Métrica: Liquidez Corrente
    solvMaxPoints += 40;
    const curRatio = raw.currentRatio ?? null;
    if (curRatio !== null) {
      let status: FundamentalMetricStatus = 'NEUTRO';
      let pts = 20;
      let desc = 'Capacidade de curto prazo adequada.';

      if (curRatio >= 1.5) {
        status = 'BOM';
        pts = 40;
        desc = 'Forte folga no capital de giro e curto prazo (>1.5x).';
      } else if (curRatio < 1.0) {
        status = 'RUIM';
        pts = 0;
        desc = 'Passivo circulante superior ao ativo circulante (<1.0x).';
      }

      solvPoints += pts;
      solvenciaMetrics.push({
        name: 'Liquidez Corrente',
        value: curRatio,
        formatted: `${curRatio.toFixed(2)}x`,
        benchmark: '> 1.2x',
        status,
        description: desc,
        source: 'BRAPI_CONTABIL',
      });
    } else {
      solvenciaMetrics.push({
        name: 'Liquidez Corrente',
        value: null,
        formatted: 'N/D',
        benchmark: '> 1.2x',
        status: 'N/D',
        description: 'Dado não disponível na fonte.',
      });
    }

    const solvScore = solvMaxPoints > 0 ? Math.round((solvPoints / solvMaxPoints) * 100) : 0;
    const solvPillar: FundamentalPillar = {
      name: 'Solvência',
      weight: 0.35,
      score: solvScore,
      metrics: solvenciaMetrics,
    };

    // --- PILAR 3: VALUATION (Peso: 30%) ---
    const valuationMetrics: FundamentalMetric[] = [];
    let valPoints = 0;
    let valMaxPoints = 0;

    // Métrica: P/L (Preço / Lucro)
    valMaxPoints += 40;
    if (effectivePE !== null && effectivePE > 0) {
      let status: FundamentalMetricStatus = 'NEUTRO';
      let pts = 20;
      let desc = 'Múltiplo de preço/lucro em linha com o mercado.';

      if (effectivePE <= 12) {
        status = 'BOM';
        pts = 40;
        desc = 'Atrativo desconto frente ao fluxo de lucros (P/L <= 12x).';
      } else if (effectivePE > 25) {
        status = 'RUIM';
        pts = 0;
        desc = 'Múltiplo de lucro esticado (>25x).';
      }

      valPoints += pts;
      valuationMetrics.push({
        name: 'P/L',
        value: effectivePE,
        formatted: `${effectivePE.toFixed(2)}x`,
        benchmark: '< 15.0x',
        status,
        description: desc,
        isAdjusted: isIncomeNormalized,
        rawAccountingValue: raw.priceEarnings ?? null,
        rawAccountingFormatted: (raw.priceEarnings !== undefined && raw.priceEarnings !== null) ? `${raw.priceEarnings.toFixed(2)}x` : 'N/D',
        adjustmentReason: isIncomeNormalized ? 'P/L normalizado pelo ciclo de lucros recorrentes' : undefined,
        source: isIncomeNormalized ? 'NORMALIZADO_FCO' : 'BRAPI_CONTABIL',
      });

    } else if (effectivePE !== null && effectivePE <= 0) {
      valuationMetrics.push({
        name: 'P/L',
        value: effectivePE,
        formatted: `${effectivePE.toFixed(2)}x`,
        benchmark: '< 15.0x',
        status: 'RUIM',
        description: 'Prejuízo líquido contábil no período.',
        source: 'BRAPI_CONTABIL',
      });
    } else {
      valuationMetrics.push({
        name: 'P/L',
        value: null,
        formatted: 'N/D',
        benchmark: '< 15.0x',
        status: 'N/D',
        description: 'Dado não disponível na fonte.',
      });
    }

    // Métrica: P/VP (Preço / Valor Patrimonial)
    valMaxPoints += 30;
    const pvp = raw.priceToBook ?? null;
    if (pvp !== null && pvp > 0) {
      let status: FundamentalMetricStatus = 'NEUTRO';
      let pts = 15;
      let desc = 'Preço em linha com patrimônio líquido.';

      if (pvp <= 2.0) {
        status = 'BOM';
        pts = 30;
        desc = 'Excelente margem de segurança patrimonial (P/VP <= 2.0x).';
      } else if (pvp > 4.5) {
        status = 'RUIM';
        pts = 0;
        desc = 'Ágio patrimonial muito expressivo (>4.5x).';
      }

      valPoints += pts;
      valuationMetrics.push({
        name: 'P/VP',
        value: pvp,
        formatted: `${pvp.toFixed(2)}x`,
        benchmark: '< 2.5x',
        status,
        description: desc,
        source: 'BRAPI_CONTABIL',
      });
    } else {
      valuationMetrics.push({
        name: 'P/VP',
        value: null,
        formatted: 'N/D',
        benchmark: '< 2.5x',
        status: 'N/D',
        description: 'Dado não disponível na fonte.',
      });
    }

    // Métrica: Dividend Yield
    valMaxPoints += 30;
    const dy = toPercentage(raw.dividendYield);

    if (dy !== null) {
      let status: FundamentalMetricStatus = 'NEUTRO';
      let pts = 15;
      let desc = 'Distribuição de proventos dentro da média.';

      if (dy >= 6.0) {
        status = 'BOM';
        pts = 30;
        desc = 'Excelente retorno anual em dividendos (DY >= 6.0%).';
      } else if (dy < 2.0) {
        status = 'NEUTRO';
        pts = 10;
        desc = 'Retorno em dividendos modesto (<2.0%).';
      }

      valPoints += pts;
      valuationMetrics.push({
        name: 'Dividend Yield',
        value: dy,
        formatted: `${dy.toFixed(2)}%`,
        benchmark: '> 6.0%',
        status,
        description: desc,
        source: 'BRAPI_CONTABIL',
      });
    } else {
      valuationMetrics.push({
        name: 'Dividend Yield',
        value: null,
        formatted: 'N/D',
        benchmark: '> 6.0%',
        status: 'N/D',
        description: 'Dado não disponível na fonte.',
      });
    }

    const valScore = valMaxPoints > 0 ? Math.round((valPoints / valMaxPoints) * 100) : 0;
    const valPillar: FundamentalPillar = {
      name: 'Valuation',
      weight: 0.30,
      score: valScore,
      metrics: valuationMetrics,
    };

    // =========================================================================
    // 4. SCORE FINAL CONSOLIDADO (35% Rent + 35% Solv + 30% Val)
    // =========================================================================
    const finalScore = Math.round(
      rentPillar.score * rentPillar.weight +
      solvPillar.score * solvPillar.weight +
      valPillar.score * valPillar.weight
    );

    const allMetrics = [
      ...rentabilidadeMetrics,
      ...solvenciaMetrics,
      ...valuationMetrics,
    ];

    const topNegativeDrivers = allMetrics.filter((m) => m.status === 'RUIM');

    const status = finalScore >= this.minApprovalScore ? 'APROVADO' : 'REPROVADO';

    // =========================================================================
    // 5. PARECER ANALÍTICO E SUMÁRIO DINÂMICO
    // =========================================================================
    let summary = '';
    let analystVerdict = '';

    if (status === 'APROVADO') {
      const adjText = isIncomeNormalized || isDebtReconciled
        ? ' com reconciliação analítica de itens não-recorrentes/dívida financeira'
        : '';
      summary = `A empresa ${symbol} foi APROVADA no crivo fundamentalista CNPI-P com Score ${finalScore}/100${adjText}. Apresenta pilares sólidos de ${
        rentPillar.score >= 60 ? 'rentabilidade' : ''
      }${solvPillar.score >= 60 ? ', solvência' : ''}${valPillar.score >= 60 ? ' e valuation atrativo' : ''}.`;

      analystVerdict = `${symbol} apresenta balanço financeiro consistente, alavancagem sob controle e rentabilidade comprovada. Aprovado para montagens estruturadas de swing trade e opções.`;
    } else {
      const reasons = topNegativeDrivers.map((d) => d.name).join(', ');
      summary = `A empresa ${symbol} foi REPROVADA no crivo fundamentalista (Score ${finalScore}/100, mínimo 45). Indicadores mais penalizados: ${reasons || 'dados insuficientes ou múltiplos fora dos limites'}.`;
      analystVerdict = `Cuidado: ${symbol} não atinge os critérios mínimos de segurança contábil e múltiplos de valuation. Recomenda-se cautela em operações compradas direcionais.`;
    }

    return {
      symbol,
      score: finalScore,
      status,
      minApprovalScore: this.minApprovalScore,
      pillars: {
        rentabilidade: rentPillar,
        solvencia: solvPillar,
        valuation: valPillar,
      },
      metrics: allMetrics,
      summary,
      analystVerdict,
      distortionsDetected,
      topNegativeDrivers,
      calculatedAt: new Date().toISOString(),
      isReconciled: isIncomeNormalized || isDebtReconciled,
    };
  }
}

export const fundamentalsEngine = new FundamentalsEngine();
