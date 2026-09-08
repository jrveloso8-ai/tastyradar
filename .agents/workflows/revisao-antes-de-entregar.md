---
description: Auto-revisao obrigatoria antes de declarar qualquer entrega pronta.
---

# Workflow: Revisao antes de entregar

Percorra e responda item a item, sem pular:

- [ ] Mapa de Proveniencia preenchido para todo campo exibido
- [ ] Nenhum `Math.random()` fora de arquivo de teste
- [ ] Nenhum fallback que devolve NUMERO quando a fonte falha
- [ ] Nenhuma constante hardcoded por entidade especifica
- [ ] Marca de proveniencia VISIVEL na UI, nao so no tipo
- [ ] Toda formula de dinheiro deriva dos parametros reais da estrutura
- [ ] Toda formula de dinheiro com golden test calculado a mao
- [ ] Teste do teste aplicado: existe mudanca de producao que faria cada
      teste falhar? Se nao, o teste e decorativo — reescreva
- [ ] Rotas novas com auth + validacao + rate limit + timeout
- [ ] Nenhum texto de UI ou README afirmando capacidade que o codigo nao tem

Ao final, liste explicitamente:
- O que voce NAO conseguiu ligar em dado real, e por que
- Que suposicao voce teve de fazer
- Que campo ficou ESTIMADO ou SIMULADO
