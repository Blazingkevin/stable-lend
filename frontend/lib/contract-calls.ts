'use client';

import { fetchCallReadOnlyFunction, cvToJSON, standardPrincipalCV, uintCV } from '@stacks/transactions';
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network';
import { NETWORK } from './constants';
import { getLendingPoolContract, getUSDCxContract } from './stacks';

// Get network instance
const getNetwork = () => {
  return NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
};

// Read-only function: Get lender balance
export const getLenderBalance = async (address: string): Promise<bigint> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-lender-balance',
      functionArgs: [standardPrincipalCV(address)],
      network,
      senderAddress: address,
    });

    const jsonResult = cvToJSON(result);
    // Result is a response with optional uint
    if (jsonResult.success && jsonResult.value) {
      return BigInt(jsonResult.value.value || 0);
    }
    return BigInt(0);
  } catch (error) {
    console.error('Error fetching lender balance:', error);
    return BigInt(0);
  }
};

// Read-only function: Get borrower loans
export const getBorrowerLoans = async (address: string): Promise<number[]> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-borrower-loans',
      functionArgs: [standardPrincipalCV(address)],
      network,
      senderAddress: address,
    });

    const jsonResult = cvToJSON(result);
    // Result is a list of loan IDs
    if (jsonResult.success && Array.isArray(jsonResult.value)) {
      return jsonResult.value.map((id: any) => Number(id.value || id));
    }
    return [];
  } catch (error) {
    console.error('Error fetching borrower loans:', error);
    return [];
  }
};

// Read-only function: Get loan details
export interface LoanDetails {
  borrower: string;
  collateralAmount: bigint;
  borrowedAmount: bigint;
  accruedInterest: bigint;
  borrowBlock: number;
  isActive: boolean;
}

export const getLoanDetails = async (loanId: number, callerAddress: string): Promise<LoanDetails | null> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-loan-details',
      functionArgs: [uintCV(loanId)],
      network,
      senderAddress: callerAddress,
    });

    const jsonResult = cvToJSON(result);
    // Result is a response with optional tuple
    if (jsonResult.success && jsonResult.value) {
      const loan = jsonResult.value.value;
      return {
        borrower: loan.borrower.value,
        collateralAmount: BigInt(loan['collateral-amount'].value),
        borrowedAmount: BigInt(loan['borrowed-amount'].value),
        accruedInterest: BigInt(loan['accrued-interest'].value),
        borrowBlock: Number(loan['borrow-block'].value),
        isActive: loan['is-active'].value,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching loan details:', error);
    return null;
  }
};

// Read-only function: Get protocol stats
export interface ProtocolStats {
  totalDeposited: bigint;
  totalBorrowed: bigint;
  totalLoans: number;
  utilizationRate: number; // percentage
  totalLenders?: number;
  totalBorrowers?: number;
  activeUsers?: number;
  volume24h?: bigint;
}

export const getProtocolStats = async (callerAddress: string): Promise<ProtocolStats> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-protocol-stats',
      functionArgs: [],
      network,
      senderAddress: callerAddress,
    });

    const jsonResult = cvToJSON(result);
    if (jsonResult.success && jsonResult.value) {
      const stats = jsonResult.value;
      const totalDeposited = BigInt(stats['total-deposits'].value);
      const totalBorrowed = BigInt(stats['total-borrowed'].value);
      const totalLoans = Number(stats['next-loan-id']?.value || stats['total-loans']?.value || 0);
      
      // Calculate utilization rate
      const utilizationRate = totalDeposited > BigInt(0)
        ? Number((totalBorrowed * BigInt(10000)) / totalDeposited) / 100
        : 0;

      return {
        totalDeposited,
        totalBorrowed,
        totalLoans,
        utilizationRate,
        totalLenders: Number(stats['total-lenders']?.value || 0),
        totalBorrowers: Number(stats['total-borrowers']?.value || 0),
        activeUsers: Number(stats['active-users']?.value || 0),
        volume24h: BigInt(stats['volume-24h']?.value || 0),
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
    };
  }
};

