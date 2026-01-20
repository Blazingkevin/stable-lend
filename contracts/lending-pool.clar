;; StableLend - USDCx Lending Protocol
;; The first lending protocol on Bitcoin L2 (Stacks)
;; Allows users to lend USDCx and earn interest, or borrow USDCx against STX collateral

;; ============================================
;; CONSTANTS
;; ============================================

;; USDCx Token Contract
;; For local testing: .mock-usdcx
;; For mainnet deployment: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
(define-constant usdcx-contract .mock-usdcx)

;; Contract owner
(define-constant contract-owner tx-sender)

;; Interest rate: 8% APY (fixed for MVP)
;; Represented as basis points (800 = 8.00%)
(define-constant annual-interest-rate-bps u800)

;; Collateral ratio: 150% (user must deposit 1.5x value of what they borrow)
(define-constant collateral-ratio u150)

;; Liquidation threshold: 120% (if collateral drops below 1.2x debt, can be liquidated)
(define-constant liquidation-threshold u120)

;; Liquidation bonus: 5% (liquidator gets 5% extra collateral as reward)
(define-constant liquidation-bonus-bps u500)

;; Time constants (Stacks block time ~10 minutes)
(define-constant blocks-per-year u52560) ;; ~365 days * 144 blocks/day
(define-constant blocks-per-day u144)

;; STX price in USD (6 decimals: 2250000 = $2.25)
;; In production, this would come from an oracle
(define-constant stx-price-usd u2250000)

;; Price decimals (for precision)
(define-constant price-decimals u1000000) ;; 6 decimals

;; Error codes
(define-constant err-not-authorized (err u401))
(define-constant err-insufficient-balance (err u402))
(define-constant err-insufficient-collateral (err u403))
(define-constant err-loan-not-found (err u404))
(define-constant err-transfer-failed (err u405))
(define-constant err-loan-healthy (err u406))
(define-constant err-invalid-amount (err u407))
(define-constant err-not-liquidatable (err u408))
(define-constant err-too-many-loans (err u409))

;; ============================================
;; DATA MAPS & VARS
;; ============================================

;; Track lender deposits
(define-map lenders
  { lender: principal }
  {
    deposited-amount: uint,
    deposit-block: uint,
    last-claim-block: uint
  }
)

;; Track borrower loans
(define-map loans
  { loan-id: uint }
  {
    borrower: principal,
    collateral-amount: uint,
    borrowed-amount: uint,
    borrow-block: uint,
    last-interest-block: uint,
    accumulated-interest: uint,
    active: bool
  }
)

;; Mapping from borrower to their loan IDs
(define-map borrower-loans
  { borrower: principal }
  { loan-ids: (list 100 uint) }
)

;; Data vars
(define-data-var next-loan-id uint u1)
(define-data-var total-deposits uint u0)
(define-data-var total-borrowed uint u0)
(define-data-var total-interest-paid uint u0)

;; ============================================
;; PRIVATE HELPER FUNCTIONS
;; ============================================

;; Calculate interest earned on deposit
(define-private (calculate-deposit-interest
    (principal-amount uint)
    (blocks-elapsed uint))
  (let (
    (interest-numerator (* (* principal-amount annual-interest-rate-bps) blocks-elapsed))
    (interest-denominator (* u10000 blocks-per-year))
  )
    (/ interest-numerator interest-denominator)
  )
)

;; Calculate interest owed on loan
(define-private (calculate-loan-interest
    (borrowed-amount uint)
    (blocks-elapsed uint))
  (calculate-deposit-interest borrowed-amount blocks-elapsed)
)

;; Calculate collateral value in USD (6 decimals)
(define-private (calculate-collateral-value (collateral-stx uint))
  (/ (* collateral-stx stx-price-usd) u1000000)
)

;; Calculate health factor (scaled by 100)
(define-private (calculate-health-factor
    (collateral-stx uint)
    (debt-amount uint))
  (let (
    (collateral-value (calculate-collateral-value collateral-stx))
  )
    (if (is-eq debt-amount u0)
      u999999
      (/ (* collateral-value u100) debt-amount)
    )
  )
)

;; Add loan ID to borrower's list
(define-private (add-loan-to-borrower (borrower principal) (loan-id uint))
  (let (
    (current-loans (default-to 
      { loan-ids: (list) } 
      (map-get? borrower-loans { borrower: borrower })
    ))
    (updated-loans (unwrap-panic
      (as-max-len? 
        (append (get loan-ids current-loans) loan-id) 
        u100
      )
    ))
  )
    (begin
      (map-set borrower-loans
        { borrower: borrower }
        { loan-ids: updated-loans }
      )
      true
    )
  )
)

;; ============================================
;; PUBLIC FUNCTIONS - LENDING
;; ============================================

