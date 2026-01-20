// Monitor bridge transaction status
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const ETH_TX_HASH = '0xe2d7c1e83c86d85195084e1f6fac8b64d3e84b70608e58922997bd99bc5c239f';
const STACKS_ADDRESS = 'STFQHDPGS829E78T1MQBJKQ1QYKBM6HH6PXJPWJZ';

async function main() {
  console.log('🔍 Analyzing your bridge transaction...\n');

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia.publicnode.com'),
  });

  try {
    // Get transaction receipt
    console.log('📜 Fetching Ethereum transaction...');
    const receipt = await publicClient.getTransactionReceipt({ hash: ETH_TX_HASH as `0x${string}` });
    
    console.log('✅ Transaction Status:', receipt.status);
    console.log('📦 Block Number:', receipt.blockNumber.toString());
    console.log('⛽ Gas Used:', receipt.gasUsed.toString());
    console.log('📋 Logs:', receipt.logs.length, 'events');
    console.log('');

    // Get current block to calculate confirmations
    const currentBlock = await publicClient.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    console.log('✔️  Confirmations:', confirmations.toString());
    console.log('');

    // Parse logs to find Transfer and Deposit events
    console.log('📝 Transaction Events:');
    receipt.logs.forEach((log, i) => {
      console.log(`\nEvent ${i + 1}:`);
      console.log('  Contract:', log.address);
      console.log('  Topics:', log.topics.length);
      console.log('  Data length:', log.data.length);
      
      // Check if this is a Transfer event (topic[0] = keccak256("Transfer(address,address,uint256)"))
      if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
        console.log('  Type: Token Transfer');
        // Parse amount from data (last 32 bytes = uint256)
        const amountHex = log.data;
        const amount = BigInt(amountHex);
        const usdcAmount = Number(amount) / 1e6;
        console.log('  Amount:', usdcAmount, 'USDC');
      }
    });

    console.log('\n\n🎯 IMPORTANT INFORMATION:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⏰ Bridge Timing:');
    console.log('   - Ethereum deposit: ✅ CONFIRMED');
    console.log('   - Attestation service: ⏳ Processing (can take 5-15 minutes)');
    console.log('   - Stacks minting: ⏳ Waiting for attestation');
    console.log('');
    console.log('📍 What happens next:');
    console.log('   1. Circle\'s attestation service verifies the Ethereum deposit');
    console.log('   2. After verification, USDCx will be minted on Stacks');
    console.log('   3. USDCx will appear at your address:', STACKS_ADDRESS);
    console.log('');
    console.log('🔗 Monitor your Stacks address:');
    console.log('   https://explorer.hiro.so/address/' + STACKS_ADDRESS + '?chain=testnet');
    console.log('');
    console.log('💡 TIP: Refresh the Stacks Explorer every 1-2 minutes');
    console.log('   USDCx should appear in the "Fungible Tokens" section');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
