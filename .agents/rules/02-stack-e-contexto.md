---
trigger: always_on
description: Contexto do projeto RADAR — stack, fontes de dado, estrutura de pastas e historico de auditoria.
---

# REGRA 02 — CONTEXTO DO PROJETO

## O QUE E

RADAR TASTYTRADE PRO IA — terminal quantitativo de apoio a decisao em
derivativos do mercado americano (S&P 500, Nasdaq, opcoes Tastytrade).
Usuario: investidor tomando decisao de alocacao com capital real.

## STACK

- Next.js 14 (App Router) · React 18 · TypeScript strict
- Tailwind CSS · Lucide React
- Vitest
- Fontes: Tastytrade API (OAuth2 + DXLink streamer) · BRAPI (ativos BR)

## ESTRUTURA

    src/lib/domain/    motores puros, sem I/O — nunca importa fetch nem fs
    src/lib/services/  adaptadores de fonte externa
    src/lib/types/     contratos de dado
    src/app/api/       rotas
    src/components/    apresentacao apenas
    docs/fontes/       payloads reais salvos (Prova de Fonte)

Regra de negocio nao conhece framework, banco nem HTTP.
Dominio puro no centro, adaptadores nas bordas.

## HISTORICO DE AUDITORIA — LEIA ANTES DE MEXER

Em 08/09/2026 este sistema passou por auditoria independente que encontrou
23 achados, sendo 7 criticos. O laudo esta em `AUDITORIA_RADAR_TASTYTRADE.pdf`
na raiz do projeto. Praticamente todos os achados sao da MESMA classe:
dado sintetico apresentado ao usuario como dado real.

Defeitos conhecidos ainda nao corrigidos (nao replicar o padrao):
- `generateCandlesticks` gera serie e indicadores com Math.random()
- `getGexAnalysis` monta cadeia de opcoes sintetica (`mockOptions`)
- `getQuote` retorna precos hardcoded por ticker
- Premios de opcoes calculados como % fixo do spot
- Breakeven calculado como % do spot, ignorando os strikes montados
- POP fixo em 72%/48%
- Overrides hardcoded de VALE3 em tres arquivos
- Fallbacks silenciosos que devolvem numero quando a fonte falha
- Rotas de API sem autenticacao nem rate limit

Antes de propor qualquer solucao que envolva esses arquivos, verifique se a
correcao esta no escopo da tarefa. Nunca estenda um desses padroes para
codigo novo.

## DEPENDENCIA NAO USADA

A lib `ws` esta no package.json desde o primeiro commit e o streamer DXLink
nunca foi ligado. Se a tarefa envolve dado de opcoes em tempo real, ligar o
DXLink e o caminho correto — nao gerar cadeia sintetica.

## COMMITS

Mensagem descreve o que mudou e por que. Mensagem gerada por timestamp
("Update: Atualizacao <data>") destroi o valor de auditoria do historico
e nao e aceita.
