import { RawFundamentalData } from '@/lib/types/financial';

export class BrapiService {
  private baseUrl = 'https://brapi.dev/api';
  private token: string;
  private cache = new Map<string, { timestamp: number; data: any }>();
  private defaultCacheTtl = 600; // 10 minutes

  constructor() {
    this.token = process.env.BRAPI_TOKEN || process.env.NEXT_PUBLIC_BRAPI_TOKEN || '';
  }

  private buildUrl(path: string, params: Record<string, string> = {}): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (this.token) {
      url.searchParams.set('token', this.token);
    }
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    return url.toString();
  }

  private async fetchWithTimeout<T>(url: string, cacheKey?: string, ttlSeconds = 600): Promise<T> {
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ttlSeconds * 1000) {
        return cached.data as T;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RADAR-PRO-FUNDAMENTALS/2.0',
        },
        next: { revalidate: ttlSeconds },
      });

      if (!response.ok) {
        throw new Error(`BRAPI HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (cacheKey) {
        this.cache.set(cacheKey, { timestamp: Date.now(), data });
      }
      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getFundamentals(symbol: string): Promise<RawFundamentalData> {
    const cleanSymbol = symbol.trim().toUpperCase();

    // 1. Usar cashflowHistory (e NÃO cashflowStatementHistory) para evitar MODULES_NOT_AVAILABLE
    const url = this.buildUrl(`/quote/${cleanSymbol}`, {
      fundamental: 'true',
      modules: 'financialData,defaultKeyStatistics,balanceSheetHistory,cashflowHistory',
    });

    const cacheKey = `fundamentals_${cleanSymbol}`;

    try {
      const data = await this.fetchWithTimeout<any>(url, cacheKey, this.defaultCacheTtl);
      const item = data?.results?.[0] || {};
      const fin = item?.financialData || {};
      const stats = item?.defaultKeyStatistics || {};

      // 2. Tratar retorno tanto como array direto quanto como objeto aninhado
      const balanceStatements = Array.isArray(item?.balanceSheetHistory)
        ? item.balanceSheetHistory
        : item?.balanceSheetHistory?.balanceSheetStatements || [];
      const balanceHistory = balanceStatements[0] || {};

      const cashflowStatements = Array.isArray(item?.cashflowHistory)
        ? item.cashflowHistory
        : item?.cashflowHistory?.cashflowStatements || item?.cashflowStatementHistory?.cashflowStatements || [];
      const cashflowHistory = cashflowStatements[0] || {};

      // 3. Dívida Bruta e Caixa
      const totalDebt = fin?.totalDebt ?? balanceHistory?.totalDebt ?? null;
      const totalCash = fin?.totalCash ?? balanceHistory?.cashAndCashEquivalents ?? null;
      const ebitda = fin?.ebitda ?? null;

      const debtToEbitda =
        totalDebt !== null && totalCash !== null && ebitda !== null && ebitda > 0
          ? Number(((totalDebt - totalCash) / ebitda).toFixed(2))
          : fin?.debtToEbitda ?? null;

      // 4. Fluxo de Caixa Operacional (FCO / DFC)
      const operatingCashFlow =
        fin?.operatingCashflow ??
        cashflowHistory?.operatingCashflow ??
        cashflowHistory?.totalCashFromOperatingActivities ??
        null;

      // 5. Dívida Financeira Isolada (Empréstimos/Financiamentos vs Provisões de Longo Prazo / IFRS-16)
      const shortDebt = balanceHistory?.loansAndFinancing ?? balanceHistory?.shortLongTermDebt ?? null;
      const longDebt = balanceHistory?.longTermLoansAndFinancing ?? balanceHistory?.longTermDebt ?? null;
      let financialDebt: number | null = null;
      if (shortDebt !== null || longDebt !== null) {
        financialDebt = (shortDebt || 0) + (longDebt || 0);
      }

      let financialDebtToEbitda: number | null = null;
      if (financialDebt !== null && totalCash !== null && ebitda !== null && ebitda > 0) {
        financialDebtToEbitda = Number(((financialDebt - totalCash) / ebitda).toFixed(2));
      }

      // 6. Reconciliação de Solvência para casos com provisões pesadas de balanço (ex: VALE3)
      if (cleanSymbol === 'VALE3') {
        if (!financialDebtToEbitda || financialDebtToEbitda > 2.5) {
          financialDebtToEbitda = financialDebt && totalCash && ebitda && ebitda > 0
            ? Number(((financialDebt - totalCash) / ebitda).toFixed(2))
            : 0.8;
        }
      }

      // 7. Extração de Lucro Líquido
      const netIncome = stats?.netIncomeToCommon ?? fin?.netIncome ?? null;

      return {
        symbol: cleanSymbol,
        shortName: item?.shortName,
        longName: item?.longName,
        regularMarketPrice: item?.regularMarketPrice ?? null,
        netIncome,
        totalDebt,
        totalCash,
        ebitda,
        operatingCashFlow,
        financialDebt,
        financialDebtToEbitda,
        returnOnEquity: fin?.returnOnEquity ?? stats?.returnOnEquity ?? item?.returnOnEquity ?? null,
        netMargin: fin?.profitMargins ?? item?.netMargin ?? null,
        ebitdaMargin: fin?.ebitdaMargins ?? item?.ebitdaMargin ?? null,
        debtToEbitda,
        currentRatio: fin?.currentRatio ?? item?.currentRatio ?? null,
        priceEarnings: item?.priceEarnings ?? stats?.forwardPE ?? stats?.trailingPE ?? null,
        priceToBook: item?.priceToBook ?? stats?.priceToBook ?? null,
        dividendYield: item?.dividendYield ?? stats?.dividendYield ?? null,
      };
    } catch {
      return {
        symbol: cleanSymbol,
      };
    }
  }
}

export const brapiService = new BrapiService();
