'use client';

import { NETWORK, CONTRACTS } from './constants';

// Placeholder functions until we properly set up @stacks/connect
export const userSession = {
  isUserSignedIn: () => false,
  loadUserData: () => null,
  signUserOut: () => {},
};

// Get network config string
export const getNetworkMode = () => {
  return NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
};

// Connect wallet - placeholder
export const connectWallet = () => {
  alert('Wallet connection coming soon! Install Hiro Wallet or Leather.');
};

// Disconnect wallet - placeholder
export const disconnectWallet = () => {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
};

// Get current user address - placeholder
export const getUserAddress = (): string | null => {
  return null;
};

// Contract call helpers
export const getLendingPoolContract = () => {
  const contracts = CONTRACTS[NETWORK as keyof typeof CONTRACTS];
  const [address, name] = contracts.lendingPool.split('.');
  return { address, name };
};

export const getUSDCxContract = () => {
  const contracts = CONTRACTS[NETWORK as keyof typeof CONTRACTS];
  const [address, name] = contracts.usdcx.split('.');
  return { address, name };
};
