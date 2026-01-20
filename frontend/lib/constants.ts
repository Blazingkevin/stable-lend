// Contract addresses and configuration

// Network configuration
export const NETWORK: 'testnet' | 'mainnet' = 'testnet'; // Change to 'mainnet' for production

// Contract addresses (update after deployment)
// NOTE: These are placeholder addresses. Update with actual deployed addresses.
// For local testing, use the deployer address from your Clarinet console
export const CONTRACTS = {
  testnet: {
    lendingPool: 'ST1WGWDX3W41ET9N3H5TWM3A4B9BTFPDV2SYP6JYX.lending-pool', // Deployed to testnet!
    usdcx: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx', // Real USDCx testnet contract (Circle-backed)
  },
  mainnet: {
    lendingPool: 'SP...lending-pool', // TODO: Deploy to mainnet and update
    usdcx: 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-abtc', // Real USDCx contract on mainnet
  },
};

// Protocol parameters
export const PROTOCOL = {
  APY: 8, // 8% annual interest
  COLLATERAL_RATIO: 150, // 150% collateralization
  LIQUIDATION_THRESHOLD: 120, // 120% liquidation threshold
  LIQUIDATION_BONUS: 5, // 5% liquidation bonus
  STX_PRICE_USD: 2.25, // Mock price (from contract)
  DECIMALS: 6, // USDCx decimals
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
