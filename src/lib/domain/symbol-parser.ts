export interface ParsedOptionSymbol {
  rawSymbol: string;
  underlying: string;
  expiration: string;
  expirationShort: string;
  type: 'CALL' | 'PUT';
  strike: number;
}

export function parseOptionSymbol(symbol: string): ParsedOptionSymbol | null {
  if (!symbol) return null;
  const clean = symbol.trim().toUpperCase();

  const dotOccRegex = /^\.?([A-Z]+)(\d{6})([CP])(\d+)$/;
  const match = clean.match(dotOccRegex);

  if (match) {
    const underlying = match[1];
    const expYYMMDD = match[2];
    const typeChar = match[3];
    const rawStrikeStr = match[4];

    let strike = parseFloat(rawStrikeStr);
    if (rawStrikeStr.length >= 8) {
      strike = strike / 1000;
    }

    const year = 2000 + parseInt(expYYMMDD.slice(0, 2), 10);
    const month = expYYMMDD.slice(2, 4);
    const day = expYYMMDD.slice(4, 6);
    const expiration = `${year}-${month}-${day}`;

    return {
      rawSymbol: clean,
      underlying,
      expiration,
      expirationShort: expYYMMDD,
      type: typeChar === 'C' ? 'CALL' : 'PUT',
      strike,
    };
  }

  return null;
}