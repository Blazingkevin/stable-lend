// USDCx Bridge Implementation - Ethereum ↔ Stacks
// Using Circle xReserve protocol via viem and stacks.js

import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  custom,
  type WalletClient,
  type PublicClient,
  type Hash,
} from 'viem';
import { sepolia } from 'viem/chains';
import { bytes32FromBytes, remoteRecipientCoder } from './bridge-helpers';

// Type guard for Ethereum provider
interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (eventName: string, handler: (...args: any[]) => void) => void;
  removeListener?: (eventName: string, handler: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
}

/**
 * Get Ethereum provider (handles multiple wallet extensions)
 */
function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null;
  
  const windowEth = (window as any).ethereum;
  
  // Check if MetaMask is available in the providers array (when multiple wallets installed)
  if (windowEth?.providers) {
    const metamask = windowEth.providers.find((p: any) => p.isMetaMask);
    if (metamask) return metamask as EthereumProvider;
  }
  
  // Check if window.ethereum is MetaMask directly
  if (windowEth?.isMetaMask) {
    return windowEth as EthereumProvider;
  }
  
  // Fallback to window.ethereum if it exists
  return windowEth ? (windowEth as EthereumProvider) : null;
}

// Configuration for testnet
export const BRIDGE_CONFIG = {
  // Ethereum Sepolia testnet
  ETH_RPC_URL: 'https://ethereum-sepolia.publicnode.com',
  X_RESERVE_CONTRACT: '0x008888878f94C0d87defdf0B07f46B93C1934442',
  ETH_USDC_CONTRACT: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  
  // Stacks testnet
  STACKS_DOMAIN: 10003,
  ETHEREUM_DOMAIN: 0,
  
  // Minimum amounts (from official docs)
  MIN_DEPOSIT: '1.00', // 1.00 USDC minimum on testnet (10 USDC on mainnet)
  MIN_WITHDRAWAL: '4.80', // 4.80 USDCx minimum (includes fee)
};

// Contract ABIs
const X_RESERVE_ABI = [
  {
    name: 'depositToRemote',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'value', type: 'uint256' },
      { name: 'remoteDomain', type: 'uint32' },
      { name: 'remoteRecipient', type: 'bytes32' },
      { name: 'localToken', type: 'address' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'remaining', type: 'uint256' }],
  },
] as const;

export interface BridgeClients {
  walletClient: WalletClient;
  publicClient: PublicClient;
  address: `0x${string}`;
}

/**
 * Check and switch to Sepolia network if needed
 */
async function ensureSepoliaNetwork(ethereum: any): Promise<void> {
  try {
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    const sepoliaChainId = '0xaa36a7'; // 11155111 in hex
    
    if (chainId !== sepoliaChainId) {
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: sepoliaChainId }],
        });
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: sepoliaChainId,
                chainName: 'Sepolia Test Network',
                nativeCurrency: {
                  name: 'Sepolia ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://ethereum-sepolia.publicnode.com'],
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }
    }
  } catch (error) {
    console.error('Network switch error:', error);
    throw new Error('Please switch MetaMask to Sepolia testnet');
  }
}

/**
 * Connect to Ethereum wallet (MetaMask)
 */
export async function connectEthereumWallet(): Promise<BridgeClients> {
  const ethereum = getEthereumProvider();
  
  if (!ethereum) {
    throw new Error('MetaMask not installed. Please install MetaMask from https://metamask.io/download/');
  }

  // Check if MetaMask is installed (not just any ethereum provider)
  if (!ethereum.isMetaMask) {
    throw new Error('MetaMask not detected. Please install MetaMask extension.');
  }

  try {
    // Ensure we're on Sepolia network
    await ensureSepoliaNetwork(ethereum);

    // Request accounts from MetaMask
    const accounts = await ethereum.request({
      method: 'eth_requestAccounts',
    }) as string[];

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      throw new Error('No Ethereum accounts found. Please unlock MetaMask.');
    }

    const address = accounts[0] as `0x${string}`;

    // Create wallet client with MetaMask
    const walletClient = createWalletClient({
      account: address,
      chain: sepolia,
      transport: custom(ethereum as any),
    });

    // Create public client for reading data
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(BRIDGE_CONFIG.ETH_RPC_URL),
    });

    return { walletClient, publicClient, address };
  } catch (error: any) {
    console.error('MetaMask connection error:', error);
    
    // Handle specific error cases
    if (error.code === 4001) {
      throw new Error('Connection request was rejected by user');
    } else if (error.code === -32002) {
      throw new Error('Connection request is already pending. Please check MetaMask.');
    }
    
    throw new Error(error.message || 'Failed to connect to MetaMask');
  }
}

