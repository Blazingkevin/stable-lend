// Contract addresses and configuration

export const NETWORK: 'testnet' | 'mainnet' = 'testnet';

export const CONTRACTS = {
  testnet: {
    lendingPool: 'ST1WGWDX3W41ET9N3H5TWM3A4B9BTFPDV2SYP6JYX.stablelend-pool-v6',
    usdcx: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx',
  },
  mainnet: {
    lendingPool: 'SP...stablelend-pool',
    usdcx: 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-usdcx',
  },
};

// Protocol parameters
export const PROTOCOL = {
  APY: 8,
  COLLATERAL_RATIO: 150,
  LIQUIDATION_THRESHOLD: 120,
  LIQUIDATION_BONUS: 5,
  PROTOCOL_FEE: 10,
  STX_PRICE_USD: 0, // Dynamic - fetch from oracle via getSTXPriceUSD()
  DECIMALS: 6,
  BLOCKS_PER_YEAR: 52560,
  BLOCKS_PER_DAY: 144,
};

// Format helpers
export const formatUSDCx = (amount: bigint | number): string => {
  const num = typeof amount === 'bigint' ? Number(amount) : amount;
  return (num / 1_000000).toFixed(2);
};

export const formatSTX = (amount: bigint | number): string => {
  const num = typeof amount === 'bigint' ? Number(amount) : amount;
  return (num / 1_000000).toFixed(2);
};

export const parseUSDCx = (amount: string): bigint => {
  return BigInt(Math.floor(parseFloat(amount) * 1_000000));
};

export const parseSTX = (amount: string): bigint => {
  return BigInt(Math.floor(parseFloat(amount) * 1_000000));
};
