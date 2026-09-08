---
description: Executa a Prova de Fonte e o Mapa de Proveniencia antes de construir qualquer tela que exiba dado.
---

# Workflow: Prova de Fonte

Rode ANTES de escrever qualquer componente que exiba dado novo.

## Passo 1 — Prova de Fonte
Execute uma chamada REAL a cada fonte que esta feature consome.
Salve o payload em `docs/fontes/<endpoint>.sample.json`.

Se a chamada falhar (credencial invalida, permissao de plano, endpoint
inexistente): PARE e reporte. Resolver isso E a tarefa.
Nao avance para a tela. Nao gere dado sintetico para "destravar".

## Passo 2 — Mapa de Proveniencia
Monte a tabela, uma linha por numero que aparecera na tela:

| Campo | Fonte real | Endpoint | Marca | Se a fonte falhar |

Marca ∈ MEDIDO / DERIVADO / ESTIMADO / SIMULADO.
Calculo que consome SIMULADO produz SIMULADO.
A coluna "Se a fonte falhar" NUNCA contem um numero.

## Passo 3 — Declare o que nao da para preencher
Liste todo campo que hoje voce nao tem como preencher com dado real.
Prefiro tela com menos campos e todos verdadeiros a tela completa com estimativa.

## Passo 4 — PARE
Aguarde aprovacao do Mapa antes de construir qualquer coisa.