;; Deposit USDCx to earn interest
(define-public (deposit (amount uint))
  (let (
    (existing-deposit (map-get? lenders { lender: tx-sender }))
  )
    (asserts! (> amount u0) err-invalid-amount)
    
    (try! (contract-call? .mock-usdcx 
      transfer 
      amount 
      tx-sender 
      (as-contract tx-sender) 
      none
    ))
    
    (match existing-deposit
      deposit-data
      (let (
        (blocks-elapsed (- block-height (get last-claim-block deposit-data)))
        (interest-earned (calculate-deposit-interest (get deposited-amount deposit-data) blocks-elapsed))
        (new-total (+ (+ (get deposited-amount deposit-data) interest-earned) amount))
      )
        (map-set lenders
          { lender: tx-sender }
          {
            deposited-amount: new-total,
            deposit-block: (get deposit-block deposit-data),
            last-claim-block: block-height
          }
        )
      )
      (map-set lenders
        { lender: tx-sender }
        {
          deposited-amount: amount,
          deposit-block: block-height,
          last-claim-block: block-height
        }
      )
    )
    
    (var-set total-deposits (+ (var-get total-deposits) amount))
    
    (print {
      event: "deposit",
      lender: tx-sender,
      amount: amount,
      block: block-height
    })
    
    (ok amount)
  )
)

;; Withdraw USDCx plus earned interest
(define-public (withdraw (amount uint))
  (let (
    (lender tx-sender)
    (deposit-data (unwrap! (map-get? lenders { lender: lender }) err-not-authorized))
    (blocks-elapsed (- block-height (get last-claim-block deposit-data)))
    (interest-earned (calculate-deposit-interest (get deposited-amount deposit-data) blocks-elapsed))
    (total-balance (+ (get deposited-amount deposit-data) interest-earned))
  )
    (asserts! (> amount u0) err-invalid-amount)
    (asserts! (<= amount total-balance) err-insufficient-balance)
    
    (if (is-eq amount total-balance)
      (map-delete lenders { lender: lender })
      (map-set lenders
        { lender: lender }
        {
          deposited-amount: (- total-balance amount),
          deposit-block: (get deposit-block deposit-data),
          last-claim-block: block-height
        }
      )
    )
    
    (try! (as-contract (contract-call? .mock-usdcx 
      transfer 
      amount 
      tx-sender 
      lender
      none
    )))
    
    (var-set total-deposits (- (var-get total-deposits) amount))
    
    (print {
      event: "withdraw",
      lender: tx-sender,
      amount: amount,
      interest-earned: (if (<= interest-earned amount) interest-earned u0),
      block: block-height
    })
    
    (ok amount)
  )
)

;; ============================================
;; PUBLIC FUNCTIONS - BORROWING
;; ============================================

;; Borrow USDCx by locking STX as collateral
(define-public (borrow (borrow-amount uint) (collateral-stx uint))
  (let (
    (borrower tx-sender)
    (loan-id (var-get next-loan-id))
    (collateral-value (calculate-collateral-value collateral-stx))
    (required-collateral (/ (* borrow-amount collateral-ratio) u100))
  )
    (asserts! (> borrow-amount u0) err-invalid-amount)
    (asserts! (> collateral-stx u0) err-invalid-amount)
    (asserts! (>= collateral-value required-collateral) err-insufficient-collateral)
    
    (try! (stx-transfer? collateral-stx borrower (as-contract tx-sender)))
    
    (try! (as-contract (contract-call? .mock-usdcx 
      transfer 
      borrow-amount 
      tx-sender 
      borrower
      none
    )))
    
    (map-set loans
      { loan-id: loan-id }
      {
        borrower: borrower,
        collateral-amount: collateral-stx,
        borrowed-amount: borrow-amount,
        borrow-block: block-height,
        last-interest-block: block-height,
        accumulated-interest: u0,
        active: true
      }
    )
    
    (add-loan-to-borrower borrower loan-id)
    
    (var-set next-loan-id (+ loan-id u1))
    (var-set total-borrowed (+ (var-get total-borrowed) borrow-amount))
    
    (print {
      event: "borrow",
      loan-id: loan-id,
      borrower: borrower,
      borrow-amount: borrow-amount,
      collateral-stx: collateral-stx,
      health-factor: (calculate-health-factor collateral-stx borrow-amount),
      block: block-height
    })
    
    (ok loan-id)
  )
)

;; Repay loan and unlock collateral
(define-public (repay (loan-id uint))
  (let (
    (loan-data (unwrap! (map-get? loans { loan-id: loan-id }) err-loan-not-found))
    (blocks-elapsed (- block-height (get last-interest-block loan-data)))
    (interest-owed (calculate-loan-interest (get borrowed-amount loan-data) blocks-elapsed))
    (total-owed (+ (get borrowed-amount loan-data) (get accumulated-interest loan-data) interest-owed))
  )
    (asserts! (is-eq tx-sender (get borrower loan-data)) err-not-authorized)
    (asserts! (get active loan-data) err-loan-not-found)
    
    (try! (contract-call? .mock-usdcx 
      transfer 
      total-owed 
      tx-sender 
      (as-contract tx-sender) 
      none
    ))
    
    (try! (as-contract (stx-transfer? (get collateral-amount loan-data) tx-sender (get borrower loan-data))))
    
    (map-set loans
      { loan-id: loan-id }
      (merge loan-data { active: false })
    )
    
    (var-set total-borrowed (- (var-get total-borrowed) (get borrowed-amount loan-data)))
    (var-set total-interest-paid (+ (var-get total-interest-paid) interest-owed))
    
    (print {
      event: "repay",
      loan-id: loan-id,
      borrower: tx-sender,
      repaid-amount: total-owed,
      interest-paid: interest-owed,
      block: block-height
    })
    
    (ok total-owed)
  )
)

