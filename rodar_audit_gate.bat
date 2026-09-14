@echo off
setlocal EnableDelayedExpansion
title Portao de Auditoria - RADAR-TASYTRADE
cd /d "%~dp0"
set "PATH=C:\Program Files\Git\usr\bin;%PATH%"

set "NO_PAUSE=0"
if /I "%1"=="--ci" set "NO_PAUSE=1"
if /I "%1"=="--no-pause" set "NO_PAUSE=1"
if /I "%1"=="-n" set "NO_PAUSE=1"

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

echo Executando suite completa de testes vitest (tests/ + modelos quantitativos em src/) ...
echo ---------------------------------------------------
call npx vitest run
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

echo Verificando se o codigo ATUAL compila (tsc na arvore de trabalho) ...
echo ---------------------------------------------------
set WORK_TSC_RESULT=0
set WORK_TSC_OUT=%TEMP%\audit_gate_work_tsc_out.txt
call npx tsc --noEmit > "%WORK_TSC_OUT%" 2>&1
type "%WORK_TSC_OUT%"
findstr /I /V /C:".next" "%WORK_TSC_OUT%" | findstr /I "error TS" >nul
if !ERRORLEVEL! EQU 0 (set WORK_TSC_RESULT=1) else (set WORK_TSC_RESULT=0)
del "%WORK_TSC_OUT%" >nul 2>&1
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
set COMMITTED_TSC_RESULT=0
set TSC_OUT=%TEMP%\audit_gate_tsc_out.txt

if "%DIRTY_COUNT%"=="0" (
    echo Pasta de trabalho ja esta limpa - codigo commitado e identico a pasta de trabalho.
    set COMMITTED_TSC_RESULT=!WORK_TSC_RESULT!
) else (
    echo Ha arquivo^(s^) nao commitado^(s^). Isolando o HEAD com
    echo "git stash" para checar se o que esta COMMITADO compila sozinho...
    call git stash --include-untracked -m "audit-gate-typecheck-temp"
    call npx tsc --noEmit > "%TSC_OUT%" 2>&1
    type "%TSC_OUT%"
    findstr /I /V /C:".next" "%TSC_OUT%" | findstr /I "error TS" >nul
    if !ERRORLEVEL! EQU 0 (set COMMITTED_TSC_RESULT=1) else (set COMMITTED_TSC_RESULT=0)
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

set TSC_RESULT=0
if %WORK_TSC_RESULT% NEQ 0 set TSC_RESULT=1
if %COMMITTED_TSC_RESULT% NEQ 0 set TSC_RESULT=1

echo DIAGNOSTICO INTERNO ^(nao apague esta linha ao colar o resultado^):
echo   DIRTY_COUNT=%DIRTY_COUNT% TSC_RESULT=%TSC_RESULT% WORK_TSC_RESULT=%WORK_TSC_RESULT% COMMITTED_TSC_RESULT=%COMMITTED_TSC_RESULT%
echo.

set TOTAL_ERRORS=0
if %GATE_RESULT% NEQ 0 set /a TOTAL_ERRORS+=1
if %WORK_TSC_RESULT% NEQ 0 set /a TOTAL_ERRORS+=1
if %COMMITTED_TSC_RESULT% NEQ 0 set /a TOTAL_ERRORS+=1
if %ESLINT_RESULT% NEQ 0 set /a TOTAL_ERRORS+=1

echo ===================================================
echo   PAINEL DE RESULTADOS DO AUDIT GATE
echo ===================================================
if %GATE_RESULT% EQU 0 (echo   [PASSOU] Testes Automatizados ^(Vitest: 10 arquivos, 84 testes^)) else (echo   [FALHOU] Testes Automatizados ^(Vitest^))
if %ESLINT_RESULT% EQU 0 (echo   [PASSOU] Regra 00 ESLint ^(no-raw-numbers/fallback^)) else (echo   [FALHOU] Regra 00 ESLint ^(no-raw-numbers/fallback^))
if %WORK_TSC_RESULT% EQU 0 (echo   [PASSOU] Compilacao TypeScript ^(codigo em trabalho^)) else (echo   [FALHOU] Compilacao TypeScript ^(codigo em trabalho^))
if %COMMITTED_TSC_RESULT% EQU 0 (echo   [PASSOU] Compilacao TypeScript ^(codigo commitado no HEAD^)) else (echo   [FALHOU] Compilacao TypeScript ^(codigo commitado no HEAD^))
echo ===================================================
echo.

if %TOTAL_ERRORS% EQU 0 (
    echo RESULTADO: TODOS OS TESTES DO GATE PASSARAM, O CODIGO COMMITADO COMPILA
    echo E NAO HA VIOLACAO DA REGRA 00.
) else (
    if %GATE_RESULT% NEQ 0 (
        echo [!] ACHADO^(S^) DE AUDITORIA PENDENTE^(S^): Veja os testes vermelhos acima.
    )
    if %WORK_TSC_RESULT% NEQ 0 (
        echo [!] ERRO DE COMPILACAO NO CODIGO ATUAL: Corrija os erros de TypeScript acima antes de commitar.
    )
    if %COMMITTED_TSC_RESULT% NEQ 0 (
        echo [!] ERRO NO CODIGO COMMITADO: O HEAD isolado nao compila sozinho ^(depende de arquivo nao commitado^).
    )
    if %ESLINT_RESULT% NEQ 0 (
        echo [!] VIOLACAO DA REGRA 00 NO ESLINT: Verifique componentes e domain/services.
    )
)

if "%NO_PAUSE%"=="1" (
    exit /b %TOTAL_ERRORS%
)

echo.
echo ===================================================
echo Esta janela NAO vai fechar sozinha.
echo Copie o resultado acima e feche manualmente quando terminar.
echo ===================================================
echo.
cmd /k
