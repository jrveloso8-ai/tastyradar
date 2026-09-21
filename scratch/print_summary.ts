import fs from 'fs';
import path from 'path';

const results = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs/fontes/pipeline-live-run-results.json'), 'utf8'));

for (const r of results) {
  console.log('====================================================');
  console.log(`TICKER: ${r.candidate.symbol} (${r.candidate.sector})`);
  console.log(`Status: ${r.status}`);
  console.log(`RejectionStage: ${r.rejectionStage || 'NONE'}`);
  console.log(`RejectionReason: ${r.rejectionReason || 'NONE'}`);
  console.log('L0 Output:', {
    hv12m: r.layer0.hv12m,
    hv12mTrimmed: r.layer0.hv12mTrimmed,
    hvDropRatio: r.layer0.hvDropRatio,
    hv12mPercentile: r.layer0.hv12mPercentile,
    passesHvPercentile: r.layer0.passesHvPercentile,
    passesStability: r.layer0.passesStability,
    sectorQuotaApproved: r.layer0.sectorQuotaApproved,
    rejectionCode: r.layer0.rejectionCode,
  });
  if (r.layer1) {
    console.log('L1 Output:', {
      bbwCurrent: r.layer1.bbwCurrent,
      bbwHistoryPercentile: r.layer1.bbwHistoryPercentile,
      passesSqueeze: r.layer1.passesSqueeze,
      rejectionCode: r.layer1.rejectionCode,
    });
  }
  if (r.layer2) {
    console.log('L2 Output:', {
      selectedExpiration: r.layer2.selectedExpiration,
      ivRank: r.layer2.ivRank,
      ivPercentile: r.layer2.ivPercentile,
      atmIv: r.layer2.atmIv,
      passesIvFilter: r.layer2.passesIvFilter,
      rejectionCode: r.layer2.rejectionCode,
    });
  }
  if (r.strategy) {
    console.log('Strategy Output:', {
      structureType: r.strategy.structureType,
      expiration: r.strategy.expiration.expirationDate,
      callLeg: {
        strike: r.strategy.callLeg.strike,
        bid: r.strategy.callLeg.bid,
        ask: r.strategy.callLeg.ask,
        mid: r.strategy.callLeg.mid,
        spread: r.strategy.callLeg.relativeSpread,
        oi: r.strategy.callLeg.openInterest,
        passes: r.strategy.callLeg.passesLiquidity,
      },
      putLeg: {
        strike: r.strategy.putLeg.strike,
        bid: r.strategy.putLeg.bid,
        ask: r.strategy.putLeg.ask,
        mid: r.strategy.putLeg.mid,
        spread: r.strategy.putLeg.relativeSpread,
        oi: r.strategy.putLeg.openInterest,
        passes: r.strategy.putLeg.passesLiquidity,
      },
      provenance: r.strategy.provenance,
      reason: r.strategy.deterministicReason,
    });
  }
}
