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
      const storage = localStorage.getItem('@stacks/connect');
      if (!storage) return false;
      const data = JSON.parse(storage);
      
      // Check if we have any Stacks addresses (mainnet or testnet)
      const stxAddresses = data?.addresses?.filter((a: any) => 
        a.purpose === 'stacks' || a.addressType === 'stacks'
      ) || [];
      
      return stxAddresses.length > 0;
    } catch (error) {
      console.error('Error checking connection:', error);
      return false;
    }
  },
  loadUserData: () => {
    if (typeof window === 'undefined') return null;
    try {
      const storage = localStorage.getItem('@stacks/connect');
      if (!storage) return null;
      const data = JSON.parse(storage);
      
      // Find Stacks address (can be mainnet SP or testnet ST)
      const stxAddresses = data?.addresses?.filter((a: any) => 
        a.purpose === 'stacks' || a.addressType === 'stacks'
      ) || [];
      
      if (stxAddresses.length === 0) return null;
      
      // Get the address
      const address = stxAddresses[0]?.address;
      
      // Determine if it's mainnet or testnet based on prefix
      const network = address?.startsWith('SP') ? 'mainnet' : 'testnet';
      
      return {
        profile: {
          stxAddress: {
            mainnet: network === 'mainnet' ? address : '',
            testnet: network === 'testnet' ? address : '',
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
    // Use request API which is more reliable
    const { request } = await import('@stacks/connect');
    
    console.log('Requesting wallet addresses...');
    
    // Request addresses using getAddresses method
    const result = await request('getAddresses');
    
    console.log('Address result:', result);
    
    // Store addresses in the expected format
    if (result?.addresses) {
      const storage = {
        addresses: result.addresses,
        version: '1.0.0',
      };
      
      localStorage.setItem('@stacks/connect', JSON.stringify(storage));
      console.log('Stored addresses:', storage);
      
      // Reload to update UI
      window.location.reload();
    } else {
      console.error('No addresses returned');
      alert('Failed to get addresses from wallet');
    }
  } catch (error) {
    console.error('Error connecting wallet:', error);
    alert('Failed to connect wallet. Please make sure your wallet extension is installed and unlocked.');
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
