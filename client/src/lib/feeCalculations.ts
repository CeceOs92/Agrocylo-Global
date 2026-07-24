const STROOPS_PER_XLM = 10_000_000n;
const XLM_CENTS = 100n;
const STROOPS_PER_CENT = STROOPS_PER_XLM / XLM_CENTS;
const PLATFORM_FEE_BPS = 300n;
const BPS_DENOM = 10_000n;
const PLATFORM_FEE_PCT = 3;

function xlmToStroops(xlm: number): bigint {
  if (!Number.isFinite(xlm) || xlm < 0) return 0n;
  const cents = Math.round(xlm * 100);
  return BigInt(cents) * STROOPS_PER_CENT;
}

function feeFromGrossStroops(grossStroops: bigint): bigint {
  return (grossStroops * PLATFORM_FEE_BPS) / BPS_DENOM;
}

function netFromGrossStroops(grossStroops: bigint): bigint {
  return grossStroops - feeFromGrossStroops(grossStroops);
}

function displayFee(grossXlm: number): number {
  return (grossXlm * PLATFORM_FEE_PCT) / 100;
}

function displayNet(grossXlm: number): number {
  return grossXlm - displayFee(grossXlm);
}

export {
  STROOPS_PER_XLM,
  PLATFORM_FEE_BPS,
  BPS_DENOM,
  PLATFORM_FEE_PCT,
  xlmToStroops,
  feeFromGrossStroops,
  netFromGrossStroops,
  displayFee,
  displayNet,
};
