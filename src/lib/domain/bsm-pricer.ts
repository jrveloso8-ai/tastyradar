/**
 * Motor Puro de Apreçamento Black-Scholes Merton (BSM)
 * REGRA 00: Motor puramente matemático, determinístico e auditável. Sem I/O.
 */

export interface BsmGreeks {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

/**
 * Função cumulativa da normal padrão Φ(x)
 * Aproximação de alta precisão (Abramowitz & Stegun 26.2.17, erro máximo < 7.5e-8)
 */
export function normalCdf(x: number): number {
  if (isNaN(x)) return 0.5;
  if (x < -8.0) return 0.0;
  if (x > 8.0) return 1.0;

  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const p = 0.2316419;

  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const pdf = (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const cdf = 1.0 - pdf * poly;

  return x >= 0 ? cdf : 1.0 - cdf;
}

/**
 * Densidade de probabilidade normal padrão φ(x)
 */
export function normalPdf(x: number): number {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

/**
 * Calcula o preço teórico e as gregas de uma opção via Black-Scholes
 * @param spot Preço atual do ativo subjacente (S)
 * @param strike Preço de exercício da opção (K)
 * @param timeToExpiry Tempo até o vencimento em anos (T = DTE / 365)
 * @param volatility Volatilidade implícita anualizada em decimal (ex: 0.25 para 25%)
 * @param riskFreeRate Taxa livre de risco anualizada em decimal (ex: 0.045 para 4.50%)
 * @param type Tipo da opção ('CALL' ou 'PUT')
 */
export function calculateBsm(
  spot: number,
  strike: number,
  timeToExpiry: number,
  volatility: number,
  riskFreeRate = 0.045,
  type: 'CALL' | 'PUT' = 'CALL'
): BsmGreeks {
  if (spot <= 0 || strike <= 0 || timeToExpiry <= 0 || volatility <= 0) {
    const intrinsic = type === 'CALL' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    const delta = type === 'CALL' ? (spot >= strike ? 1 : 0) : (spot <= strike ? -1 : 0);
    return {
      price: Number(intrinsic.toFixed(2)),
      delta: Number(delta.toFixed(2)),
      gamma: 0,
      theta: 0,
      vega: 0,
    };
  }

  const sqrtT = Math.sqrt(timeToExpiry);
  const d1 = (Math.log(spot / strike) + (riskFreeRate + 0.5 * volatility * volatility) * timeToExpiry) / (volatility * sqrtT);
  const d2 = d1 - volatility * sqrtT;

  const discount = Math.exp(-riskFreeRate * timeToExpiry);

  let price = 0;
  let delta = 0;

  if (type === 'CALL') {
    price = spot * normalCdf(d1) - strike * discount * normalCdf(d2);
    delta = normalCdf(d1);
  } else {
    price = strike * discount * normalCdf(-d2) - spot * normalCdf(-d1);
    delta = normalCdf(d1) - 1.0;
  }

  const gamma = normalPdf(d1) / (spot * volatility * sqrtT);
  const vega = (spot * sqrtT * normalPdf(d1)) / 100; // Sensibilidade a 1% de vol
  const thetaYearly = -(spot * normalPdf(d1) * volatility) / (2 * sqrtT) -
    (type === 'CALL'
      ? riskFreeRate * strike * discount * normalCdf(d2)
      : -riskFreeRate * strike * discount * normalCdf(-d2));
  const theta = thetaYearly / 365; // Theta diário

  return {
    price: Math.max(0.01, Number(price.toFixed(2))),
    delta: Number(delta.toFixed(2)),
    gamma: Number(gamma.toFixed(4)),
    theta: Number(theta.toFixed(3)),
    vega: Number(vega.toFixed(3)),
  };
}
