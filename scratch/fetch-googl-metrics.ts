import { tastyAuthService } from '../src/lib/services/tastytrade-auth.service';

async function main() {
  const token = await tastyAuthService.getAccessToken();
  const res = await fetch('https://api.tastytrade.com/market-metrics?symbols=GOOGL', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'RadarTastytrade/1.0',
    },
  });
  console.log('HTTP STATUS:', res.status);
  const data = await res.json();
  console.log('PAYLOAD COMPLETO:');
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error('ERRO:', err);
  process.exit(1);
});
