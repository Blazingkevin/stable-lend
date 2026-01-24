;; DIA Oracle Integration Tests
;; Test the oracle functions in StableLend V6

;; Test 1: Direct DIA Oracle Call
;; This should return the current STX/USD price from DIA
(contract-call? 'ST1S5ZGRZV5K4S9205RWPRTX9RGS9JV40KQMR4G1J.dia-oracle get-value "STX/USD")

;; Expected result:
;; (ok { value: u225000000, timestamp: u<block-height> })
;; Where value is in 8 decimals (225000000 = $2.25)

;; Test 2: Get STX Price (Converted)
;; This calls our wrapper that converts to 6 decimals
(contract-call? .stablelend-pool-v6-fixed get-stx-price-usd)

;; Expected result:
;; (ok u2250000)  ;; 6 decimals: $2.25

;; Test 3: Get STX Price Safe (Never Fails)
;; This returns a fallback if oracle fails
(contract-call? .stablelend-pool-v6-fixed get-stx-price-usd-safe)

;; Expected result:
;; u2250000  ;; Always returns a price

;; Test 4: Calculate Collateral Value
;; For 1000 STX at $2.25 = $2,250
;; (contract-call? .stablelend-pool-v6-fixed calculate-collateral-value u1000000000)
;; Note: This is a private function, cannot be called directly

;; Test 5: Get Health Factor
;; Requires an active loan to exist first
;; (contract-call? .stablelend-pool-v6-fixed get-health-factor u0)

;; Test 6: Full Borrow Flow with Oracle
;; Step 1: Deposit USDCx (as lender)
;; (contract-call? .stablelend-pool-v6-fixed deposit u10000000000)

;; Step 2: Borrow USDCx with STX collateral (as borrower)
;; Borrow 1000 USDCx with 1000 STX collateral
;; At $2.25/STX, collateral = $2250, need 150% = min $1500 for $1000 borrow ✅
;; (contract-call? .stablelend-pool-v6-fixed borrow u1000000000 u1000000000)

;; Step 3: Check loan details (includes health factor)
;; (contract-call? .stablelend-pool-v6-fixed get-loan-details u0)

;; Test 7: Oracle Staleness
;; This would require manipulating block-height to test
;; In production, after 1440 blocks without oracle update, should fail

;; Test 8: Oracle Failure Simulation
;; Cannot easily simulate without modifying oracle contract
;; In production, if DIA oracle is down, borrow/liquidate should fail gracefully

;; ============================================
;; MANUAL TESTING STEPS
;; ============================================

;; 1. Deploy contract to testnet
;; 2. Open Clarinet console in testnet mode
;; 3. Run tests in order:

;; Check DIA oracle is working:
;; (contract-call? 'ST1S5ZGRZV5K4S9205RWPRTX9RGS9JV40KQMR4G1J.dia-oracle get-value "STX/USD")

;; Check our price conversion:
;; (contract-call? '<deployer>.stablelend-pool-v6-fixed get-stx-price-usd)

;; Deposit as lender:
;; ::set_tx_sender ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
;; (contract-call? '<deployer>.stablelend-pool-v6-fixed deposit u10000000000)

;; Borrow as borrower (different address):
;; ::set_tx_sender ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
;; (contract-call? '<deployer>.stablelend-pool-v6-fixed borrow u1000000000 u1000000000)

;; Check loan health factor:
;; (contract-call? '<deployer>.stablelend-pool-v6-fixed get-health-factor u0)

;; Get full loan details:
;; (contract-call? '<deployer>.stablelend-pool-v6-fixed get-loan-details u0)

;; ============================================
;; EXPECTED RESULTS AT $2.25 STX
;; ============================================

;; Borrow: 1000 USDCx
;; Collateral: 1000 STX = $2250
;; Required: $1500 (150%)
;; Health Factor: (2250 * 100) / 1000 = 225% ✅ HEALTHY

;; Liquidation Threshold: 120%
;; Would liquidate if: (collateral * 100) / debt < 120
;; Would liquidate if: STX price drops below $1.20

;; ============================================
;; PRICE SCENARIOS
;; ============================================

;; Scenario 1: STX = $3.00
;; Collateral value: 1000 * 3.00 = $3000
;; Health Factor: 3000 / 1000 = 300% (Very Healthy)

;; Scenario 2: STX = $1.50
;; Collateral value: 1000 * 1.50 = $1500
;; Health Factor: 1500 / 1000 = 150% (Healthy)

;; Scenario 3: STX = $1.30
;; Collateral value: 1000 * 1.30 = $1300
;; Health Factor: 1300 / 1000 = 130% (Healthy but Close)

;; Scenario 4: STX = $1.15
;; Collateral value: 1000 * 1.15 = $1150
;; Health Factor: 1150 / 1000 = 115% (LIQUIDATABLE! < 120%)
