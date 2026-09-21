import { CURATED_80_UNIVERSE, EXCLUDED_DUPLICATE_CLASSES } from '../scripts/run-shadow-screener';

console.log('=== PROVA: CURATED_80_UNIVERSE PÓS-DESDUPLICAÇÃO ===');
console.log('Exclusões aplicadas:', Array.from(EXCLUDED_DUPLICATE_CLASSES).join(', '));
console.log('Contagem exata:', CURATED_80_UNIVERSE.length);

console.log('\n--- Lista dos 80 Tickers com Setores ---');
CURATED_80_UNIVERSE.sort((a, b) => a.symbol.localeCompare(b.symbol)).forEach((item, idx) => {
  console.log(`${idx + 1}. [${item.symbol}] ${item.sector}`);
});

// Verificação de que GOOG não está presente e GOOGL está presente
const hasGoog = CURATED_80_UNIVERSE.some(x => x.symbol === 'GOOG');
const hasGoogl = CURATED_80_UNIVERSE.some(x => x.symbol === 'GOOGL');
console.log(`\nVerificação Alphabet: GOOG presente? ${hasGoog} | GOOGL presente? ${hasGoogl}`);
