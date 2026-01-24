# StableLend

<div align="center">
  <img src="https://img.shields.io/badge/Built%20on-Stacks-5546FF?style=for-the-badge" alt="Built on Stacks" />
  <img src="https://img.shields.io/badge/Powered%20by-Bitcoin-F7931A?style=for-the-badge" alt="Powered by Bitcoin" />
  <img src="https://img.shields.io/badge/Language-Clarity-00C4B3?style=for-the-badge" alt="Clarity" />
  <img src="https://img.shields.io/badge/Bridge-USDCx-2775CA?style=for-the-badge" alt="USDCx Bridge" />
</div>

<br />

<div align="center">
  <h3>The Global Yield Layer for Bitcoin</h3>
  <p>Bridge USDC from Ethereum • Lend USDCx on Stacks • Borrow against STX Collateral</p>
</div>

---

## 🌟 Overview

**StableLend** is a decentralized lending protocol built on Stacks, Bitcoin's smart contract layer. It enables users to:

- **Bridge** USDC from Ethereum to Stacks via Circle's xReserve protocol
- **Lend** USDCx to earn dynamic yield (up to 8% APY)
- **Borrow** USDCx against STX collateral at 66.67% LTV
- **Monitor** risk with AI-powered analytics

All secured by Bitcoin's finality and Clarity's formal verification capabilities.

## ✨ Features

### 🔐 Battle-Tested Security Model
- **150% collateralization ratio** with automated liquidations at 120% health factor
- CEI (Checks-Effects-Interactions) pattern throughout
- Emergency pause mechanism
- Supply and borrow caps
- Flash loan protection with same-block interaction guards
- Reentrancy protection

### 📈 Dynamic Interest Rates
- Utilization-based APY scaling from 0% to 8%
- Real-time interest accrual every block
- Transparent 90/10 split: lenders earn 90%, protocol keeps 10%
- Share-based accounting with inflation attack protection

### 🌉 USDCx Bridge Integration
- First protocol to integrate **Circle's xReserve bridge**
- Seamless USDC → USDCx conversion from Ethereum
- Immediate supply or borrow after bridging
- Cross-chain liquidity hub for Bitcoin L2 ecosystem

### 💰 Instant Liquidity Access
- Borrow USDCx at **66.67% LTV** against STX collateral
- No selling positions, no waiting periods
- Access capital while maintaining Bitcoin exposure
- Up to 5 loans per user

### 🤖 AI Risk Assistant
- Real-time risk analysis powered by Google Gemini
- Personalized recommendations based on your positions
- Health factor monitoring and alerts
- Market condition awareness

## 🏗️ Architecture

```
stablelend/
├── contracts/                    # Clarity smart contracts
│   ├── stablelend-pool-v6.clar  # Main lending pool (deployed)
│   ├── mock-usdcx.clar          # USDCx token interface
│   └── sip-010-trait.clar       # SIP-010 fungible token trait
├── frontend/                     # Next.js 16 frontend
│   ├── app/                     # App router pages
│   ├── components/              # React components
│   └── lib/                     # Contract calls & utilities
├── deployments/                  # Deployment configurations
└── tests/                       # Clarity tests
```

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Clarinet](https://github.com/hirosystems/clarinet) for Clarity development
- [Xverse Wallet](https://www.xverse.app/) for Stacks transactions
- [MetaMask](https://metamask.io/) for Ethereum bridge transactions

### Installation

```bash
# Clone the repository
git clone https://github.com/Blazingkevin/stable-lend.git
cd stablelend

# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev
```

### Environment Setup

Create a `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

## 📜 Smart Contract

### Deployed Contract (Testnet)

```
ST1WGWDX3W41ET9N3H5TWM3A4B9BTFPDV2SYP6JYX.stablelend-pool-v6
```

### Key Functions

| Function | Description |
|----------|-------------|
| `supply` | Deposit USDCx to earn yield |
| `withdraw` | Withdraw supplied USDCx + interest |
| `borrow` | Borrow USDCx against STX collateral |
| `repay` | Repay borrowed USDCx + interest |
| `add-collateral` | Add more STX to existing loan |
| `liquidate` | Liquidate unhealthy positions |

### Protocol Parameters

| Parameter | Value |
|-----------|-------|
| Collateral Ratio | 150% |
| Liquidation Threshold | 120% |
| Liquidation Bonus | 5% |
| Protocol Fee | 10% of interest |
| Borrow APY | 8% |
| Max Loans per User | 5 |
| Min First Deposit | 1 USDCx |

## 🌐 Bridge Integration

StableLend integrates with Circle's xReserve protocol for cross-chain USDC transfers:

### Ethereum → Stacks (Deposit)

1. Connect MetaMask (Sepolia testnet)
2. Approve USDC spending
3. Call `depositToRemote` on xReserve contract
4. USDCx minted on Stacks (~15-30 minutes)

### Stacks → Ethereum (Withdrawal)

1. Connect Xverse wallet
2. Call `burn` on USDCx contract
3. USDC released on Ethereum

### Bridge Contracts

| Network | Contract |
|---------|----------|
| Ethereum (Sepolia) | `0x008888878f94C0d87defdf0B07f46B93C1934442` |
| USDC (Sepolia) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| USDCx (Stacks) | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` |

## 🔒 Security

### Audit Status

- ✅ Internal security review completed
- ✅ CEI pattern implemented throughout
- ✅ Reentrancy guards active
- ✅ Flash loan protection enabled
- ✅ Inflation attack protection for share accounting

### Security Features

1. **Same-Block Protection**: Prevents flash loan attacks by blocking same-block interactions
2. **Price Oracle Redundancy**: Dual oracle system (Pyth + DIA) with fallback
3. **Emergency Pause**: Admin can pause protocol in case of emergency
4. **Supply/Borrow Caps**: Limits exposure and prevents manipulation

## 🛠️ Development

### Run Tests

```bash
# Run Clarity tests
clarinet test

# Run frontend tests
cd frontend && npm test
```

### Build for Production

```bash
cd frontend
npm run build
```

### Deploy Contract

```bash
clarinet deployments apply -p deployments/v6.testnet-plan.yaml
```

## 📊 Protocol Stats

The protocol exposes real-time statistics:

- Total Value Locked (TVL)
- Total Borrowed
- Utilization Rate
- Current APY (Supply & Borrow)
- Active Lenders/Borrowers
- Protocol Revenue

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **App**: [Coming Soon - Vercel Deployment]
- **Documentation**: [Learn More](/frontend/app/learn)
- **Stacks Explorer**: [View Contract](https://explorer.hiro.so/txid/ST1WGWDX3W41ET9N3H5TWM3A4B9BTFPDV2SYP6JYX.stablelend-pool-v6?chain=testnet)

---

<div align="center">
  <p><strong>Built for the Bitcoin Renaissance</strong></p>
  <p>© 2026 StableLend</p>
</div>
