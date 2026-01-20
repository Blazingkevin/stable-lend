'use client';

import { NETWORK, CONTRACTS } from './constants';

// Dynamic imports to avoid SSR issues
let AppConfig: any, UserSession: any, showConnect: any;

// Initialize on client side only
if (typeof window !== 'undefined') {
  import('@stacks/connect').then((module) => {
    AppConfig = module.AppConfig;
    UserSession = module.UserSession;
    showConnect = module.showConnect;
  });
}

// User session - will be initialized on client
let userSessionInstance: any = null;

const getUserSession = () => {
  if (typeof window === 'undefined') return null;
  
  if (!userSessionInstance && AppConfig && UserSession) {
    const appConfig = new AppConfig(['store_write', 'publish_data']);
    userSessionInstance = new UserSession({ appConfig });
  }
  return userSessionInstance;
};

export const userSession = {
  isUserSignedIn: () => {
    const session = getUserSession();
    return session ? session.isUserSignedIn() : false;
  },
  loadUserData: () => {
    const session = getUserSession();
    return session ? session.loadUserData() : null;
  },
  signUserOut: () => {
    const session = getUserSession();
    if (session) session.signUserOut();
  },
};

// Get network config string
export const getNetworkMode = () => {
  return NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
};

// Connect wallet
export const connectWallet = async () => {
  if (typeof window === 'undefined') return;
  
  // Ensure modules are loaded
  if (!showConnect) {
    const module = await import('@stacks/connect');
    showConnect = module.showConnect;
    AppConfig = module.AppConfig;
    UserSession = module.UserSession;
  }

  const session = getUserSession();
  if (!session) return;

  showConnect({
    appDetails: {
      name: 'StableLend',
      icon: window.location.origin + '/icon.png',
    },
    redirectTo: '/',
    onFinish: () => {
      window.location.reload();
    },
    userSession: session,
  });
};

// Disconnect wallet
export const disconnectWallet = () => {
  userSession.signUserOut();
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
};

// Get current user address
export const getUserAddress = (): string | null => {
  if (userSession.isUserSignedIn()) {
    const userData = userSession.loadUserData();
    return userData.profile.stxAddress[NETWORK] || null;
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
