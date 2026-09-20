import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { applyApiGuard, withSessionCookie } from '@/lib/security/api-guard';

/**
 * REGRA 00 — INTEGRIDADE DO DADO EXIBIDO
 * API DE LEITURA DO MODO SOMBRA (SHADOW RUN AUDIT)
 *
 * Expõe estritamente os logs persistidos dos ciclos de auditoria do Screener V1.
 * Nenhum dado é gerado sinteticamente ou inventado nesta rota.
 */
export async function GET(request: NextRequest) {
  const guard = applyApiGuard(request, { maxRequestsPerKey: 60, windowMs: 60_000, globalMaxRequests: 600 });
  if (!guard.ok) return withSessionCookie(guard.response!, guard);

  const logDir = path.join(process.cwd(), 'docs', 'logs', 'shadow-mode');

  if (!fs.existsSync(logDir)) {
    return withSessionCookie(
      NextResponse.json({
        success: true,
        runs: [],
        latestRun: null,
        message: 'Nenhum ciclo de modo sombra registrado até o momento.',
      }),
      guard
    );
  }

  try {
    const files = fs.readdirSync(logDir);
    const jsonFiles = files
      .filter((f) => f.startsWith('shadow-run-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (jsonFiles.length === 0) {
      return withSessionCookie(
        NextResponse.json({
          success: true,
          runs: [],
          latestRun: null,
        }),
        guard
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedFile = searchParams.get('file');

    // Se um arquivo específico foi requisitado (com proteção contra directory traversal)
    if (requestedFile) {
      const sanitized = path.basename(requestedFile);
      const filePath = path.join(logDir, sanitized);
      if (fs.existsSync(filePath) && sanitized.endsWith('.json')) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return withSessionCookie(
          NextResponse.json({
            success: true,
            run: content,
            fileList: jsonFiles,
          }),
          guard
        );
      } else {
        return withSessionCookie(
          NextResponse.json({ success: false, error: 'Arquivo de ciclo não encontrado.' }, { status: 404 }),
          guard
        );
      }
    }

    // Por padrão: lista todos os arquivos disponíveis e carrega o mais recente
    const latestPath = path.join(logDir, jsonFiles[0]);
    const latestRun = JSON.parse(fs.readFileSync(latestPath, 'utf8'));

    const runsSummary = jsonFiles.map((f) => {
      return {
        filename: f,
        createdAt: f.replace('shadow-run-', '').replace('.json', ''),
      };
    });

    return withSessionCookie(
      NextResponse.json({
        success: true,
        availableRuns: runsSummary,
        latestRun,
      }),
      guard
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar logs';
    return withSessionCookie(
      NextResponse.json(
        {
          success: false,
          error: `Falha na leitura dos logs de auditoria: ${errorMessage}`,
        },
        { status: 500 }
      ),
      guard
    );
  }
}
