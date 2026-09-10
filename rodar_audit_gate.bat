@echo off
setlocal EnableDelayedExpansion
title Portao de Auditoria - RADAR-TASYTRADE
cd /d "%~dp0"
set "PATH=C:\Program Files\Git\usr\bin;%PATH%"

echo ===================================================
echo   Portao de Auditoria (Audit Gate) - RADAR-TASYTRADE
echo ===================================================
echo.
echo Regra de ouro: se algum teste falhar, a correcao e no
echo codigo de producao (QuoteView.tsx, ai-consultant.ts,
echo gex-engine.ts, us-market-data.ts, sp500-dataset.ts,
echo README.md, .eslintrc.json etc) - NUNCA em
echo tests\audit-gate.test.ts.
echo.

if not exist node_modules (
    echo node_modules nao encontrado. Rodando "npm install" primeiro...
    echo ^(isso pode levar alguns minutos^)
    echo.
    call npm install
    echo.
)

echo Executando toda a pasta tests\ (audit-gate.test.ts + provenance.test.ts + qualquer teste novo) ...
echo ---------------------------------------------------
call npx vitest run tests/
set GATE_RESULT=%ERRORLEVEL%
echo ---------------------------------------------------
echo.

echo Verificando REGRA 00 (ESLint: no-raw-numbers/toFixed em components + fallback magico em domain/services) ...
echo ---------------------------------------------------
call npx eslint src/components --ext .tsx,.jsx
set ESLINT_RESULT=%ERRORLEVEL%
call npx eslint src/lib/domain src/lib/services --ext .ts
if !ERRORLEVEL! NEQ 0 set ESLINT_RESULT=!ERRORLEVEL!
echo ---------------------------------------------------
echo.

echo Verificando se o codigo COMMITADO compila sozinho (git stash + tsc) ...
echo ^(isso pega o caso de um commit depender de arquivo que ficou so na pasta,
echo   sem nunca ter sido commitado - passar no teste acima NAO garante isso^)
echo ---------------------------------------------------
set STATUS_OUT=%TEMP%\audit_gate_status_out.txt
git status --porcelain > "%STATUS_OUT%" 2>nul
set DIRTY_COUNT=0
for %%A in ("%STATUS_OUT%") do if %%~zA GTR 0 set DIRTY_COUNT=1
del "%STATUS_OUT%" >nul 2>&1
set TSC_RESULT=0
set TSC_OUT=%TEMP%\audit_gate_tsc_out.txt

if "%DIRTY_COUNT%"=="0" (
    echo Pasta de trabalho ja esta limpa - typecheck roda direto no HEAD.
    call npx tsc --noEmit > "%TSC_OUT%" 2>&1
    type "%TSC_OUT%"
    findstr /I /V "next\types next/types" "%TSC_OUT%" | findstr /I "error TS" >nul
    if !ERRORLEVEL! EQU 0 (set TSC_RESULT=1) else (set TSC_RESULT=0)
) else (
    echo Ha arquivo^(s^) nao commitado^(s^). Isolando o HEAD com
    echo "git stash" para checar se o que esta COMMITADO compila sozinho...
    call git stash --include-untracked -m "audit-gate-typecheck-temp"
    call npx tsc --noEmit > "%TSC_OUT%" 2>&1
    type "%TSC_OUT%"
    findstr /I /V "next\types next/types" "%TSC_OUT%" | findstr /I "error TS" >nul
    if !ERRORLEVEL! EQU 0 (set TSC_RESULT=1) else (set TSC_RESULT=0)
    echo Restaurando a pasta de trabalho...
    call git stash pop
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo ===================================================
        echo ATENCAO: "git stash pop" NAO restaurou a pasta de trabalho
        echo automaticamente ^(pode ser um arquivo em conflito^). Suas
        echo mudancas NAO foram perdidas - elas continuam guardadas em
        echo "git stash list". NAO feche esta janela ainda: rode
        echo "git stash show stash@{0} --stat" para ver o que esta
        echo pendente e resolva o conflito antes de continuar, ou peca
        echo ajuda ao auditor.
        echo ===================================================
        echo.
    )
)
del "%TSC_OUT%" >nul 2>&1
echo ---------------------------------------------------
echo.
echo DIAGNOSTICO INTERNO ^(nao apague esta linha ao colar o resultado^):
echo   DIRTY_COUNT=%DIRTY_COUNT% TSC_RESULT=%TSC_RESULT%
echo.

if %GATE_RESULT% NEQ 0 (
    echo RESULTADO: AINDA HA ACHADO^(S^) PENDENTE^(S^) ^(veja as falhas em vermelho acima^).
    echo Corrija o codigo apontado por cada teste e rode este .bat de novo.
) else if %TSC_RESULT% NEQ 0 (
    echo RESULTADO: TESTES DO GATE PASSARAM, MAS O CODIGO COMMITADO NAO COMPILA
    echo ^(veja os erros de typecheck acima^). Isso significa que algum commit
    echo depende de arquivo que ainda nao foi commitado. Commite o que falta
    echo e rode este .bat de novo antes de reportar a rodada como fechada.
) else if %ESLINT_RESULT% NEQ 0 (
    echo RESULTADO: TESTES E TYPECHECK PASSARAM, MAS HA VIOLACAO DA REGRA 00
    echo ^(.toFixed^(^) solto em JSX fora de DataValue.tsx - veja os erros do
    echo ESLint acima^). Isso e esperado durante a migracao das telas para
    echo ^<DataValue /^> ^(Fase 2^) - nao e uma regressao nova, e o debito que
    echo a migracao precisa zerar tela por tela. So considere a rodada
    echo fechada quando a tela que voce esta migrando nesta rodada nao
    echo aparecer mais nesta lista.
) else (
    echo RESULTADO: TODOS OS TESTES DO GATE PASSARAM, O CODIGO COMMITADO COMPILA
    echo E NAO HA VIOLACAO DA REGRA 00.
)

echo.
echo ===================================================
echo Esta janela NAO vai fechar sozinha.
echo Copie o resultado acima e feche manualmente quando terminar.
echo ===================================================
echo.
cmd /k
