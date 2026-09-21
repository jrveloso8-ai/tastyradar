import { SP500_DATASET } from '../src/lib/domain/sp500-dataset';
import { US_STOCKS_DATASET } from '../src/lib/domain/us-market-data';

const map = new Map<string, { symbol: string; sector: string; source: string }>();

for (const s of SP500_DATASET) {
  map.set(s.symbol, { symbol: s.symbol, sector: s.sector, source: 'sp500-dataset' });
}

for (const u of US_STOCKS_DATASET) {
  if (!map.has(u.symbol)) {
    map.set(u.symbol, { symbol: u.symbol, sector: u.sector, source: 'us-market-data' });
  }
}

console.log('SP500_DATASET count:', SP500_DATASET.length);
console.log('US_STOCKS_DATASET count:', US_STOCKS_DATASET.length);
console.log('Total únicos combinados:', map.size);

const exclusiveUs = Array.from(map.values()).filter(x => x.source === 'us-market-data');
console.log('Tickers exclusivos de us-market-data (' + exclusiveUs.length + '):', exclusiveUs.map(x => x.symbol).join(', '));
