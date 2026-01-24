'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

const learnMoreContent = `
# StableLend: The Complete DeFi Protocol for Bitcoin

## 🚀 What is StableLend?

**StableLend** is the first production-ready lending and borrowing protocol built natively for **USDCx on Stacks** — Bitcoin's premier Layer 2. We're building the foundational infrastructure that unlocks Bitcoin's $1.7 trillion in idle capital.

---

## 💡 Why StableLend?

### The Problem
Bitcoin has been sitting idle for over a decade. While Ethereum DeFi exploded to $100B+ TVL, Bitcoin holders had limited options:
- Centralized lending (custodial risk)
- Wrapped BTC on other chains (bridge risk)
- No native yield opportunities on Bitcoin

### Our Solution
StableLend bridges the gap between traditional stablecoin liquidity (USDC on Ethereum) and Bitcoin's secure ecosystem (Stacks L2), enabling:
- **Lenders** to earn yield on their USDCx
- **Borrowers** to access liquidity without selling their STX
- **Everyone** to participate in Bitcoin DeFi without compromise

---

## 🔗 USDCx Integration: Our Core Innovation

### What is USDCx?
USDCx is Circle's official USDC representation on Stacks, powered by the **xReserve bridge**. It's:
- ✅ 1:1 backed by USDC on Ethereum
- ✅ Fully redeemable through Circle's infrastructure
- ✅ The most trusted stablecoin now on Bitcoin L2

### How StableLend Uses USDCx
1. **Bridge**: Users bridge USDC from Ethereum to receive USDCx on Stacks
2. **Supply**: Deposit USDCx into StableLend to earn yield
3. **Borrow**: Use STX as collateral to borrow USDCx
4. **Earn**: Automatic interest accrual every Stacks block (~10 min)

We're the **first protocol to fully integrate the complete USDCx lifecycle** — from bridging to lending to borrowing.

---

## 🛡️ Security Architecture

Security is not an afterthought at StableLend — it's the foundation. Our protocol implements defense-in-depth with multiple layers of protection inspired by battle-tested DeFi protocols.

### Over-Collateralization Model
| Parameter | Value | Purpose |
|-----------|-------|---------|
| Minimum Collateral Ratio | **150%** | Ensures loans are always backed by sufficient collateral |
| Liquidation Threshold | **120%** | Triggers liquidation before bad debt occurs |
| Maximum LTV | **66.67%** | Conservative borrowing limit protects lenders |
| Liquidation Bonus | **5%** | Incentivizes liquidators to maintain protocol health |

### Multi-Oracle Price Feeds
Accurate pricing is critical for lending protocols. We implement a **fallback oracle system**:

1. **Primary**: Pyth Network Oracle — High-frequency, institutional-grade price data
2. **Fallback**: DIA Oracle — Decentralized backup if Pyth is unavailable
3. **Cached Price**: Last known valid price as final fallback

This ensures the protocol never operates with stale or manipulated price data.

### Flash Loan & MEV Protection
- **Same-Block Interaction Guard**: Users cannot deposit and withdraw in the same block, preventing flash loan exploits
- **Execution Lock**: Reentrancy protection ensures functions cannot be called recursively
- **CEI Pattern**: Checks-Effects-Interactions ordering throughout all functions

### Vault Security (ERC-4626 Inspired)
Our share-based accounting system includes protections against share inflation attacks:

- **Minimum First Deposit**: First depositor must provide at least 1 USDCx to establish the pool
- **Dead Shares**: 1,000 shares permanently locked to the zero address, preventing zero-share exploits
- **High Precision Accounting**: 8-decimal share precision prevents rounding manipulation

### Protocol Risk Controls
| Control | Description |
|---------|-------------|
| **Emergency Pause** | Owner can halt all operations during security incidents |
| **Supply Cap** | Maximum total deposits limited to $100,000 (testnet) |
| **Borrow Cap** | Maximum total borrows limited to $50,000 (testnet) |
| **Loan Duration Limit** | Maximum 365 days per loan prevents indefinite positions |
| **Zero Address Validation** | Prevents transfers to burn address |

### Liquidation Safeguards
- **Self-Liquidation Prevention**: Borrowers cannot liquidate their own loans
- **Health Factor Monitoring**: Real-time tracking of all loan positions
- **Expired Loan Liquidation**: Loans past 365 days can be liquidated regardless of health
- **Automatic Collateral Release**: On repayment, collateral returns atomically

### Clarity Smart Contract Advantages
Clarity, Stacks' native smart contract language, provides inherent security benefits:

| Feature | Benefit |
|---------|---------|
| **Decidable Language** | Every possible contract execution can be mathematically analyzed |
| **No Reentrancy by Design** | Language structure prevents reentrancy attacks |
| **Post-Conditions** | Assertions enforced after execution ensure expected outcomes |
| **No Hidden Behavior** | All contract code is visible and analyzable |
| **Bitcoin Settlement** | Final settlement on Bitcoin's proven security model |

### Comprehensive Error Handling
All operations return specific error codes for transparency:

| Code | Error | Protection |
|------|-------|------------|
| u401 | Not Authorized | Only owners can modify their positions |
| u402 | Insufficient Balance | Prevents overdrawing |
| u403 | Insufficient Collateral | Enforces collateralization requirements |
| u411 | Protocol Paused | Emergency stop functionality |
| u412 | Supply Cap Exceeded | Limits protocol exposure |
| u420 | Reentrancy Detected | Blocks recursive calls |
| u421 | Same-Block Interaction | Flash loan protection |

---

## 📊 Dynamic Interest Rate Model

Our interest rates automatically adjust based on market utilization:

\`\`\`
Supply APY = Base Rate × Utilization Rate × 90%
Borrow APY = Base Rate × Utilization Rate

Where:
- Base Rate = 8% (maximum)
- Utilization = Total Borrowed / Total Supplied
- Lender Share = 90% (protocol takes 10%)
\`\`\`

### Example Scenarios
| Utilization | Supply APY | Borrow APY |
|-------------|-----------|------------|
| 25% | 1.8% | 2.0% |
| 50% | 3.6% | 4.0% |
| 75% | 5.4% | 6.0% |
| 100% | 7.2% | 8.0% |

This creates natural market equilibrium — high demand increases rates, attracting more lenders; low demand decreases rates, encouraging borrowing.

---

## 🤖 AI-Powered Risk Monitoring

### What Makes Our Risk Assistant Special?
StableLend includes an integrated **AI Risk Assistant** that:

- **Monitors Your Positions**: Real-time health factor tracking
- **Provides Insights**: Plain-English explanations of complex DeFi concepts
- **Alerts on Risk**: Early warnings before liquidation danger
- **Market Analysis**: Protocol-wide utilization and APY trends

### How It Works
The AI assistant has access to:
- Your current positions (lent/borrowed amounts)
- Active loans and their health factors
- Historical protocol performance
- Real-time market data from the Stacks blockchain

---

## 🌉 Seamless Bridge Experience

### Ethereum → Stacks in 3 Steps
1. **Connect Wallets**: MetaMask (Ethereum) + Leather/Xverse (Stacks)
2. **Approve & Bridge**: Authorize USDC, initiate cross-chain transfer
3. **Receive USDCx**: Native stablecoin arrives on Stacks (~15-30 min)

### Powered by Circle's xReserve
We integrate directly with Circle's official bridge infrastructure:
- No third-party bridges
- No additional trust assumptions
- Circle-backed security guarantees

---

## 🏗️ Technical Architecture

### Smart Contract Stack
\`\`\`
┌─────────────────────────────────────────┐
│           StableLend Protocol           │
│  ┌─────────────────────────────────┐    │
│  │  Lending Pool Core              │    │
│  │  - deposit-usdcx()              │    │
│  │  - withdraw-usdcx()             │    │
│  │  - borrow-usdcx()               │    │
│  │  - repay-loan()                 │    │
│  │  - liquidate()                  │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  Share Accounting System        │    │
│  │  - Yield automatically accrues  │    │
│  │  - No manual claiming required  │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  Price Oracle Integration       │    │
│  │  - STX/USD price feed           │    │
│  │  - Collateral valuation         │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
\`\`\`

---

## 🚦 Getting Started

### For Lenders
1. Bridge USDC from Ethereum or acquire USDCx on Stacks
2. Connect your Stacks wallet (Leather or Xverse)
3. Navigate to "Lend" → Enter amount → Confirm transaction
4. Watch your yield grow automatically!

### For Borrowers
1. Ensure you have STX for collateral
2. Connect your Stacks wallet
3. Navigate to "Borrow" → Enter amount → Deposit collateral
4. Receive USDCx instantly!

### Monitor Your Risk
- Dashboard shows all positions at a glance
- Health factor indicator (green/yellow/red)
- AI assistant available 24/7 for questions

---

## 📈 Roadmap

### Phase 1: Foundation ✅
- Core lending and borrowing functionality
- USDCx integration with xReserve bridge
- AI Risk Assistant
- Professional dashboard UI

### Phase 2: Expansion
- Multi-collateral support (sBTC when available)
- Advanced liquidation mechanisms
- Mobile-optimized experience

### Phase 3: Decentralization
- Governance token launch
- Community-driven protocol parameters
- Insurance fund for enhanced security

### Phase 4: Ecosystem
- Cross-protocol integrations
- Institutional partnerships
- Multi-chain expansion

---

## 🤝 Built for the Bitcoin Renaissance

StableLend isn't just a protocol — it's a statement about where Bitcoin is headed. 

For too long, Bitcoin holders have been told to "just HODL." We say: **HODL *and* earn yield. HODL *and* access liquidity. HODL *and* participate in DeFi.**

The future of finance is being built on Bitcoin. StableLend is here to make sure you're part of it.

**Welcome to the Global Yield Layer for Bitcoin.**

---

*Empowering Bitcoin DeFi, one block at a time.*
`;

