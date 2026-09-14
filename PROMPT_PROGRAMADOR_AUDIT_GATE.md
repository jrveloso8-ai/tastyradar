---
title: "Prompt Reutilizável para o Programador — RADAR-TASYTRADE"
subtitle: "Cole a saída do rodar_audit_gate.bat no lugar indicado, toda vez que rodar uma correção"
date: "09/09/2026"
---

Este prompt não muda de uma rodada para outra. O que muda é a saída do `.bat`, que você cola no lugar marcado antes de enviar.

---

Você vai corrigir achados de auditoria no projeto RADAR-TASYTRADE. Existe um arquivo de teste, `tests/audit-gate.test.ts`, que traduz cada achado confirmado em uma asserção automatizada. Abaixo colo a saída de `rodar_audit_gate.bat` (ou de `npx vitest run tests/audit-gate.test.ts`) rodada agora mesmo. Cada teste que aparece em vermelho é um achado que você precisa corrigir; os que aparecem em verde já estão corrigidos — não mexa neles.

**Regra de ouro, não negociável: você NUNCA edita `tests/audit-gate.test.ts`.** Se achar que um teste está errado, injusto ou mal escrito, pare e explique o motivo em vez de reescrevê-lo — mudar um teste é decisão do auditor, não sua. Um teste só pode passar por mudança no código de produção que ele audita.

Não adicione nenhuma funcionalidade, refactor ou "melhoria" fora do que os testes vermelhos abaixo pedem. Se achar que algo mais merece atenção, registre a sugestão em texto no final do seu relatório — não implemente sem aprovação.

Cada achado vermelho vira exatamente um commit. Não agrupe achados diferentes no mesmo commit, e não use na mensagem palavras como "todos", "completo", "integral" ou "100%" — descreva exatamente o que aquele commit específico mudou. Referencie o nome do teste que ele fecha (ex.: `fix(gex-engine): remove fallback magico de delta/IV - fecha C5-06`).

Ao terminar:

1. Rode `npx vitest run tests/audit-gate.test.ts` de novo e confirme que os testes que estavam vermelhos agora estão verdes (e que nenhum teste que estava verde ficou vermelho).
2. Devolva, sem resumir: (a) a saída completa do vitest rodando, e (b) a lista dos hashes de commit, um por achado corrigido, na ordem em que foram feitos.

Não declare a rodada "concluída" ou "corrigida" na sua resposta — só reporte o resultado do teste e os hashes. Quem decide se está fechado é quem vai auditar depois, com os testes e o diff de cada commit, não a sua palavra.

---

## COLE AQUI A SAÍDA DO `rodar_audit_gate.bat`

```
[cole aqui o texto completo que apareceu na janela do .bat]
```
