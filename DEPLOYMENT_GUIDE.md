# Deploy Lending Pool to Testnet - Step by Step

## Step 1: Get Your Xverse Wallet Seed Phrase

1. **Open Xverse Wallet** extension
2. Click the **menu** (3 dots or hamburger icon)
3. Go to **Settings**
4. Click **Show Secret Key** or **Backup Wallet**
5. You'll see a **12-word seed phrase** (e.g., "word1 word2 word3...")
6. **Copy this seed phrase** - you'll need it in the next step

## Step 2: Update Testnet Configuration

1. Open the file: `settings/Testnet.toml`
2. Find the line: `mnemonic = "<YOUR PRIVATE TESTNET MNEMONIC HERE>"`
3. Replace it with your seed phrase (keep the quotes):
   ```toml
   mnemonic = "your twelve word seed phrase goes here like this example"
   ```

## Step 3: Generate Deployment Plan

Run:
```bash
cd /Users/fmy-761/hackathon/stablelend
clarinet deployments generate --testnet
```

This will create a deployment plan in the `deployments/` folder.

## Step 4: Get Testnet STX for Gas

1. Visit: https://explorer.hiro.so/sandbox/faucet?chain=testnet
2. Enter your Stacks address: `STFQHDPGS829E78T1MQBJKQ1QYKBM6HH6PXJPWJZ`
3. Request 500 STX (enough for deployment + transactions)
4. Wait 1-2 minutes for confirmation

## Step 5: Deploy Contract

Run:
```bash
clarinet deployments apply --testnet
```

This will:
- Deploy lending-pool.clar to testnet
- Give you a contract address like: `STFQHDPGS829E78T1MQBJKQ1QYKBM6HH6PXJPWJZ.lending-pool`
- Show transaction hash and status

## Step 6: Update Frontend

Once deployed, update `frontend/lib/constants.ts`:
```typescript
lendingPool: 'YOUR_ADDRESS.lending-pool', // Replace with actual deployed address
```

## Important Notes

- ⚠️ **Never commit your seed phrase to Git!** The `.gitignore` already excludes `settings/Testnet.toml`
- 💰 You need ~0.5-2 STX for deployment gas fees
- ⏱️ Deployment takes 2-5 minutes
- 🔗 You'll get a transaction link to verify on Stacks Explorer

## If You Don't Want to Use Your Real Wallet

You can create a new testnet-only wallet:
1. Create a new Xverse wallet (separate from your main one)
2. Use that seed phrase for deployment
3. This keeps your main wallet secure

## Next Steps After Deployment

1. ✅ Update frontend with deployed contract address
2. ✅ Test contract calls in the UI
3. ✅ Request USDCx from Stacks Discord for testing
4. ✅ Record demo video
5. ✅ Submit to hackathon!
