---
trigger: always_on
description: Integridade e proveniencia de todo numero exibido ao usuario. Vale para todo o projeto, em qualquer tarefa, inclusive ajuste de layout.
---

# REGRA 00 — INTEGRIDADE DO DADO EXIBIDO

Este sistema exibe numeros que embasam decisao de alocacao de capital real
em derivativos. A criticidade padrao de qualquer coisa que exiba numero e CRITICA.

## PRINCIPIO

Tela vazia com motivo e entrega. Tela cheia de numero inventado e defeito.

Quando a fonte de dado nao esta ligada, a tentacao e preencher a lacuna com um
valor plausivel para que a entrega pareca completa. Isso e proibido aqui.
Quanto mais caprichado o valor fabricado (nome correto, ordem de grandeza certa,
coerencia setorial), pior o defeito: ele passa em inspecao visual e sobrevive
ate alguem decidir dinheiro com base nele.

## INVARIANTES — violacao bloqueia a entrega

1. NAO INVENTE NUMERO. Sem fonte ligada ou com fonte em falha, a tela mostra
   estado vazio com o motivo. Nunca preset, nunca "valor razoavel", nunca
   constante por ticker, nunca media historica como substituto.

2. `Math.random()` e proibido em `src/lib/domain/**` e `src/lib/services/**`.
   Serie historica, indicador tecnico, cadeia de opcoes ou preco gerados por
   ruido nao sao analise. Alem de falsos, sao irreproduziveis: a recomendacao
   de ontem nao pode ser reconstituida, e isso torna o sistema inauditavel.

3. `catch {}` vazio e proibido. Falha de fonte retorna `null` + motivo,
   nunca um valor default.

4. Todo numero exibido carrega marca de proveniencia VISIVEL na interface:
   - MEDIDO   : veio de fonte externa nesta sessao, com timestamp
   - DERIVADO : calculado so a partir de MEDIDO, formula auditavel
   - ESTIMADO : modelo/proxy declarado, com premissa explicita
   - SIMULADO : sintetico, demo, seed de teste — exige aviso na tela

   Regra de contagio: calculo que consome SIMULADO produz SIMULADO.
   NUNCA promova a marca por conveniencia. Um unico insumo simulado
   contamina toda a cadeia.

   Se o tipo ja tem campo `source` e a UI nao o exibe, isso e defeito:
   coletar proveniencia e nao mostrar e custo sem beneficio.

5. Formula que decide dinheiro (payoff, breakeven, perda maxima, POP, premio,
   juros) DERIVA DOS PARAMETROS REAIS DA ESTRUTURA. Percentual fixo do spot e
   proibido. Exemplo: breakeven de trava de credito e `strike_curto -/+ credito`,
   nunca `spot * 1.05`.

6. Constante magica e proibida em motor de calculo. Probabilidade fixa, premio
   como % do spot, POP hardcoded — se o numero nao e calculado, ele nao e
   resultado.

7. Constante hardcoded por entidade especifica (`if (symbol === 'X') roe = 16.5`)
   e proibida. Se a normalizacao e legitima, ela e um calculo com insumo de
   fonte, nao um literal. Literal por entidade congela no tempo e dispara em
   condicao que ninguem revisita.

8. FONTE UNICA POR CAMPO. Dois lugares no codigo com o preco do mesmo ativo
   e falha de integridade referencial, nao duplicacao inofensiva.

## O QUE NUNCA AFIRMAR

- Nao rotule dado como "ao vivo", "tempo real", "oficial" ou "identico a
  plataforma" se QUALQUER campo da tela for estatico. Dado real misturado com
  estatico e rotulado como real e pior que dado 100% falso: passa em inspecao.
- Nao declare cobertura de teste sem relatorio de coverage medido.
- Nao descreva no README ou na UI capacidade que o codigo nao tem.

## ORDEM DE CONSTRUCAO — nao inverter

    adaptador de fonte -> motor de calculo -> rota/API -> interface

Interface NUNCA e construida antes de existir payload real salvo em
`docs/fontes/<endpoint>.sample.json`.

Motivo: tela pronta esperando dado SEMPRE ganha um preset provisorio,
e provisorio em software e permanente. Essa inversao e a causa-raiz
mecanica da maioria dos defeitos de integridade.

## PROVA DE FONTE — obrigatoria antes de qualquer tela

Antes de escrever componente que exibe dado novo:
1. Executar chamada real a fonte
2. Salvar o payload em `docs/fontes/<endpoint>.sample.json`
3. Usar esse arquivo como teste de contrato do adaptador

Se a chamada falhar (credencial, permissao de plano, endpoint inexistente):
PARE e reporte. Resolver isso E a tarefa. Nao avance para a tela.

## MAPA DE PROVENIENCIA — entregavel obrigatorio

Toda feature que exibe numero entrega, junto do codigo, esta tabela:

| Campo exibido | Fonte real | Endpoint/arquivo | Marca | Se a fonte falhar |

A coluna "Se a fonte falhar" NUNCA contem um numero.
So estado vazio ou erro. Linha com numero ali = rejeicao do plano.
