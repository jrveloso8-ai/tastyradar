# 🚀 RADAR TASTYTRADE PRO IA + GEX ENGINE

> **Terminal Quantitativo Institucional para o Mercado Americano (S&P 500, Nasdaq 100 & Opções Tastytrade)**  
> Desenvolvido com Next.js 14, TypeScript, Tailwind CSS, Integração Tastytrade Open API e Motor Algorítmico de Gamma Exposure (GEX).

## 🛡️ Governança e Proveniência de Dados (REGRA 00)

O sistema segue rigorosamente o princípio da **transparência e integridade do dado exibido**: nenhum número sintético é mascarado como dado de mercado em tempo real.

| Componente | Fonte do Dado | Marcação na UI | Descrição / Limitação Atual |
|---|---|---|---|
| **IV Rank, IV 30d, IV Percentil** | Tastytrade Open API (`/market-metrics`) | 🟢 **MEDIDO (AO VIVO)** | Dados reais consumidos via sessão OAuth2 oficial. |
| **Apreçamento de Opções e POP** | Motor BSM puro (`bsm-pricer.ts`) | 🟣 **DERIVADO** | Prêmios de pernas e POP dinâmico calculados analiticamente via Black-Scholes a partir do spot e da IV30 medida. |
| **Breakeven e Perda Máxima** | Parâmetros contratuais dos strikes | 🟣 **DERIVADO** | Cálculo exato: `strike - crédito` (puts) e `strike + crédito` (calls); sem aproximações lineares. |
| **GEX e Barreiras de Strike** | Modelo Paramétrico Calibrado | 🟡 **ESTIMADO (MODELO)** | A API REST `/nested` entrega a grade de strikes e símbolos OCC, mas não entrega Open Interest. O GEX é estimado analiticamente até a conexão do streamer WebSocket DXLink. |
| **Série de Candlesticks** | Gerador Determinístico | 🟡 **DIDÁTICA MODELADA** | Série sintética determinística para visualização gráfica e cálculo de indicadores canônicos (SMA, RSI de Wilder, MACD de Gerald Appel). |

---

## 📑 Principais Módulos

1. **📊 Panorama Geral de Volatilidade & S&P 500:**
   * Monitoramento contínuo de **IV Rank (252d)**, **IV % (30d)**, **IV Percentil**, **VRP Yang-Zhang** e **Zero Gamma Flip**.
   * Filtros dinâmicos: **Top 50 Mais Líquidas com Preço < US$ 150** (gestão de risco e margem para contas moderadas), Top 50, Top 100, Top 250 e Todos.
   * Campo de busca universal permitindo pesquisar qualquer ticker listado.

2. **🕯️ Consulta Técnica com Candlesticks & Indicadores Canônicos:**
   * Gráfico em SVG com Médias Móveis Simples (SMA 20, 50, 200).
   * **RSI(14) canônico de J. Welles Wilder Jr.** com suavização exponencial (Modified MA, $\alpha = 1/14$).
   * **MACD completo de Gerald Appel** (EMA12, EMA26, Linha de Sinal EMA9 e Histograma).
   * Sinalização visual explícita de série didática modelada.

3. **💎 Recomendações Estruturadas de Volatilidade (Playbook Tastytrade):**
   * Estruturas mecânicas: Iron Condor (#20), Bull Put Spread (#01), Bear Call Spread (#02) e Calendars (#04).
   * **Motor Black-Scholes-Merton Puro:** Apreçamento analítico por perna, deltas reais e POP dinâmico.
   * **Regra do Crédito Mínimo:** Exige crédito $\ge 1/3$ da largura da asa.
   * **Simbologia OCC Oficial:** 8 dígitos decimais (`.SYMBOLYYMMDDC00000000`).

4. **⚡ Barreiras de Strike & Motor GEX:**
   * Visualização de Call GEX (+) e Put GEX (-) por strike, Spot e Zero Gamma Flip.
   * Rotulagem honesta como modelo paramétrico calibrado.

5. **🤖 Consultor Quantitativo IA:**
   * Análise assistida de fundamentos sob crivo contábil (normalização de baixas não-caixa e reconciliação financeira).
   * Rotas de API protegidas com rate limiter delimitado (LRU/TTL) e validação de origem.

---

## 🛠️ Stack Tecnológico

* **Framework:** [Next.js 14](https://nextjs.org/) (App Router, React 18, TypeScript)
* **Estilização:** Tailwind CSS & Lucide React Icons
* **Testes:** Vitest (43 testes unitários e golden tests cobrindo motores matemáticos, BSM, Wilder RSI, MACD, GEX, OCC e regras de negócio)
* **Integração com Mercado:** Tastytrade Open API (OAuth2 / market-metrics / option-chains)
* **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`) com execução de lint (ESLint), typecheck (tsc), testes unitários (Vitest) e build de produção Next.js

---

## 🚀 Como Executar

### 1. Clonar o Repositório:
```bash
git clone https://github.com/jrveloso8-ai/tastyradar.git
cd tastyradar
```

### 2. Instalar Dependências:
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente:
Copie o arquivo de exemplo e insira suas credenciais da Tastytrade:
```bash
cp .env.local.example .env.local
```

Edite o arquivo `.env.local`:
```env
CLIENT_ID=seu_client_id_tastytrade
CLIENT_SECRET=seu_client_secret_tastytrade
REFRESH_TOKEN=seu_refresh_token_tastytrade
ENVIRONMENT=production
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Executar Testes Automatizados:
```bash
npx vitest run
```

### 5. Iniciar o Sistema em Desenvolvimento:
```bash
npm run dev
```
Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.