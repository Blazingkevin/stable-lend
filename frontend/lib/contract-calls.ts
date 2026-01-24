'use client';

import { fetchCallReadOnlyFunction, cvToJSON, standardPrincipalCV, uintCV } from '@stacks/transactions';
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network';
import { NETWORK } from './constants';
import { getLendingPoolContract, getUSDCxContract } from './stacks';

// Network configuration
const getNetwork = () => {
  return NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
};

// Retry wrapper for network calls with exponential backoff
const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isNetworkError = error.message?.includes('fetch') || 
                            error.message?.includes('network') ||
                            error.message?.includes('Failed to fetch');
      
      if (!isNetworkError || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// Error codes mapping
export const ERROR_CODES: Record<number, string> = {
  401: 'Not authorized to perform this action',
  402: 'Insufficient balance',
  403: 'Insufficient collateral for this loan',
  404: 'Loan not found',
  405: 'Token transfer failed',
  406: 'Loan is healthy and cannot be liquidated',
  407: 'Invalid amount - minimum deposit is 1 USDCx for first deposit',
  408: 'Loan is not liquidatable',
  409: 'Maximum number of loans reached (5 per user)',
  410: 'Invalid address',
  411: 'Protocol is paused',
  412: 'Supply cap exceeded',
  413: 'Borrow cap exceeded',
  414: 'Cannot liquidate your own loan',
  415: 'Cannot withdraw zero shares',
  416: 'Oracle failure',
  417: 'Price data is stale',
  418: 'Pyth oracle failure',
  419: 'DIA oracle failure',
  420: 'Reentrancy detected',
  421: 'Same block interaction not allowed - please wait for next block',
  422: 'Loan is not active',
};

// Get human-readable error message
export const getErrorMessage = (errorCode: number | string): string => {
  const code = typeof errorCode === 'string' ? parseInt(errorCode) : errorCode;
  return ERROR_CODES[code] || `Transaction failed with error code: ${code}`;
};

// API URL helper
const getApiUrl = () => {
  return NETWORK === 'mainnet' 
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';
};

// Get Stacks explorer URL for a transaction
export const getExplorerUrl = (txId: string): string => {
  const baseUrl = NETWORK === 'mainnet'
    ? 'https://explorer.hiro.so/txid'
    : 'https://explorer.hiro.so/txid';
  const networkParam = NETWORK === 'mainnet' ? '' : '?chain=testnet';
  return `${baseUrl}/${txId}${networkParam}`;
};

export interface TransactionResult {
  success: boolean;
  status: 'pending' | 'success' | 'failed' | 'not_found';
  errorCode?: number;
  errorMessage?: string;
  txId?: string;
}

// Check transaction status on-chain
export const checkTransactionStatus = async (txId: string): Promise<TransactionResult> => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/extended/v1/tx/${txId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, status: 'not_found', txId };
      }
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check transaction status
    if (data.tx_status === 'pending') {
      return { success: false, status: 'pending', txId };
    }
    
    if (data.tx_status === 'success') {
      return { success: true, status: 'success', txId };
    }
    
    // Transaction failed - extract error code
    if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') {
      let errorCode: number | undefined;
      let errorMessage = 'Transaction failed';
      
      // Try to extract error code from tx_result
      if (data.tx_result?.repr) {
        const match = data.tx_result.repr.match(/\(err u(\d+)\)/);
        if (match) {
          errorCode = parseInt(match[1]);
          errorMessage = getErrorMessage(errorCode);
        }
      }
      
      return { 
        success: false, 
        status: 'failed', 
        errorCode, 
        errorMessage,
        txId 
      };
    }
    
    return { success: false, status: 'failed', errorMessage: data.tx_status, txId };
  } catch (error) {
    console.error('Error checking transaction status:', error);
    return { success: false, status: 'not_found', txId };
  }
};

