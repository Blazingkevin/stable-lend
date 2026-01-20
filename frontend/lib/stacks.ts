'use client';

import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { 
  uintCV, 
  principalCV,
  PostConditionMode,
} from '@stacks/transactions';
import { NETWORK, CONTRACTS } from './constants';

// App configuration
const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

// Get network config string
export const getNetworkMode = () => {
  return NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
};

// Connect wallet
export const connectWallet = () => {
  showConnect({
    appDetails: {
      name: 'StableLend',
      icon: '/logo.png',
    },
    redirectTo: '/',
    onFinish: () => {
      window.location.reload();
    },
    userSession,
  });
};

// Disconnect wallet
export const disconnectWallet = () => {
  userSession.signUserOut();
  window.location.reload();
};

// Get current user address
export const getUserAddress = (): string | null => {
  if (userSession.isUserSignedIn()) {
    const userData = userSession.loadUserData();
    return userData.profile.stxAddress.testnet;
  }
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
