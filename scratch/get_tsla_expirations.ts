import { tastyMarketService } from '../src/lib/services/tastytrade-market.service';

async function main() {
  const chain = await tastyMarketService.getOptionChain('TSLA', true);
  if (!chain) {
    console.error('Falha ao obter cadeia de opções de TSLA');
    process.exit(1);
  }

  const exps = chain.expirations.map(e => ({
    expirationDate: e.expirationDate,
    daysToExpiration: e.daysToExpiration,
    expirationType: e.expirationType,
    settlementType: e.settlementType,
  }));

  console.log('=== LISTA COMPLETA DE CICLOS DE VENCIMENTO DO TSLA ===');
  console.log(`Total de ciclos: ${exps.length}`);
  console.table(exps);
  console.log(JSON.stringify(exps, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
