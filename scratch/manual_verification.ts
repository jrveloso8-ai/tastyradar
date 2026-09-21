import fs from 'fs';
import path from 'path';

const results = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs/fontes/pipeline-live-run-results.json'), 'utf8'));

const tsla = results.find((r: any) => r.candidate.symbol === 'TSLA');
const nvda = results.find((r: any) => r.candidate.symbol === 'NVDA');

console.log('--- TSLA DETAILS ---');
const tslaLastBar = tsla.candidate.bars[tsla.candidate.bars.length - 1];
console.log('TSLA last bar:', tslaLastBar);
const tslaCloses = tsla.candidate.bars.slice(-20).map((b: any) => b.close);
console.log('TSLA last 20 closes:', tslaCloses);

// Média manual
const sumTsla = tslaCloses.reduce((a: number, b: number) => a + b, 0);
const smaTsla = sumTsla / 20;
console.log('TSLA SMA(20):', smaTsla);

// StdDev manual
const sumSqDiffTsla = tslaCloses.reduce((acc: number, c: number) => acc + Math.pow(c - smaTsla, 2), 0);
const stdDevTsla = Math.sqrt(sumSqDiffTsla / 20);
console.log('TSLA StdDev(20):', stdDevTsla);

const upperTsla = smaTsla + 2 * stdDevTsla;
const lowerTsla = smaTsla - 2 * stdDevTsla;
const bbwTsla = ((upperTsla - lowerTsla) / smaTsla) * 100;
console.log('TSLA Upper:', upperTsla, 'Lower:', lowerTsla, 'BBW:', bbwTsla);

console.log('\n--- NVDA DETAILS ---');
const nvdaLastBar = nvda.candidate.bars[nvda.candidate.bars.length - 1];
console.log('NVDA last bar:', nvdaLastBar);
const nvdaCloses = nvda.candidate.bars.slice(-20).map((b: any) => b.close);
console.log('NVDA last 20 closes:', nvdaCloses);
const sumNvda = nvdaCloses.reduce((a: number, b: number) => a + b, 0);
const smaNvda = sumNvda / 20;
const sumSqDiffNvda = nvdaCloses.reduce((acc: number, c: number) => acc + Math.pow(c - smaNvda, 2), 0);
const stdDevNvda = Math.sqrt(sumSqDiffNvda / 20);
const upperNvda = smaNvda + 2 * stdDevNvda;
const lowerNvda = smaNvda - 2 * stdDevNvda;
const bbwNvda = ((upperNvda - lowerNvda) / smaNvda) * 100;
console.log('NVDA SMA(20):', smaNvda, 'StdDev(20):', stdDevNvda, 'BBW:', bbwNvda);