/**
 * Get USDC balance on Ethereum
 */
export async function getUSDCBalance(
  publicClient: PublicClient,
  address: `0x${string}`
): Promise<{ balance: bigint; formatted: string }> {
  const balance = await publicClient.readContract({
    address: BRIDGE_CONFIG.ETH_USDC_CONTRACT as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  });

  const formatted = (Number(balance) / 1e6).toFixed(2);

  return { balance, formatted };
}

/**
 * Get ETH balance for gas fees
 */
export async function getETHBalance(
  publicClient: PublicClient,
  address: `0x${string}`
): Promise<{ balance: bigint; formatted: string }> {
  const balance = await publicClient.getBalance({ address });
  const formatted = (Number(balance) / 1e18).toFixed(4);

  return { balance, formatted };
}

/**
 * Check if xReserve contract has sufficient USDC allowance
 */
export async function checkAllowance(
  publicClient: PublicClient,
  owner: `0x${string}`,
  amount: bigint
): Promise<{ needsApproval: boolean; currentAllowance: bigint }> {
  const currentAllowance = await publicClient.readContract({
    address: BRIDGE_CONFIG.ETH_USDC_CONTRACT as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [owner, BRIDGE_CONFIG.X_RESERVE_CONTRACT as `0x${string}`],
  });

  return {
    needsApproval: currentAllowance < amount,
    currentAllowance,
  };
}

/**
 * Approve xReserve to spend USDC
 */
export async function approveUSDC(
  walletClient: WalletClient,
  publicClient: PublicClient,
  amount: bigint
): Promise<Hash> {
  const hash = await walletClient.writeContract({
    address: BRIDGE_CONFIG.ETH_USDC_CONTRACT as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [BRIDGE_CONFIG.X_RESERVE_CONTRACT as `0x${string}`, amount],
    chain: sepolia,
  } as any);

  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}

/**
 * Deposit USDC to Stacks (mint USDCx)
 */
export async function depositToStacks(
  walletClient: WalletClient,
  publicClient: PublicClient,
  amount: string,
  stacksRecipient: string
): Promise<{ approvalHash?: Hash; depositHash: Hash }> {
  // Convert amount to micro USDC (6 decimals)
  const value = parseUnits(amount, 6);

  // Check if approval is needed
  const { needsApproval } = await checkAllowance(
    publicClient,
    walletClient.account!.address,
    value
  );

  let approvalHash: Hash | undefined;

  // Approve if needed
  if (needsApproval) {
    approvalHash = await approveUSDC(walletClient, publicClient, value);
  }

  // Encode Stacks address to bytes32
  const remoteRecipient = bytes32FromBytes(
    remoteRecipientCoder.encode(stacksRecipient)
  );

  // Execute deposit
  const depositHash = await walletClient.writeContract({
    address: BRIDGE_CONFIG.X_RESERVE_CONTRACT as `0x${string}`,
    abi: X_RESERVE_ABI,
    functionName: 'depositToRemote',
    args: [
      value,
      BRIDGE_CONFIG.STACKS_DOMAIN,
      remoteRecipient,
      BRIDGE_CONFIG.ETH_USDC_CONTRACT as `0x${string}`,
      BigInt(0), // maxFee
      '0x' as `0x${string}`, // hookData
    ],
    chain: sepolia,
  } as any);

  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({ hash: depositHash });

  return { approvalHash, depositHash };
}

/**
 * Get transaction details from hash
 */
export async function getTransactionStatus(
  publicClient: PublicClient,
  hash: Hash
): Promise<{
  status: 'pending' | 'success' | 'reverted';
  blockNumber?: bigint;
}> {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash });
    return {
      status: receipt.status === 'success' ? 'success' : 'reverted',
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    return { status: 'pending' };
  }
}

/**
 * Pad an Ethereum address to 32 bytes for the burn function
 */
export function padEthAddressTo32Bytes(ethAddress: string): string {
  // Remove 0x prefix if present
  const cleanAddress = ethAddress.startsWith('0x') ? ethAddress.slice(2) : ethAddress;
  // Pad to 32 bytes (64 hex chars) with leading zeros
  return '0x' + cleanAddress.padStart(64, '0');
}

/**
 * USDCx contract addresses on Stacks testnet
 */
export const STACKS_USDCX_CONFIG = {
  CONTRACT_ADDRESS: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  CONTRACT_NAME: 'usdcx-v1',
  TOKEN_NAME: 'usdcx-token',
};