// Poll for transaction confirmation with timeout
export const waitForTransaction = async (
  txId: string, 
  maxAttempts: number = 30,
  intervalMs: number = 3000
): Promise<TransactionResult> => {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkTransactionStatus(txId);
    
    if (result.status !== 'pending' && result.status !== 'not_found') {
      return result;
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  return { 
    success: false, 
    status: 'pending', 
    errorMessage: 'Transaction still pending after timeout',
    txId 
  };
};

// Get USDCx wallet balance
export const getUSDCxWalletBalance = async (address: string): Promise<bigint> => {
  if (!address || address.trim() === '') {
    return BigInt(0);
  }

  try {
    const usdcxContract = getUSDCxContract();
    const network = getNetwork();

    const result = await fetchCallReadOnlyFunction({
      contractAddress: usdcxContract.address,
      contractName: usdcxContract.name,
      functionName: 'get-balance',
      functionArgs: [standardPrincipalCV(address)],
      network,
      senderAddress: address,
    });

    const jsonResult = cvToJSON(result);
    
    if (jsonResult.success && jsonResult.value && jsonResult.value.value) {
      const balanceValue = jsonResult.value.value;
      return BigInt(balanceValue);
    }
    return BigInt(0);
  } catch (error) {
    console.error('Error fetching USDCx wallet balance:', error);
    return BigInt(0);
  }
};

// Get STX wallet balance from Stacks API
export const getSTXWalletBalance = async (address: string): Promise<bigint> => {
  if (!address || address.trim() === '') {
    return BigInt(0);
  }

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/extended/v1/address/${address}/balances`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.stx && data.stx.balance) {
      return BigInt(data.stx.balance);
    }
    return BigInt(0);
  } catch (error) {
    console.error('Error fetching STX wallet balance:', error);
    return BigInt(0);
  }
};

// Get STX price in USD from contract oracle (6 decimals: 1000000 = $1.00)
export const getSTXPriceUSD = async (callerAddress: string): Promise<bigint> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await withRetry(() => fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-stx-price-usd',
      functionArgs: [],
      network,
      senderAddress: callerAddress,
    }));

    const jsonResult = cvToJSON(result);
    
    if (jsonResult.value) {
      return BigInt(jsonResult.value);
    }
    return BigInt(0);
  } catch (error) {
    console.error('Error fetching STX price:', error);
    return BigInt(0);
  }
};

// Get lender balance from protocol
export const getLenderBalance = async (address: string): Promise<bigint> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await withRetry(() => fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-lender-balance',
      functionArgs: [standardPrincipalCV(address)],
      network,
      senderAddress: address,
    }));

    const jsonResult = cvToJSON(result);
    
    if (jsonResult.success && jsonResult.value) {
      const balanceData = jsonResult.value;
      
      const getUintValue = (obj: any): bigint => {
        if (!obj) return BigInt(0);
        if (typeof obj === 'string' || typeof obj === 'number') return BigInt(obj);
        if (obj.value !== undefined) return BigInt(obj.value);
        return BigInt(0);
      };
      
      const tupleValue = balanceData.value || balanceData;
      const balance = getUintValue(tupleValue.balance);
      return balance;
    }
    return BigInt(0);
  } catch (error) {
    console.error('Error fetching lender balance:', error);
    return BigInt(0);
  }
};

// Get detailed lender data including shares - contract now returns real-time balance
export interface LenderData {
  shares: bigint;
  balance: bigint; // Real-time balance with accrued interest from contract
  shareValue: bigint;
  firstDepositBlock: number;
}

export const getLenderData = async (address: string): Promise<LenderData | null> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await withRetry(() => fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-lender-balance',
      functionArgs: [standardPrincipalCV(address)],
      network,
      senderAddress: address,
    }));

    const jsonResult = cvToJSON(result);
    
    if (jsonResult.success && jsonResult.value) {
      const data = jsonResult.value.value || jsonResult.value;
      
      const getUintValue = (obj: any): bigint => {
        if (!obj) return BigInt(0);
        if (typeof obj === 'string' || typeof obj === 'number') return BigInt(obj);
        if (obj.value !== undefined) return BigInt(obj.value);
        return BigInt(0);
      };
      
      return {
        shares: getUintValue(data.shares),
        balance: getUintValue(data.balance),
        shareValue: getUintValue(data['share-value']),
        firstDepositBlock: Number(getUintValue(data['first-deposit-block'])),
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching lender data:', error);
    return null;
  }
};

// Get borrower loan IDs
export const getBorrowerLoans = async (address: string): Promise<number[]> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await withRetry(() => fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-borrower-loans',
      functionArgs: [standardPrincipalCV(address)],
      network,
      senderAddress: address,
    }));

    const jsonResult = cvToJSON(result);
    
    if (jsonResult.success && jsonResult.value) {
      const responseValue = jsonResult.value.value || jsonResult.value;
      
      if (responseValue && responseValue['loan-ids']) {
        const loanIdsObj = responseValue['loan-ids'];
        const loanIdsArray = loanIdsObj.value || loanIdsObj;
        
        if (Array.isArray(loanIdsArray)) {
          const parsed = loanIdsArray.map((id: any) => Number(id.value || id));
          return parsed;
        }
      }
    }
    return [];
  } catch (error) {
    console.error('Error fetching borrower loans:', error);
    return [];
  }
};

// Get loan details - contract now returns real-time calculated interest
export interface LoanDetails {
  loanId: number;
  borrower: string;
  collateralAmount: bigint;
  borrowedAmount: bigint;
  accruedInterest: bigint; // Real-time interest from contract
  borrowBlock: number;
  isActive: boolean;
}

export const getLoanDetails = async (loanId: number, callerAddress: string): Promise<LoanDetails | null> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await withRetry(() => fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-loan-details',
      functionArgs: [uintCV(loanId)],
      network,
      senderAddress: callerAddress,
    }));

    const jsonResult = cvToJSON(result);
    
    if (jsonResult.success && jsonResult.value) {
      const loanData = jsonResult.value.value || jsonResult.value;
      
      if (!loanData) {
        return null;
      }
      
      const getValue = (obj: any) => obj?.value ?? obj;
      
      const loanDetails = {
        loanId: loanId,
        borrower: getValue(loanData.borrower),
        collateralAmount: BigInt(getValue(loanData['collateral-stx'] || loanData['collateral-amount'])),
        borrowedAmount: BigInt(getValue(loanData['borrowed-amount'])),
        accruedInterest: BigInt(getValue(loanData['interest-owed'] || loanData['accumulated-interest'] || loanData['accrued-interest']) || '0'),
        borrowBlock: Number(getValue(loanData['borrow-block'])),
        isActive: getValue(loanData.active || loanData['is-active']),
      };
      
      return loanDetails;
    }
    return null;
  } catch (error) {
    console.error('Error fetching loan details:', error);
    return null;
  }
};

// Get protocol statistics
export interface ProtocolStats {
  totalDeposited: bigint;
  totalBorrowed: bigint;
  totalLoans: number;
  utilizationRate: number; // in basis points (10000 = 100%)
  totalLenders?: number;
  totalBorrowers?: number;
  activeUsers?: number;
  volume24h?: bigint;
  totalInterestPaid?: bigint;
  protocolRevenue?: bigint;
  supplyCap?: bigint;
  borrowCap?: bigint;
  paused?: boolean;
  // New fields from contract
  totalShares?: bigint;
  shareValue?: bigint;
  liquidityIndex?: bigint;
  variableBorrowIndex?: bigint;
  lastInterestUpdateBlock?: number;
}

export const getProtocolStats = async (callerAddress: string): Promise<ProtocolStats> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await withRetry(() => fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-protocol-stats',
      functionArgs: [],
      network,
      senderAddress: callerAddress,
    }));

    const jsonResult = cvToJSON(result);
    if (jsonResult.success && jsonResult.value) {
      const stats = jsonResult.value;
      const statsValue = stats.value || stats;
      
      const getUintValue = (obj: any): bigint => {
        if (!obj) return BigInt(0);
        if (typeof obj === 'string' || typeof obj === 'number') return BigInt(obj);
        if (obj.value !== undefined) return BigInt(obj.value);
        return BigInt(0);
      };
      
      const totalDeposited = getUintValue(statsValue['total-deposits']);
      const totalBorrowed = getUintValue(statsValue['total-borrowed']);
      const totalLoans = Number(getUintValue(statsValue['next-loan-id']));
      const utilizationRate = Number(getUintValue(statsValue['utilization-rate']));

      return {
        totalDeposited,
        totalBorrowed,
        totalLoans,
        utilizationRate,
        totalLenders: Number(getUintValue(statsValue['total-lenders'])),
        totalBorrowers: Number(getUintValue(statsValue['total-borrowers'])),
        activeUsers: Number(getUintValue(statsValue['active-users'])),
        volume24h: getUintValue(statsValue['volume-24h']),
        totalInterestPaid: getUintValue(statsValue['total-interest-paid']),
        protocolRevenue: getUintValue(statsValue['protocol-revenue']),
        supplyCap: getUintValue(statsValue['supply-cap']),
        borrowCap: getUintValue(statsValue['borrow-cap']),
        paused: statsValue['paused']?.value === true || false,
        // New fields from contract
        totalShares: getUintValue(statsValue['total-shares']),
        shareValue: getUintValue(statsValue['share-value']),
        liquidityIndex: getUintValue(statsValue['liquidity-index']),
        variableBorrowIndex: getUintValue(statsValue['variable-borrow-index']),
        lastInterestUpdateBlock: Number(getUintValue(statsValue['last-interest-update-block'])),
      };
    }
    return {
      totalDeposited: BigInt(0),
      totalBorrowed: BigInt(0),
      totalLoans: 0,
      utilizationRate: 0,
      totalLenders: 0,
      totalBorrowers: 0,
      activeUsers: 0,
      volume24h: BigInt(0),
      totalInterestPaid: BigInt(0),
      protocolRevenue: BigInt(0),
      supplyCap: BigInt(0),
      borrowCap: BigInt(0),
      paused: false,
      totalShares: BigInt(0),
      shareValue: BigInt(0),
      liquidityIndex: BigInt(0),
      variableBorrowIndex: BigInt(0),
      lastInterestUpdateBlock: 0,
    };
  } catch (error) {
    console.error('Error fetching protocol stats:', error);
    return {
      totalDeposited: BigInt(0),
      totalBorrowed: BigInt(0),
      totalLoans: 0,
      utilizationRate: 0,
      totalLenders: 0,
      totalBorrowers: 0,
      activeUsers: 0,
      volume24h: BigInt(0),
      totalInterestPaid: BigInt(0),
      protocolRevenue: BigInt(0),
      supplyCap: BigInt(0),
      borrowCap: BigInt(0),
      paused: false,
      totalShares: BigInt(0),
      shareValue: BigInt(0),
      liquidityIndex: BigInt(0),
      variableBorrowIndex: BigInt(0),
      lastInterestUpdateBlock: 0,
    };
  }
};

// Get current borrower APY (constant 8%)
export const getCurrentAPY = async (callerAddress: string): Promise<number> => {
  return 8.0;
};

// Calculate max borrow amount based on collateral
// stxPriceOracle: STX price from oracle (6 decimals), e.g., 310000 = $0.31
export const getMaxBorrowAmount = async (collateralStx: bigint, callerAddress: string, stxPriceOracle?: bigint): Promise<bigint> => {
  try {
    // Use provided oracle price, or fetch it if not provided
    let stxPrice = stxPriceOracle;
    if (!stxPrice || stxPrice === BigInt(0)) {
      stxPrice = await getSTXPriceUSD(callerAddress);
    }
    
    // If still no price, return 0 (don't use hardcoded fallback)
    if (!stxPrice || stxPrice === BigInt(0)) {
      console.warn('No STX price available from oracle');
      return BigInt(0);
    }
    
    const PRICE_DECIMALS = BigInt(1000000);
    const COLLATERAL_RATIO = BigInt(150);
    
    const collateralValueUsd = (collateralStx * stxPrice) / PRICE_DECIMALS;
    const maxBorrow = (collateralValueUsd * BigInt(100)) / COLLATERAL_RATIO;
    
    return maxBorrow;
  } catch (error) {
    console.error('Error calculating max borrow amount:', error);
    return BigInt(0);
  }
};

// Get protocol caps (supply/borrow limits)
export interface ProtocolCaps {
  supplyCap: bigint;
  borrowCap: bigint;
  currentSupply: bigint;
  currentBorrowed: bigint;
  supplyAvailable: bigint;
  borrowAvailable: bigint;
}

export const getProtocolCaps = async (callerAddress: string): Promise<ProtocolCaps> => {
  try {
    const stats = await getProtocolStats(callerAddress);
    
    const supplyCap = stats.supplyCap || BigInt(100000000000); // 100k default
    const borrowCap = stats.borrowCap || BigInt(50000000000);  // 50k default
    const currentSupply = stats.totalDeposited;
    const currentBorrowed = stats.totalBorrowed;
    
    return {
      supplyCap,
      borrowCap,
      currentSupply,
      currentBorrowed,
      supplyAvailable: supplyCap > currentSupply ? supplyCap - currentSupply : BigInt(0),
      borrowAvailable: borrowCap > currentBorrowed ? borrowCap - currentBorrowed : BigInt(0),
    };
  } catch (error) {
    console.error('Error fetching protocol caps:', error);
    return {
      supplyCap: BigInt(100000000000),
      borrowCap: BigInt(50000000000),
      currentSupply: BigInt(0),
      currentBorrowed: BigInt(0),
      supplyAvailable: BigInt(100000000000),
      borrowAvailable: BigInt(50000000000),
    };
  }
};

// Get liquidation parameters
export interface LiquidationStats {
  liquidationThreshold: number;
  liquidationBonus: number;
  totalLiquidations: number;
}

export const getLiquidationStats = async (callerAddress: string): Promise<LiquidationStats> => {
  return {
    liquidationThreshold: 120,
    liquidationBonus: 500,
    totalLiquidations: 0,
  };
};

// Get total value locked (TVL)
export const getTVL = async (callerAddress: string): Promise<bigint> => {
  try {
    const stats = await getProtocolStats(callerAddress);
    return stats.totalDeposited;
  } catch (error) {
    console.error('Error fetching TVL:', error);
    return BigInt(0);
  }
};

// Get accumulated protocol revenue
export const getProtocolRevenue = async (callerAddress: string): Promise<bigint> => {
  try {
    const stats = await getProtocolStats(callerAddress);
    return stats.protocolRevenue || BigInt(0);
  } catch (error) {
    console.error('Error fetching protocol revenue:', error);
    return BigInt(0);
  }
};

// Write functions

export interface TransactionCallbacks {
  onFinish?: (data: any) => void;
  onCancel?: () => void;
  onBroadcast?: (txId: string) => void; // Called when tx is broadcast (not yet confirmed)
  onConfirmed?: (result: TransactionResult) => void; // Called when tx is confirmed on-chain
  onFailed?: (result: TransactionResult) => void; // Called when tx fails on-chain
}

// Handle transaction with on-chain verification
const handleTransactionWithVerification = async (
  data: any,
  callbacks?: TransactionCallbacks
) => {
  const txId = data.txId;
  
  // Notify that transaction was broadcast
  callbacks?.onBroadcast?.(txId);
  
  // Poll for on-chain confirmation
  const result = await waitForTransaction(txId);
  
  if (result.success) {
    callbacks?.onConfirmed?.(result);
    callbacks?.onFinish?.(data);
  } else {
    callbacks?.onFailed?.(result);
  }
  
  return result;
};

// Deposit USDCx into the protocol
export const depositUSDCx = async (
  amount: bigint,
  userAddress: string,
  callbacks?: TransactionCallbacks
) => {
  try {
    const { openContractCall } = await import('@stacks/connect');
    const { uintCV, PostConditionMode } = await import('@stacks/transactions');
    
    const contract = getLendingPoolContract();
    const network = getNetwork();

    await openContractCall({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'deposit',
      functionArgs: [uintCV(amount)],
      network,
      postConditionMode: PostConditionMode.Allow,
      onFinish: async (data) => {
        // Verify transaction on-chain before calling success
        await handleTransactionWithVerification(data, callbacks);
      },
      onCancel: () => {
        callbacks?.onCancel?.();
      },
    });
  } catch (error) {
    console.error('Error depositing USDCx:', error);
    throw error;
  }
};

// Withdraw USDCx from the protocol (burns shares)
export const withdrawUSDCx = async (
  sharesToBurn: bigint,
  userAddress: string,
  callbacks?: TransactionCallbacks
) => {
  try {
    const { openContractCall } = await import('@stacks/connect');
    const { uintCV, PostConditionMode } = await import('@stacks/transactions');
    
    const contract = getLendingPoolContract();
    const network = getNetwork();

    await openContractCall({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'withdraw',
      functionArgs: [uintCV(sharesToBurn)],
      network,
      postConditionMode: PostConditionMode.Allow, // Allow because we're receiving
      onFinish: async (data) => {
        await handleTransactionWithVerification(data, callbacks);
      },
      onCancel: () => {
        callbacks?.onCancel?.();
      },
    });
  } catch (error) {
    console.error('Error withdrawing USDCx:', error);
    throw error;
  }
};

// Borrow USDCx with STX collateral
export const borrowUSDCx = async (
  borrowAmount: bigint,
  collateralStx: bigint,
  userAddress: string,
  callbacks?: TransactionCallbacks
) => {
  try {
    const { openContractCall } = await import('@stacks/connect');
    const { uintCV, PostConditionMode } = await import('@stacks/transactions');
    
    const contract = getLendingPoolContract();
    const network = getNetwork();

    await openContractCall({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'borrow',
      functionArgs: [uintCV(borrowAmount), uintCV(collateralStx)],
      network,
      postConditionMode: PostConditionMode.Allow,
      onFinish: async (data) => {
        await handleTransactionWithVerification(data, callbacks);
      },
      onCancel: () => {
        callbacks?.onCancel?.();
      },
    });
  } catch (error) {
    console.error('Error borrowing USDCx:', error);
    throw error;
  }
};

// Repay loan and unlock collateral
export const repayLoan = async (
  loanId: number,
  userAddress: string,
  callbacks?: TransactionCallbacks
) => {
  try {
    const { openContractCall } = await import('@stacks/connect');
    const { uintCV, PostConditionMode } = await import('@stacks/transactions');
    
    const contract = getLendingPoolContract();
    const network = getNetwork();

    await openContractCall({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'repay',
      functionArgs: [uintCV(loanId)],
      network,
      postConditionMode: PostConditionMode.Allow,
      onFinish: async (data) => {
        await handleTransactionWithVerification(data, callbacks);
      },
      onCancel: () => {
        callbacks?.onCancel?.();
      },
    });
  } catch (error) {
    console.error('Error repaying loan:', error);
    throw error;
  }
};