const customComponents = {
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-5xl md:text-6xl font-black text-white mb-8 tracking-tight" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-3xl md:text-4xl font-black text-white mt-16 mb-6 tracking-tight" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-2xl font-bold text-orange-400 mt-10 mb-4" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-lg text-slate-300 mb-6 leading-relaxed" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-none space-y-3 mb-6 ml-2" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal list-inside space-y-3 mb-6 ml-2 text-slate-300" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="text-lg text-slate-300 leading-relaxed flex items-start gap-2" {...props}>
      <span className="text-orange-400 mt-1.5">•</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-bold text-white" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <em className="text-orange-300 not-italic" {...props}>{children}</em>
  ),
  a: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} className="text-orange-400 hover:text-orange-300 underline underline-offset-4 transition-colors" {...props}>{children}</a>
  ),
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className="border-slate-700 my-12" {...props} />
  ),
  blockquote: ({ children, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="border-l-4 border-orange-500 pl-6 py-2 my-8 bg-orange-500/5 rounded-r-lg" {...props}>
      {children}
    </blockquote>
  ),
  code: ({ children, className, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="block bg-slate-900 rounded-2xl p-6 text-sm font-mono text-emerald-400 overflow-x-auto border border-slate-700 my-6" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-slate-800 px-2 py-1 rounded text-sm font-mono text-orange-300" {...props}>{children}</code>
    );
  },
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="my-6" {...props}>{children}</pre>
  ),
  table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto my-8">
      <table className="w-full border-collapse border border-slate-700 rounded-lg overflow-hidden" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-slate-800" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="px-6 py-4 text-left text-sm font-bold text-orange-400 uppercase tracking-wider border border-slate-700" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="px-6 py-4 text-slate-300 border border-slate-700" {...props}>{children}</td>
  ),
  tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="hover:bg-slate-800/50 transition-colors" {...props}>{children}</tr>
  ),
};

