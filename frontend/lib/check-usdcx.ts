// Helper to check USDCx balance on Stacks
import { STACKS_TESTNET } from '@stacks/network';
import { fetchCallReadOnlyFunction, cvToJSON, principalCV } from '@stacks/transactions';

const USDCX_CONTRACT = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx';
const network = STACKS_TESTNET;

export async function checkUSDCxBalance(stacksAddress: string): Promise<{
  balance: string;
  decimals: number;
  formatted: string;
}> {
  try {
    const [contractAddress, contractName] = USDCX_CONTRACT.split('.');
    
    // Call get-balance function on USDCx contract
    const result = await fetchCallReadOnlyFunction({
      network,
      contractAddress,
      contractName,
      functionName: 'get-balance',
      functionArgs: [principalCV(stacksAddress)],
      senderAddress: stacksAddress,
    });

    const balanceData = cvToJSON(result);
    const balance = balanceData.value?.value || '0';
    const decimals = 6; // USDCx has 6 decimals
    
    const formatted = (Number(balance) / 1_000000).toFixed(6);

    return { balance, decimals, formatted };
  } catch (error) {
    console.error('Error checking USDCx balance:', error);
    throw error;
  }
}

export async function checkUSDCxContractInfo(): Promise<{
  exists: boolean;
  name?: string;
  symbol?: string;
}> {
  try {
    const [contractAddress, contractName] = USDCX_CONTRACT.split('.');
    
    // Try to get token name
    const nameResult = await fetchCallReadOnlyFunction({
      network,
      contractAddress,
      contractName,
      functionName: 'get-name',
      functionArgs: [],
      senderAddress: contractAddress,
    });

    const symbolResult = await fetchCallReadOnlyFunction({
      network,
      contractAddress,
      contractName,
      functionName: 'get-symbol',
      functionArgs: [],
      senderAddress: contractAddress,
    });

    return {
      exists: true,
      name: cvToJSON(nameResult).value,
      symbol: cvToJSON(symbolResult).value,
    };
  } catch (error) {
    console.error('Error checking USDCx contract:', error);
    return { exists: false };
  }
}