;; ============================================
;; PUBLIC FUNCTIONS - LIQUIDATION
;; ============================================

;; Liquidate an unhealthy loan
(define-public (liquidate (loan-id uint))
  (let (
    (loan-data (unwrap! (map-get? loans { loan-id: loan-id }) err-loan-not-found))
    (blocks-elapsed (- block-height (get last-interest-block loan-data)))
    (interest-owed (calculate-loan-interest (get borrowed-amount loan-data) blocks-elapsed))
    (total-debt (+ (get borrowed-amount loan-data) (get accumulated-interest loan-data) interest-owed))
    (health-factor (calculate-health-factor (get collateral-amount loan-data) total-debt))
  )
    (asserts! (get active loan-data) err-loan-not-found)
    (asserts! (< health-factor liquidation-threshold) err-loan-healthy)
    
    (try! (contract-call? .mock-usdcx 
      transfer 
      total-debt 
      tx-sender 
      (as-contract tx-sender) 
      none
    ))
    
    (try! (as-contract (stx-transfer? (get collateral-amount loan-data) tx-sender tx-sender)))
    
    (map-set loans
      { loan-id: loan-id }
      (merge loan-data { active: false })
    )
    
    (var-set total-borrowed (- (var-get total-borrowed) (get borrowed-amount loan-data)))
    
    (print {
      event: "liquidate",
      loan-id: loan-id,
      liquidator: tx-sender,
      borrower: (get borrower loan-data),
      debt-repaid: total-debt,
      collateral-seized: (get collateral-amount loan-data),
      health-factor: health-factor,
      block: block-height
    })
    
    (ok true)
  )
)

;; ============================================
;; READ-ONLY FUNCTIONS
;; ============================================

;; Get lender's current balance
(define-read-only (get-lender-balance (lender principal))
  (match (map-get? lenders { lender: lender })
    deposit-data
    (let (
      (blocks-elapsed (- block-height (get last-claim-block deposit-data)))
      (interest-earned (calculate-deposit-interest (get deposited-amount deposit-data) blocks-elapsed))
    )
      (ok {
        principal: (get deposited-amount deposit-data),
        interest: interest-earned,
        total: (+ (get deposited-amount deposit-data) interest-earned),
        deposit-block: (get deposit-block deposit-data),
        blocks-elapsed: blocks-elapsed
      })
    )
    err-not-authorized
  )
)

;; Get loan details
(define-read-only (get-loan-details (loan-id uint))
  (match (map-get? loans { loan-id: loan-id })
    loan-data
    (let (
      (blocks-elapsed (- block-height (get last-interest-block loan-data)))
      (interest-owed (calculate-loan-interest (get borrowed-amount loan-data) blocks-elapsed))
      (total-debt (+ (get borrowed-amount loan-data) (get accumulated-interest loan-data) interest-owed))
      (health-factor (calculate-health-factor (get collateral-amount loan-data) total-debt))
    )
      (ok {
        borrower: (get borrower loan-data),
        collateral-stx: (get collateral-amount loan-data),
        borrowed-amount: (get borrowed-amount loan-data),
        interest-owed: interest-owed,
        total-debt: total-debt,
        health-factor: health-factor,
        active: (get active loan-data),
        borrow-block: (get borrow-block loan-data),
        is-liquidatable: (< health-factor liquidation-threshold)
      })
    )
    err-loan-not-found
  )
)

;; Get borrower's loan IDs
(define-read-only (get-borrower-loans (borrower principal))
  (ok (default-to 
    { loan-ids: (list) } 
    (map-get? borrower-loans { borrower: borrower })
  ))
)

;; Get protocol stats
(define-read-only (get-protocol-stats)
  (ok {
    total-deposits: (var-get total-deposits),
    total-borrowed: (var-get total-borrowed),
    total-interest-paid: (var-get total-interest-paid),
    utilization-rate: (if (> (var-get total-deposits) u0)
                        (/ (* (var-get total-borrowed) u10000) (var-get total-deposits))
                        u0),
    next-loan-id: (var-get next-loan-id)
  })
)

;; Calculate max borrow amount
(define-read-only (get-max-borrow-amount (collateral-stx uint))
  (let (
    (collateral-value (calculate-collateral-value collateral-stx))
    (max-borrow (/ (* collateral-value u100) collateral-ratio))
  )
    (ok max-borrow)
  )
)

;; Get current APY
(define-read-only (get-current-apy)
  (ok annual-interest-rate-bps)
)