export default function LearnMorePage() {
  return (
    <div className="min-h-screen bg-[#020617] text-gray-100">
      {/* Testnet Banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/95 backdrop-blur-sm border-b border-yellow-600/30 py-1.5 lg:py-2 px-3 lg:px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-1.5 lg:gap-2 text-xs lg:text-sm">
          <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-yellow-900 animate-pulse" />
          <span className="font-bold text-yellow-900">TESTNET</span>
          <span className="text-yellow-900/80 hidden sm:inline">•</span>
          <span className="text-yellow-900/80 hidden sm:inline">Using Stacks Testnet - Test tokens only</span>
        </div>
      </div>

      {/* Header - Matching Landing Page */}
      <nav className="fixed top-8 lg:top-10 left-0 right-0 z-40 bg-[#030712]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 lg:gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-orange-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <ShieldCheck className="text-white w-5 h-5 lg:w-6 lg:h-6" />
            </div>
            <span className="text-lg lg:text-xl font-bold tracking-tight text-white">StableLend</span>
          </Link>
          
          <div className="flex items-center gap-2 lg:gap-4">
            <Link 
              href="/"
              className="hidden sm:block px-3 lg:px-4 py-2 text-slate-400 hover:text-white transition-colors font-medium text-sm"
            >
              ← Back
            </Link>
            <Link 
              href="/?app=true"
              className="px-4 lg:px-6 py-2 lg:py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-lg lg:rounded-xl font-bold text-xs lg:text-sm transition-all hover:scale-105"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 lg:px-6 pt-32 lg:pt-40 pb-16 lg:pb-24">
        <div className="prose prose-invert prose-sm lg:prose-lg max-w-none">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={customComponents as any}
          >
            {learnMoreContent}
          </ReactMarkdown>
        </div>

        {/* CTA Section */}
        <div className="mt-16 lg:mt-24 text-center">
          <div className="inline-block bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-2xl lg:rounded-3xl p-8 lg:p-12 border border-orange-500/20">
            <h2 className="text-2xl lg:text-4xl font-black text-white mb-3 lg:mb-4">Ready to Get Started?</h2>
            <p className="text-base lg:text-xl text-slate-400 mb-6 lg:mb-8 max-w-md mx-auto">
              Experience the future of Bitcoin DeFi. Lend, borrow, and earn with USDCx on Stacks.
            </p>
            <Link
              href="/?app=true"
              className="inline-flex items-center gap-2 px-8 lg:px-10 py-4 lg:py-5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl lg:rounded-2xl font-black text-lg lg:text-xl shadow-[0_20px_50px_rgba(249,115,22,0.3)] transition-all hover:scale-105"
            >
              Launch StableLend
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14m-7-7 7 7-7 7"/>
              </svg>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer - Matching Landing Page */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 lg:py-12 px-4 lg:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 lg:gap-8">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-orange-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <ShieldCheck className="text-white w-5 h-5 lg:w-6 lg:h-6" />
            </div>
            <span className="font-bold text-lg lg:text-xl tracking-tight text-white">StableLend</span>
          </div>
          
          <div className="flex gap-6 lg:gap-8 text-slate-400 text-sm">
            <Link href="/?app=true" className="hover:text-white transition-colors">Dashboard</Link>
            <Link href="/learn" className="hover:text-white transition-colors text-orange-400">Learn</Link>
          </div>

          <p className="text-slate-500 text-xs lg:text-sm text-center">
            © {new Date().getFullYear()} StableLend. Built for the Bitcoin Renaissance.
          </p>
        </div>
      </footer>
    </div>
  );
}
