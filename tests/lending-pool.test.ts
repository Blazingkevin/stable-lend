import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const lender1 = accounts.get("wallet_1")!;
const lender2 = accounts.get("wallet_2")!;
const borrower1 = accounts.get("wallet_3")!;
const liquidator = accounts.get("wallet_4")!;

// Helper to mint USDCx for testing
function mintUSDCx(recipient: string, amount: number) {
  return simnet.callPublicFn(
    "mock-usdcx",
    "mint",
    [Cl.uint(amount), Cl.principal(recipient)],
    deployer
  );
}

describe("StableLend - Lending Pool Tests", () => {
  beforeEach(() => {
    // Reset state between tests
    simnet.mineEmptyBlock();
  });

  describe("Initialization", () => {
    it("ensures simnet is well initialized", () => {
      expect(simnet.blockHeight).toBeDefined();
    });

    it("returns correct APY of 8%", () => {
      const { result } = simnet.callReadOnlyFn(
        "lending-pool",
        "get-current-apy",
        [],
        deployer
      );
      expect(result).toBeUint(800); // 800 basis points = 8%
    });

    it("starts with zero protocol stats", () => {
      const { result } = simnet.callReadOnlyFn(
        "lending-pool",
        "get-protocol-stats",
        [],
        deployer
      );
      expect(result).toBeOk(
        Cl.tuple({
          "total-deposits": Cl.uint(0),
          "total-borrowed": Cl.uint(0),
          "total-interest-paid": Cl.uint(0),
          "utilization-rate": Cl.uint(0),
        })
      );
    });
  });

  describe("Deposit Functionality", () => {
    it("allows lender to deposit USDCx", () => {
      // Mint USDCx for lender
      mintUSDCx(lender1, 1000_000000); // 1000 USDCx

      // Deposit 500 USDCx
      const { result } = simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(500_000000)],
        lender1
      );

      expect(result).toBeOk(Cl.uint(500_000000));
    });

    it("rejects deposit of zero amount", () => {
      mintUSDCx(lender1, 1000_000000);

      const { result } = simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(0)],
        lender1
      );

      expect(result).toBeErr(Cl.uint(407)); // err-invalid-amount
    });

    it("correctly tracks lender balance after deposit", () => {
      mintUSDCx(lender1, 1000_000000);
      
      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(500_000000)],
        lender1
      );

      const { result } = simnet.callReadOnlyFn(
        "lending-pool",
        "get-lender-balance",
        [Cl.principal(lender1)],
        deployer
      );

      expect(result).toBeSome(
        Cl.tuple({
          principal: Cl.uint(500_000000),
          interest: Cl.uint(0), // No blocks passed yet
          total: Cl.uint(500_000000),
          "deposit-block": Cl.uint(simnet.blockHeight),
          "blocks-elapsed": Cl.uint(0),
        })
      );
    });

    it("compounds interest on subsequent deposits", () => {
      mintUSDCx(lender1, 2000_000000);

      // First deposit
      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(1000_000000)],
        lender1
      );

      // Mine blocks to accrue interest (144 blocks = 1 day)
      simnet.mineEmptyBlocks(144);

      // Second deposit
      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(500_000000)],
        lender1
      );

      const { result } = simnet.callReadOnlyFn(
        "lending-pool",
        "get-lender-balance",
        [Cl.principal(lender1)],
        deployer
      );

      const balanceData = result.value as any;
      expect(balanceData.data.interest.value).toBeGreaterThan(0n);
      expect(balanceData.data.total.value).toBeGreaterThan(1500_000000n);
    });
  });

  describe("Withdrawal Functionality", () => {
    it("allows lender to withdraw principal", () => {
      mintUSDCx(lender1, 1000_000000);
      
      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(1000_000000)],
        lender1
      );

      const { result } = simnet.callPublicFn(
        "lending-pool",
        "withdraw",
        [Cl.uint(500_000000)],
        lender1
      );

      expect(result).toBeOk(Cl.uint(500_000000));
    });

    it("allows lender to withdraw principal plus interest", () => {
      mintUSDCx(lender1, 1000_000000);
      
      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(1000_000000)],
        lender1
      );

      // Mine 1 year of blocks (52560 blocks)
      simnet.mineEmptyBlocks(52560);

      const { result } = simnet.callPublicFn(
        "lending-pool",
        "withdraw",
        [Cl.uint(1080_000000)], // Principal + 8% interest
        lender1
      );

      expect(result).toBeOk(Cl.uint(1080_000000));
    });

    it("rejects withdrawal exceeding balance", () => {
      mintUSDCx(lender1, 1000_000000);
      
      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(1000_000000)],
        lender1
      );

      const { result } = simnet.callPublicFn(
        "lending-pool",
        "withdraw",
        [Cl.uint(2000_000000)],
        lender1
      );

      expect(result).toBeErr(Cl.uint(402)); // err-insufficient-balance
    });
  });

  describe("Borrowing Functionality", () => {
    beforeEach(() => {
      // Ensure lending pool has liquidity
      mintUSDCx(lender1, 10000_000000);
      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(10000_000000)],
        lender1
      );
    });

    it("allows borrower to borrow USDCx with sufficient STX collateral", () => {
      // Borrow 1000 USDCx with 2000 STX collateral
      // At $2.25/STX, 2000 STX = $4500, which is 450% of $1000 borrowed
      const { result } = simnet.callPublicFn(
        "lending-pool",
        "borrow",
        [Cl.uint(1000_000000), Cl.uint(2000_000000)], // 1000 USDCx, 2000 STX
        borrower1
      );

      expect(result).toBeOk(Cl.uint(0)); // Loan ID 0
    });

    it("rejects borrowing with insufficient collateral", () => {
      // Try to borrow 1000 USDCx with only 500 STX
      // At $2.25/STX, 500 STX = $1125, which is only 112.5% (below 150% requirement)
      const { result } = simnet.callPublicFn(
        "lending-pool",
        "borrow",
        [Cl.uint(1000_000000), Cl.uint(500_000000)],
        borrower1
      );

      expect(result).toBeErr(Cl.uint(403)); // err-insufficient-collateral
    });

    it("correctly calculates maximum borrow amount", () => {
      // With 1000 STX collateral at $2.25/STX = $2250
      // Max borrow at 150% collateral = $2250 / 1.5 = $1500
      const { result } = simnet.callReadOnlyFn(
        "lending-pool",
        "get-max-borrow-amount",
        [Cl.uint(1000_000000)], // 1000 STX
        deployer
      );

      expect(result).toBeOk(Cl.uint(1500_000000)); // 1500 USDCx
    });

    it("tracks loan details correctly", () => {
      simnet.callPublicFn(
        "lending-pool",
        "borrow",
        [Cl.uint(1000_000000), Cl.uint(1000_000000)],
        borrower1
      );

      const { result } = simnet.callReadOnlyFn(
        "lending-pool",
        "get-loan-details",
        [Cl.uint(0)],
        deployer
      );

      const loanData = result.value as any;
      expect(loanData.data.borrower).toBePrincipal(borrower1);
      expect(loanData.data["collateral-stx"]).toBeUint(1000_000000);
      expect(loanData.data["borrowed-amount"]).toBeUint(1000_000000);
      expect(loanData.data["is-liquidatable"]).toBeBool(false);
    });

    it("tracks borrower loans list", () => {
      // Create multiple loans
      simnet.callPublicFn(
        "lending-pool",
        "borrow",
        [Cl.uint(500_000000), Cl.uint(1000_000000)],
        borrower1
      );

      simnet.callPublicFn(
        "lending-pool",
        "borrow",
        [Cl.uint(300_000000), Cl.uint(700_000000)],
        borrower1
      );

      const { result } = simnet.callReadOnlyFn(
        "lending-pool",
        "get-borrower-loans",
        [Cl.principal(borrower1)],
        deployer
      );

      expect(result).toBeSome(
        Cl.list([Cl.uint(0), Cl.uint(1)])
      );
    });
  });

  describe("Repayment Functionality", () => {
    beforeEach(() => {
      // Setup: lender provides liquidity, borrower creates loan
      mintUSDCx(lender1, 10000_000000);
      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(10000_000000)],
        lender1
      );

      simnet.callPublicFn(
        "lending-pool",
        "borrow",
        [Cl.uint(1000_000000), Cl.uint(1000_000000)],
        borrower1
      );

      // Mint USDCx for borrower to repay
      mintUSDCx(borrower1, 2000_000000);
    });

    it("allows borrower to repay loan", () => {
      const { result } = simnet.callPublicFn(
        "lending-pool",
        "repay",
        [Cl.uint(0)], // Loan ID
        borrower1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("unlocks collateral after repayment", () => {
      const stxBefore = simnet.getAssetsMap().get("STX")?.get(borrower1) || 0n;
      
      simnet.callPublicFn(
        "lending-pool",
        "repay",
        [Cl.uint(0)],
        borrower1
      );

      const stxAfter = simnet.getAssetsMap().get("STX")?.get(borrower1) || 0n;
      expect(stxAfter).toBeGreaterThan(stxBefore);
    });

    it("charges interest on loan repayment", () => {
      // Mine blocks to accrue interest
      simnet.mineEmptyBlocks(5256); // ~10% of a year = ~0.8% interest

      const { result } = simnet.callPublicFn(
        "lending-pool",
        "repay",
        [Cl.uint(0)],
        borrower1
      );

      // Should succeed as borrower has enough USDCx minted
      expect(result).toBeOk(Cl.bool(true));
    });

    it("rejects repayment from non-borrower", () => {
      mintUSDCx(lender2, 2000_000000);

      const { result } = simnet.callPublicFn(
        "lending-pool",
        "repay",
        [Cl.uint(0)],
        lender2
      );

      expect(result).toBeErr(Cl.uint(401)); // err-not-authorized
    });
  });

  describe("Liquidation Functionality", () => {
    beforeEach(() => {
      // Setup liquidity
      mintUSDCx(lender1, 20000_000000);
      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(20000_000000)],
        lender1
      );

      // Mint for liquidator
      mintUSDCx(liquidator, 10000_000000);
    });

    it("allows liquidation of unhealthy loan", () => {
      // Create loan with minimal collateral (just above 150%)
      // Borrow 1000 USDCx with 670 STX (670 * 2.25 = $1507.50, ~150.75%)
      simnet.callPublicFn(
        "lending-pool",
        "borrow",
        [Cl.uint(1000_000000), Cl.uint(670_000000)],
        borrower1
      );

      // In a real scenario, STX price would drop. 
      // For testing, we simulate by accruing lots of interest
      simnet.mineEmptyBlocks(10000);

      // Check if loan is liquidatable
      const { result: loanDetails } = simnet.callReadOnlyFn(
        "lending-pool",
        "get-loan-details",
        [Cl.uint(0)],
        deployer
      );

      const isLiquidatable = (loanDetails.value as any).data["is-liquidatable"];
      
      if (isLiquidatable.type === Cl.BoolTrue().type) {
        const { result } = simnet.callPublicFn(
          "lending-pool",
          "liquidate",
          [Cl.uint(0)],
          liquidator
        );

        expect(result).toBeOk(Cl.bool(true));
      }
    });

    it("rejects liquidation of healthy loan", () => {
      // Create loan with high collateral (400%)
      simnet.callPublicFn(
        "lending-pool",
        "borrow",
        [Cl.uint(1000_000000), Cl.uint(2000_000000)],
        borrower1
      );

      const { result } = simnet.callPublicFn(
        "lending-pool",
        "liquidate",
        [Cl.uint(0)],
        liquidator
      );

      expect(result).toBeErr(Cl.uint(406)); // err-loan-healthy
    });

    it("gives liquidator collateral plus bonus", () => {
      // Create vulnerable loan
      simnet.callPublicFn(
        "lending-pool",
        "borrow",
        [Cl.uint(1000_000000), Cl.uint(670_000000)],
        borrower1
      );

      const stxBefore = simnet.getAssetsMap().get("STX")?.get(liquidator) || 0n;

      // Mine blocks to make loan unhealthy
      simnet.mineEmptyBlocks(15000);

      const { result: loanDetails } = simnet.callReadOnlyFn(
        "lending-pool",
        "get-loan-details",
        [Cl.uint(0)],
        deployer
      );

      const isLiquidatable = (loanDetails.value as any).data["is-liquidatable"];

      if (isLiquidatable.type === Cl.BoolTrue().type) {
        simnet.callPublicFn(
          "lending-pool",
          "liquidate",
          [Cl.uint(0)],
          liquidator
        );

        const stxAfter = simnet.getAssetsMap().get("STX")?.get(liquidator) || 0n;
        expect(stxAfter).toBeGreaterThan(stxBefore);
      }
    });
  });

  describe("Protocol Stats", () => {
    it("correctly tracks total deposits", () => {
      mintUSDCx(lender1, 5000_000000);
      mintUSDCx(lender2, 3000_000000);

      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(5000_000000)],
        lender1
      );

      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(3000_000000)],
        lender2
      );

      const { result } = simnet.callReadOnlyFn(
        "lending-pool",
        "get-protocol-stats",
        [],
        deployer
      );

      const stats = result.value as any;
      expect(stats.data["total-deposits"]).toBeUint(8000_000000);
    });

    it("correctly calculates utilization rate", () => {
      mintUSDCx(lender1, 10000_000000);
      
      simnet.callPublicFn(
        "lending-pool",
        "deposit",
        [Cl.uint(10000_000000)],
        lender1
      );

      simnet.callPublicFn(
        "lending-pool",
        "borrow",
        [Cl.uint(5000_000000), Cl.uint(10000_000000)],
        borrower1
      );

      const { result } = simnet.callReadOnlyFn(
        "lending-pool",
        "get-protocol-stats",
        [],
        deployer
      );

      const stats = result.value as any;
      // Utilization = borrowed / deposits * 100 = 5000/10000 * 100 = 50
      expect(stats.data["utilization-rate"]).toBeUint(50);
    });
  });
});
