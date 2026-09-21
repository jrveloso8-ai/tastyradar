import { SP500_DATASET } from '../src/lib/domain/sp500-dataset';
import { US_STOCKS_DATASET } from '../src/lib/domain/us-market-data';

// Monta lista com ticker e nome da empresa para análise de duplicação
const allEntries: { symbol: string; name: string; sector: string; source: string }[] = [];

for (const s of SP500_DATASET) {
  allEntries.push({ symbol: s.symbol, name: s.name, sector: s.sector, source: 'SP500_DATASET' });
}

for (const u of US_STOCKS_DATASET) {
  const existing = allEntries.find(e => e.symbol === u.symbol);
  if (!existing) {
    allEntries.push({ symbol: u.symbol, name: u.name, sector: u.sector, source: 'US_STOCKS_DATASET' });
  }
}

console.log(`Total inicial: ${allEntries.length}`);

// Busca por pares de tickers com mesmo prefixo de base ou nomes similares
const baseSymbols = new Map<string, string[]>();
for (const e of allEntries) {
  // Limpa sufixos de classe comuns (.A, .B, /A, /B, etc) ou tickers de 4 letras que compartilham as 3 primeiras
  const base4 = e.symbol.length === 5 ? e.symbol.slice(0, 4) : e.symbol.length === 4 ? e.symbol.slice(0, 3) : e.symbol;
  const list = baseSymbols.get(base4) || [];
  list.push(e.symbol);
  baseSymbols.set(base4, list);
}

console.log('\n--- Agrupamentos por prefixo similar ---');
for (const [base, list] of baseSymbols.entries()) {
  if (list.length > 1) {
    console.log(`Prefixo "${base}": ${list.join(', ')}`);
  }
}

console.log('\n--- Todos os 81 ativos com nomes empresariais ---');
allEntries.sort((a, b) => a.symbol.localeCompare(b.symbol)).forEach((e, idx) => {
  console.log(`${idx + 1}. [${e.symbol}] ${e.name} (${e.sector}) [${e.source}]`);
});
