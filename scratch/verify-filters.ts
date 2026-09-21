import fs from 'fs';
import path from 'path';
import { ScreenerCandidateStatus, ScreenerRejectionStage } from '../src/lib/types/low-vol-screener.types';

const jsonPath = path.join(process.cwd(), 'docs', 'logs', 'shadow-mode', 'shadow-run-2026-09-16T15-11-52-325Z.json');
const raw = fs.readFileSync(jsonPath, 'utf8');
const runData = JSON.parse(raw);

const evaluations = runData.detailedEvaluations;

console.log('=== VERIFICAÇÃO REAL DE FILTROS CONTRA CICLO 1 ===');
console.log(`Total de avaliações no JSON: ${evaluations.length}\n`);

// 1. Filtro de Status: Todos
const allCount = evaluations.length;
console.log(`Filtro Status: 'ALL' -> ${allCount} itens`);

// 2. Filtro de Status: APPROVED_FOR_EXECUTION
const approved = evaluations.filter((e: any) => e.status === 'APPROVED_FOR_EXECUTION');
console.log(`Filtro Status: 'APPROVED_FOR_EXECUTION' -> ${approved.length} itens: [${approved.map((e: any) => e.symbol).join(', ')}]`);

// 3. Filtro de Status: REJECTED
const rejected = evaluations.filter((e: any) => e.status === 'REJECTED');
console.log(`Filtro Status: 'REJECTED' -> ${rejected.length} itens`);

// 4. Filtro de Estágio: LAYER_0
const stageL0 = evaluations.filter((e: any) => e.rejectionStage === 'LAYER_0');
console.log(`Filtro Estágio: 'LAYER_0' -> ${stageL0.length} itens: [${stageL0.map((e: any) => e.symbol).join(', ')}]`);

// 5. Filtro de Estágio: LAYER_1
const stageL1 = evaluations.filter((e: any) => e.rejectionStage === 'LAYER_1');
console.log(`Filtro Estágio: 'LAYER_1' -> ${stageL1.length} itens: [${stageL1.map((e: any) => e.symbol).join(', ')}]`);

// 6. Filtro de Estágio: LAYER_2
const stageL2 = evaluations.filter((e: any) => e.rejectionStage === 'LAYER_2');
console.log(`Filtro Estágio: 'LAYER_2' -> ${stageL2.length} itens: [${stageL2.map((e: any) => e.symbol).join(', ')}]`);

// 7. Filtro de Estágio: LAYER_3_LIQUIDITY
const stageL3 = evaluations.filter((e: any) => e.rejectionStage === 'LAYER_3_LIQUIDITY');
console.log(`Filtro Estágio: 'LAYER_3_LIQUIDITY' -> ${stageL3.length} itens: [${stageL3.map((e: any) => e.symbol).join(', ')}]`);

// Conferência da soma do funil
console.log(`\nSoma dos rejeitados por camada: ${stageL0.length + stageL1.length + stageL2.length + stageL3.length}`);
console.log(`Total (Rejeitados + Aprovados): ${stageL0.length + stageL1.length + stageL2.length + stageL3.length + approved.length} / ${evaluations.length}`);
