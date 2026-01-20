'use client';

import { NETWORK, CONTRACTS } from './constants';

// Get network config string
export const getNetworkMode = () => {
  return NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
};

// Check if wallet is connected
export const userSession = {
  isUserSignedIn: () => {
    if (typeof window === 'undefined') return false;
    try {
      // Check @stacks/connect localStorage
      const storage = localStorage.getItem('@stacks/connect');
      if (!storage) return false;
      const data = JSON.parse(storage);
      return data?.addresses?.stx?.length > 0;
    } catch {
      return false;
    }
  },
  loadUserData: () => {
    if (typeof window === 'undefined') return null;
    try {
      const storage = localStorage.getItem('@stacks/connect');
      if (!storage) return null;
      const data = JSON.parse(storage);
      
      // Find testnet address (starts with ST)
      const stxAddresses = data?.addresses?.stx || [];
      const testnetAddr = stxAddresses.find((a: { address: string }) => 
        a.address.startsWith('ST')
      );
      const address = testnetAddr?.address || stxAddresses[0]?.address;
      
      return {
        profile: {
          stxAddress: {
            [NETWORK]: address || '',
          },
        },
      };
    } catch {
      return null;
    }
  },
  signUserOut: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('@stacks/connect');
    }
  },
};

// Connect wallet
export const connectWallet = async () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Use the modern connect API from @stacks/connect
    const { connect } = await import('@stacks/connect');
    
    console.log('Opening wallet connection...');
    
    // This opens the wallet selection modal and handles the connection
    const result = await connect();
    
    console.log('Connection result:', result);
    
    // Check if addresses were returned
    if (result?.addresses) {
      console.log('Addresses received:', result.addresses);
      
      // Manually store in localStorage with the correct format
      const storage = {
        addresses: result.addresses,
        version: '1.0.0',
      };
      
      localStorage.setItem('@stacks/connect', JSON.stringify(storage));
      
      // Reload to update UI
      window.location.reload();
    } else {
      console.error('No addresses in connection result');
    }
  } catch (error) {
    console.error('Error connecting wallet:', error);
    alert('Failed to connect wallet. Please try again.');
  }
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
    if (!userData) return null;
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
