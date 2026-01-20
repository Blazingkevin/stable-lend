# USDCx Bridge Integration Guide

## Overview
The StableLend bridge allows users to move USDC from Ethereum Sepolia testnet to Stacks testnet as USDCx using Circle's xReserve protocol.

## How It Works

### Deposit Flow (Ethereum → Stacks)
1. User connects MetaMask wallet (Ethereum Sepolia)
2. User connects Xverse wallet (Stacks testnet)
3. User enters USDC amount to bridge (minimum 1.00 USDC)
4. Smart contract on Ethereum:
   - Approves xReserve to spend USDC
   - Calls `depositToRemote` on xReserve contract
5. Circle attestation service:
   - Detects the deposit event
   - Verifies the transaction
   - Sends attestation to Stacks
6. Stacks network:
   - Receives attestation
   - Mints equivalent USDCx 1:1 to user's wallet
7. Process takes ~2-5 minutes total

## Prerequisites

### For Users
1. **MetaMask** installed and configured for Sepolia testnet
2. **Xverse** wallet installed (or Leather/Hiro)
3. **Testnet ETH** on Sepolia (for gas fees)
4. **Testnet USDC** on Sepolia (to bridge)

### Getting Testnet Tokens

#### Sepolia ETH
- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia

#### Sepolia USDC
- https://faucet.circle.com/ (Circle's official faucet)
- Contract: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

## Technical Details

### Contracts

**Ethereum Sepolia:**
- USDC Token: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- xReserve: `0x008888878f94C0d87defdf0B07f46B93C1934442`

**Stacks Testnet:**
- USDCx Token: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx`
- USDCx Protocol: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx-v1`

### Transaction Flow

```
User's ETH Address
    ↓ (approve USDC)
USDC Contract (Sepolia)
    ↓ (lock tokens)
xReserve Contract
    ↓ (emit event)
Circle Attestation Service
    ↓ (verify & attest)
Stacks Attestation Service
    ↓ (mint USDCx)
User's STX Address
```

### Code Structure

**Frontend Files:**
- `lib/bridge.ts` - Core bridge logic (viem + Ethereum interaction)
- `lib/bridge-helpers.ts` - Address encoding utilities
- `app/views/Bridge.tsx` - UI component

**Key Functions:**
```typescript
// Connect MetaMask
const clients = await connectEthereumWallet();

// Check balances
const usdc = await getUSDCBalance(publicClient, address);
const eth = await getETHBalance(publicClient, address);

// Execute bridge
const result = await depositToStacks(
  walletClient,
  publicClient,
  amount,
  stacksRecipient
);
```

## User Experience

### Success Flow
1. User sees "Bridge USDC to Stacks" button
2. Clicks button → MetaMask popup for approval (if needed)
3. Approves → MetaMask popup for deposit transaction
4. Confirms → Loading overlay with progress (25% → 50% → 75%)
5. Success modal → USDCx credited in ~2-5 minutes

### Error Handling
- ❌ MetaMask not installed → Clear error message
- ❌ Insufficient USDC balance → Warning shown
- ❌ Insufficient ETH for gas → Warning shown
- ❌ Amount below minimum (1.00) → Validation error
- ❌ Transaction rejected → User-friendly error
- ❌ Network issues → Retry suggestion

## Testing Checklist

### Manual Testing
- [ ] Connect MetaMask on Sepolia
- [ ] Check USDC balance displays correctly
- [ ] Check ETH balance displays correctly
- [ ] Enter amount below minimum → See error
- [ ] Enter amount above balance → See error
- [ ] Valid amount → Approval transaction works
- [ ] Deposit transaction completes
- [ ] View transaction on Etherscan
- [ ] Wait 2-5 minutes → Check USDCx balance on Stacks

### Edge Cases
- [ ] User rejects approval → Handle gracefully
- [ ] User rejects deposit → Show error
- [ ] Network switch during transaction → Warning
- [ ] Wallet locked → Clear message
- [ ] No Stacks wallet connected → Prompt to connect

## Limitations

### Testnet Only
- This bridge is configured for **testnet only**
- Sepolia ETH and USDC have no real value
- For mainnet, update contract addresses in `BRIDGE_CONFIG`

### Minimum Amounts
- Deposit: 1.00 USDC minimum
- Withdrawal: 4.80 USDCx minimum (includes $4.80 fee)

### Timing
- Bridge time: ~2-5 minutes typically
- Can take longer during network congestion
- Transactions are asynchronous (can navigate away)

## Withdrawal (Not Yet Implemented)

Withdrawal flow (Stacks → Ethereum) requires:
1. Call `burn` function on `usdcx-v1` contract
2. Wait for Stacks attestation service
3. Circle verifies and releases USDC on Ethereum
4. Takes ~25-60 minutes

Implementation guide in `bridging.txt` documentation.

## Troubleshooting

### "MetaMask not installed"
- Install MetaMask browser extension
- Refresh page after installation

### "Insufficient USDC balance"
- Get testnet USDC from Circle faucet
- Verify you're on Sepolia network

### "Insufficient ETH for gas"
- Get Sepolia ETH from faucets
- Need ~0.01 ETH for gas fees

### "Transaction failed"
- Check Etherscan for error details
- Ensure contracts are not paused
- Verify network connectivity

### "USDCx not showing up"
- Wait full 5 minutes
- Check Stacks Explorer for mint transaction
- Verify correct Stacks address connected

## Production Deployment

For mainnet deployment:

1. Update `BRIDGE_CONFIG` in `lib/bridge.ts`:
```typescript
export const BRIDGE_CONFIG = {
  ETH_RPC_URL: 'https://mainnet.infura.io/v3/YOUR_KEY',
  X_RESERVE_CONTRACT: '0x...', // Mainnet xReserve
  ETH_USDC_CONTRACT: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Mainnet USDC
  STACKS_DOMAIN: 10003,
  ETHEREUM_DOMAIN: 0,
};
```

2. Update Stacks contract addresses in `constants.ts`

3. Test thoroughly on testnet first!

## Resources

- Circle xReserve Docs: https://www.circle.com/en/cross-chain-transfer-protocol
- Stacks Bridge Docs: https://docs.stacks.co/docs/stacks-academy/usdcx
- Viem Documentation: https://viem.sh
- Original Bridge Guide: See `bridging.txt`

## Support

If users encounter issues:
1. Check browser console for errors
2. View transactions on Etherscan
3. Join Stacks Discord #help channel
4. Report bugs with transaction hashes

---

**Note**: This is a testnet implementation for hackathon purposes. Use at your own risk. Not audited for production.
