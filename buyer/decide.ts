export interface Decision {
  accept: boolean;
  why: string;
}

export interface Supply {
  circulating_supply: number | null;
  complete: boolean;
}

// Our raw answer carries a verdict. A routed answer may be read into the intent's shape, which
// has only attested_reserve, in micro-units; that is checked against supply instead.
export function decide(result: any, supply?: Supply): Decision {
  if (result?.verdict) {
    return { accept: result.verdict === "fully_backed", why: result.summary ?? `verdict ${result.verdict}` };
  }
  const reserve = Number(result?.attested_reserve) / 1_000_000;
  if (!Number.isFinite(reserve) || reserve <= 0) return { accept: false, why: "no verdict or attested reserve in the answer" };
  if (!supply?.complete || !supply.circulating_supply) return { accept: false, why: "supply could not be fully read, so the reserve can't be compared" };
  const ratio = reserve / supply.circulating_supply;
  return { accept: ratio >= 1, why: `attested reserve / circulating supply = ${ratio.toFixed(4)}` };
}
