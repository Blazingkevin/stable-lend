// Quick check for USDCx balance
import { checkUSDCxBalance, checkUSDCxContractInfo } from './lib/check-usdcx';

const STACKS_ADDRESS = 'STFQHDPGS829E78T1MQBJKQ1QYKBM6HH6PXJPWJZ';

async function main() {
  console.log('🔍 Checking USDCx on Stacks testnet...\n');
  console.log('Address:', STACKS_ADDRESS);
  console.log('Contract: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx\n');

  try {
    console.log('1️⃣ Checking USDCx contract info...');
    const contractInfo = await checkUSDCxContractInfo();
    console.log('Contract exists:', contractInfo.exists);
    if (contractInfo.name) console.log('Token name:', contractInfo.name);
    if (contractInfo.symbol) console.log('Token symbol:', contractInfo.symbol);
    console.log('');

    console.log('2️⃣ Checking your USDCx balance...');
    const balance = await checkUSDCxBalance(STACKS_ADDRESS);
    console.log('Raw balance:', balance.balance);
    console.log('Formatted:', balance.formatted, 'USDCx');
    console.log('');

    if (Number(balance.balance) > 0) {
      console.log('✅ SUCCESS! You have USDCx tokens!');
      console.log(`💰 Balance: ${balance.formatted} USDCx`);
    } else {
      console.log('⏳ Balance is zero. Possible reasons:');
      console.log('   - Bridge is still processing (wait 2-5 minutes)');
      console.log('   - Wrong contract address');
      console.log('   - Bridge transaction failed');
      console.log('');
      console.log('🔗 Check Ethereum tx: https://sepolia.etherscan.io/tx/0xe2d7c1e83c86d85195084e1f6fac8b64d3e84b70608e58922997bd99bc5c239f');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
