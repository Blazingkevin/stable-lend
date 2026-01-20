// Contract addresses and configuration

// Network configuration
export const NETWORK: 'testnet' | 'mainnet' = 'testnet'; // Change to 'mainnet' for production

// Contract addresses (update after deployment)
export const CONTRACTS = {
  testnet: {
    lendingPool: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.lending-pool', // Update with deployed address
    usdcx: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx',
  },
  mainnet: {
    lendingPool: 'SP...', // Update with mainnet address
    usdcx: 'SP...', // Update with mainnet USDCx address
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
export const formatUSDCx = (amount: number): string => {
  return (amount / 1_000000).toFixed(2);
};

export const formatSTX = (amount: number): string => {
  return (amount / 1_000000).toFixed(2);
};

export const parseUSDCx = (amount: string): number => {
  return Math.floor(parseFloat(amount) * 1_000000);
};

export const parseSTX = (amount: string): number => {
  return Math.floor(parseFloat(amount) * 1_000000);
};