// Read-only function: Get current APY
export const getCurrentAPY = async (callerAddress: string): Promise<number> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-current-apy',
      functionArgs: [],
      network,
      senderAddress: callerAddress,
    });

    const jsonResult = cvToJSON(result);
    if (jsonResult.success && jsonResult.value) {
      // APY is in basis points (800 = 8%)
      return Number(jsonResult.value.value) / 100;
    }
    return 8.0; // Default
  } catch (error) {
    console.error('Error fetching current APY:', error);
    return 8.0;
  }
};

// Read-only function: Get max borrow amount
export const getMaxBorrowAmount = async (collateralStx: bigint, callerAddress: string): Promise<bigint> => {
  try {
    const contract = getLendingPoolContract();
    const network = getNetwork();

    const result = await fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: 'get-max-borrow-amount',
      functionArgs: [uintCV(collateralStx)],
      network,
      senderAddress: callerAddress,
    });

    const jsonResult = cvToJSON(result);
    if (jsonResult.success && jsonResult.value) {
      return BigInt(jsonResult.value.value || 0);
    }
    return BigInt(0);
  } catch (error) {
    console.error('Error fetching max borrow amount:', error);
    return BigInt(0);
  }
};

// Helper: Calculate health factor for a loan
export const calculateHealthFactor = (loan: LoanDetails, stxPriceUsdcx: bigint = BigInt(2_000000)): number => {
  const totalOwed = loan.borrowedAmount + loan.accruedInterest;
  if (totalOwed === BigInt(0)) return Infinity;

  // Health factor = (collateral * price * liquidation_threshold) / borrowed
  // liquidation_threshold = 120% = 1.2
  const collateralValue = loan.collateralAmount * stxPriceUsdcx;
  const adjustedCollateral = (collateralValue * BigInt(120)) / BigInt(100);
  const healthFactor = Number(adjustedCollateral) / Number(totalOwed);

  return healthFactor;
};

// ===== WRITE FUNCTIONS (Contract Calls) =====

export interface TransactionCallbacks {
  onFinish?: (data: any) => void;
  onCancel?: () => void;
}

// Write function: Deposit USDCx
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
      onFinish: (data) => {
        console.log('Deposit transaction submitted:', data);
        callbacks?.onFinish?.(data);
      },
      onCancel: () => {
        console.log('Deposit cancelled');
        callbacks?.onCancel?.();
      },
    });
  } catch (error) {
    console.error('Error depositing USDCx:', error);
    throw error;
  }
};

// Write function: Withdraw USDCx
export const withdrawUSDCx = async (
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
      functionName: 'withdraw',
      functionArgs: [uintCV(amount)],
      network,
      postConditionMode: PostConditionMode.Allow, // Allow because we're receiving
      onFinish: (data) => {
        console.log('Withdraw transaction submitted:', data);
        callbacks?.onFinish?.(data);
      },
      onCancel: () => {
        console.log('Withdraw cancelled');
        callbacks?.onCancel?.();
      },
    });
  } catch (error) {
    console.error('Error withdrawing USDCx:', error);
    throw error;
  }
};

// Write function: Borrow USDCx
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
      onFinish: (data) => {
        console.log('Borrow transaction submitted:', data);
        callbacks?.onFinish?.(data);
      },
      onCancel: () => {
        console.log('Borrow cancelled');
        callbacks?.onCancel?.();
      },
    });
  } catch (error) {
    console.error('Error borrowing USDCx:', error);
    throw error;
  }
};

// Write function: Repay loan
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
      postConditionMode: PostConditionMode.Allow, // Allow because amounts vary with interest
      onFinish: (data) => {
        console.log('Repay transaction submitted:', data);
        callbacks?.onFinish?.(data);
      },
      onCancel: () => {
        console.log('Repay cancelled');
        callbacks?.onCancel?.();
      },
    });
  } catch (error) {
    console.error('Error repaying loan:', error);
    throw error;
  }
};
