;; StableLend Pool - Bitcoin L2 Lending Protocol
;; Production-ready lending protocol on Stacks blockchain
;; Lend USDCx and earn interest. Borrow USDCx against STX collateral.

;; ============================================
;; CONSTANTS
;; ============================================

;; Contract owner
(define-constant contract-owner tx-sender)

;; Burn address for validation
(define-constant zero-address 'SP000000000000000000002Q6VF78)

;; Interest rate: 8% APY
(define-constant annual-interest-rate-bps u800)

;; Collateral ratio: 150%
(define-constant collateral-ratio u150)

;; Liquidation threshold: 120%
(define-constant liquidation-threshold u120)

;; Liquidation bonus: 5%
(define-constant liquidation-bonus-bps u500)

;; Protocol fee: 10%
(define-constant protocol-fee-bps u1000)

;; Max protocol fee: 100%
(define-constant max-valid-protocol-fee u10000)

;; Time constants
(define-constant blocks-per-year u52560)
(define-constant blocks-per-day u144)

;; STX price in USD (6 decimals) - will use oracle in production
(define-constant stx-price-usd u2250000)

;; Price decimals
(define-constant price-decimals u1000000)

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
(define-constant err-invalid-address (err u410))
(define-constant err-protocol-paused (err u411))
(define-constant err-supply-cap-exceeded (err u412))
(define-constant err-borrow-cap-exceeded (err u413))
(define-constant err-cannot-liquidate-self (err u414))

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
(define-data-var next-loan-id uint u0)
(define-data-var total-deposits uint u0)
(define-data-var total-borrowed uint u0)
(define-data-var total-interest-paid uint u0)

;; Track unique lenders and borrowers for statistics
(define-map unique-lenders { lender: principal } { active: bool })
(define-map unique-borrowers { borrower: principal } { active: bool })
(define-data-var total-lenders uint u0)
(define-data-var total-borrowers uint u0)

;; Track 24h volume (simplified: last 144 blocks)
(define-data-var volume-24h uint u0)
(define-data-var last-volume-reset-block uint u0)

;; Protocol revenue tracking
(define-data-var protocol-revenue-accumulated uint u0)
(define-data-var protocol-treasury principal contract-owner)

;; Pause mechanism for emergencies
(define-data-var protocol-paused bool false)

;; Supply and borrow caps for risk management
(define-data-var supply-cap uint u100000000000)
(define-data-var borrow-cap uint u50000000000)

;; ============================================
;; PRIVATE HELPER FUNCTIONS
;; ============================================

;; Calculate utilization rate (scaled by 10000)
(define-private (get-utilization-rate)
  (let (
    (total-deps (var-get total-deposits))
    (total-borr (var-get total-borrowed))
  )
    (if (is-eq total-deps u0)
      u0
      (/ (* total-borr u10000) total-deps)
    )
  )
)

;; Calculate interest earned on deposit (utilization-based)
(define-private (calculate-deposit-interest
    (principal-amount uint)
    (blocks-elapsed uint))
  (let (
    (utilization (get-utilization-rate))
    (effective-rate-bps (/ (* annual-interest-rate-bps utilization) u10000))
    (interest-numerator (* (* principal-amount effective-rate-bps) blocks-elapsed))
    (interest-denominator (* u10000 blocks-per-year))
  )
    (/ interest-numerator interest-denominator)
  )
)

;; Calculate interest owed on loan
(define-private (calculate-loan-interest
    (borrowed-amount uint)
    (blocks-elapsed uint))
  (let (
    (interest-numerator (* (* borrowed-amount annual-interest-rate-bps) blocks-elapsed))
    (interest-denominator (* u10000 blocks-per-year))
  )
    (/ interest-numerator interest-denominator)
  )
)

;; Calculate collateral value in USD
(define-private (calculate-collateral-value (collateral-stx uint))
  (/ (* collateral-stx stx-price-usd) u1000000)
)

;; Calculate health factor
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

;; Update 24h volume
(define-private (update-volume (amount uint))
  (let (
    (blocks-since-reset (- block-height (var-get last-volume-reset-block)))
  )
    (if (>= blocks-since-reset blocks-per-day)
      (begin
        (var-set volume-24h amount)
        (var-set last-volume-reset-block block-height)
      )
      (var-set volume-24h (+ (var-get volume-24h) amount))
    )
  )
)

;; Track unique lenders and borrowers
(define-private (track-unique-lender (lender principal))
  (if (is-none (map-get? unique-lenders { lender: lender }))
    (begin
      (map-set unique-lenders { lender: lender } { active: true })
      (var-set total-lenders (+ (var-get total-lenders) u1))
    )
    true
  )
)

(define-private (track-unique-borrower (borrower principal))
  (if (is-none (map-get? unique-borrowers { borrower: borrower }))
    (begin
      (map-set unique-borrowers { borrower: borrower } { active: true })
      (var-set total-borrowers (+ (var-get total-borrowers) u1))
    )
    true
  )
)

;; ============================================
;; PUBLIC FUNCTIONS - EMERGENCY CONTROLS
;; ============================================

;; Pause protocol
(define-public (pause-protocol)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-not-authorized)
    (var-set protocol-paused true)
    (print { event: "protocol-paused", block: block-height })
    (ok true)
  )
)

;; Unpause protocol
(define-public (unpause-protocol)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-not-authorized)
    (var-set protocol-paused false)
    (print { event: "protocol-unpaused", block: block-height })
    (ok true)
  )
)

;; Update supply cap
(define-public (update-supply-cap (new-cap uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-not-authorized)
    (var-set supply-cap new-cap)
    (print { event: "supply-cap-updated", new-cap: new-cap, block: block-height })
    (ok true)
  )
)

;; Update borrow cap
(define-public (update-borrow-cap (new-cap uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-not-authorized)
    (var-set borrow-cap new-cap)
    (print { event: "borrow-cap-updated", new-cap: new-cap, block: block-height })
    (ok true)
  )
)

;; ============================================
;; PUBLIC FUNCTIONS - LENDING
;; ============================================

;; Deposit USDCx to earn interest
(define-public (deposit (amount uint))
  (let (
    (existing-deposit (map-get? lenders { lender: tx-sender }))
    (new-total-deposits (+ (var-get total-deposits) amount))
  )
    ;; Validate inputs and protocol state
    (asserts! (not (var-get protocol-paused)) err-protocol-paused)
    (asserts! (> amount u0) err-invalid-amount)
    (asserts! (<= new-total-deposits (var-get supply-cap)) err-supply-cap-exceeded)
    
    ;; Update state before external calls
    (match existing-deposit
      deposit-data
      (let (
        (blocks-elapsed (- block-height (get last-claim-block deposit-data)))
        (interest-earned (calculate-deposit-interest (get deposited-amount deposit-data) blocks-elapsed))
        (new-balance (+ (+ (get deposited-amount deposit-data) interest-earned) amount))
      )
        (map-set lenders
          { lender: tx-sender }
          {
            deposited-amount: new-balance,
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
    
    (var-set total-deposits new-total-deposits)
    (track-unique-lender tx-sender)
    (update-volume amount)
    
    ;; Transfer tokens from user
    (try! (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
      transfer 
      amount 
      tx-sender 
      (as-contract tx-sender) 
      none
    ))
    
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
    ;; Validate inputs and protocol state
    (asserts! (not (var-get protocol-paused)) err-protocol-paused)
    (asserts! (> amount u0) err-invalid-amount)
    (asserts! (<= amount total-balance) err-insufficient-balance)
    
    ;; Update state before external calls
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
    
    (var-set total-deposits (- (var-get total-deposits) amount))
    (update-volume amount)
    
    ;; Transfer tokens to user
    (try! (as-contract (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
      transfer 
      amount 
      tx-sender 
      lender
      none
    )))
    
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
    (new-total-borrowed (+ (var-get total-borrowed) borrow-amount))
  )
    ;; Validate inputs and protocol state
    (asserts! (not (var-get protocol-paused)) err-protocol-paused)
    (asserts! (> borrow-amount u0) err-invalid-amount)
    (asserts! (> collateral-stx u0) err-invalid-amount)
    (asserts! (>= collateral-value required-collateral) err-insufficient-collateral)
    (asserts! (<= new-total-borrowed (var-get borrow-cap)) err-borrow-cap-exceeded)
    
    ;; Update state before external calls
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
    (var-set total-borrowed new-total-borrowed)
    (track-unique-borrower borrower)
    (update-volume borrow-amount)
    
    ;; Transfer collateral and loan amount
    (try! (stx-transfer? collateral-stx borrower (as-contract tx-sender)))
    
    (try! (as-contract (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
      transfer 
      borrow-amount 
      tx-sender 
      borrower
      none
    )))
    
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
    (total-interest (+ (get accumulated-interest loan-data) interest-owed))
    (total-owed (+ (get borrowed-amount loan-data) total-interest))
    
    ;; Split interest: 90% to lenders, 10% to protocol
    (protocol-fee (/ (* total-interest protocol-fee-bps) u10000))
    (lender-share (- total-interest protocol-fee))
  )
    ;; Validate inputs and protocol state
    (asserts! (not (var-get protocol-paused)) err-protocol-paused)
    (asserts! (is-eq tx-sender (get borrower loan-data)) err-not-authorized)
    (asserts! (get active loan-data) err-loan-not-found)
    
    ;; Update state before external calls
    (map-set loans
      { loan-id: loan-id }
      (merge loan-data { active: false })
    )
    
    (var-set total-borrowed (- (var-get total-borrowed) (get borrowed-amount loan-data)))
    (var-set total-interest-paid (+ (var-get total-interest-paid) total-interest))
    (var-set total-deposits (+ (var-get total-deposits) lender-share))
    (var-set protocol-revenue-accumulated (+ (var-get protocol-revenue-accumulated) protocol-fee))
    
    ;; Transfer repayment and return collateral
    (try! (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
      transfer 
      total-owed 
      tx-sender 
      (as-contract tx-sender) 
      none
    ))
    
    (try! (as-contract (stx-transfer? (get collateral-amount loan-data) tx-sender (get borrower loan-data))))
    
    (print {
      event: "repay",
      loan-id: loan-id,
      borrower: tx-sender,
      repaid-amount: total-owed,
      total-interest: total-interest,
      protocol-fee: protocol-fee,
      lender-share: lender-share,
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
    
    ;; Calculate liquidator bonus
    (liquidation-bonus (/ (* (get collateral-amount loan-data) liquidation-bonus-bps) u10000))
    (total-collateral-to-liquidator (+ (get collateral-amount loan-data) liquidation-bonus))
  )
    ;; Validate liquidation conditions
    (asserts! (not (var-get protocol-paused)) err-protocol-paused)
    (asserts! (get active loan-data) err-loan-not-found)
    (asserts! (< health-factor liquidation-threshold) err-loan-healthy)
    (asserts! (not (is-eq tx-sender (get borrower loan-data))) err-cannot-liquidate-self)
    
    ;; Update state before external calls
    (map-set loans
      { loan-id: loan-id }
      (merge loan-data { active: false })
    )
    
    (var-set total-borrowed (- (var-get total-borrowed) (get borrowed-amount loan-data)))
    
    ;; Execute transfers
    (try! (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
      transfer 
      total-debt 
      tx-sender 
      (as-contract tx-sender) 
      none
    ))
    
    (try! (as-contract (stx-transfer? total-collateral-to-liquidator tx-sender tx-sender)))
    
    (print {
      event: "liquidate",
      loan-id: loan-id,
      liquidator: tx-sender,
      borrower: (get borrower loan-data),
      debt-repaid: total-debt,
      collateral-seized: total-collateral-to-liquidator,
      liquidation-bonus: liquidation-bonus,
      health-factor: health-factor,
      block: block-height
    })
    
    (ok true)
  )
)

;; ============================================
;; PUBLIC FUNCTIONS - PROTOCOL TREASURY
;; ============================================

;; Withdraw protocol revenue to treasury address
(define-public (withdraw-protocol-revenue (amount uint))
  (let (
    (treasury (var-get protocol-treasury))
    (current-revenue (var-get protocol-revenue-accumulated))
  )
    (asserts! (is-eq tx-sender treasury) err-not-authorized)
    (asserts! (> amount u0) err-invalid-amount)
    (asserts! (<= amount current-revenue) err-insufficient-balance)
    
    ;; Update state before external calls
    (var-set protocol-revenue-accumulated (- current-revenue amount))
    
    ;; Execute transfer
    (try! (as-contract (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
      transfer 
      amount 
      tx-sender 
      treasury
      none
    )))
    
    (print {
      event: "protocol-revenue-withdrawal",
      treasury: treasury,
      amount: amount,
      remaining-revenue: (- current-revenue amount),
      block: block-height
    })
    
    (ok amount)
  )
)

;; Update protocol treasury address
(define-public (update-protocol-treasury (new-treasury principal))
  (let (
    (current-treasury (var-get protocol-treasury))
  )
    (asserts! (is-eq tx-sender current-treasury) err-not-authorized)
    (asserts! (not (is-eq new-treasury zero-address)) err-invalid-address)
    (asserts! (not (is-eq new-treasury current-treasury)) err-invalid-address)
    
    (var-set protocol-treasury new-treasury)
    
    (print {
      event: "treasury-updated",
      old-treasury: current-treasury,
      new-treasury: new-treasury,
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
    protocol-revenue: (var-get protocol-revenue-accumulated),
    utilization-rate: (if (> (var-get total-deposits) u0)
                        (/ (* (var-get total-borrowed) u10000) (var-get total-deposits))
                        u0),
    next-loan-id: (var-get next-loan-id),
    total-lenders: (var-get total-lenders),
    total-borrowers: (var-get total-borrowers),
    active-users: (+ (var-get total-lenders) (var-get total-borrowers)),
    volume-24h: (var-get volume-24h),
    paused: (var-get protocol-paused),
    supply-cap: (var-get supply-cap),
    borrow-cap: (var-get borrow-cap)
  })
)

;; Get current effective lender APY (based on utilization)
(define-read-only (get-effective-lender-apy)
  (let (
    (utilization-bps (get-utilization-rate))
    (effective-apy-bps (/ (* annual-interest-rate-bps utilization-bps) u10000))
  )
    (ok effective-apy-bps)
  )
)

;; Get protocol revenue
(define-read-only (get-protocol-revenue)
  (ok (var-get protocol-revenue-accumulated))
)

;; Get protocol treasury address
(define-read-only (get-protocol-treasury)
  (ok (var-get protocol-treasury))
)

;; Check if protocol is paused
(define-read-only (is-protocol-paused)
  (ok (var-get protocol-paused))
)

;; Get supply and borrow caps
(define-read-only (get-caps)
  (ok {
    supply-cap: (var-get supply-cap),
    borrow-cap: (var-get borrow-cap),
    current-supply: (var-get total-deposits),
    current-borrowed: (var-get total-borrowed),
    supply-available: (- (var-get supply-cap) (var-get total-deposits)),
    borrow-available: (- (var-get borrow-cap) (var-get total-borrowed))
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

;; Get total value locked (TVL) in USD (6 decimals)
(define-read-only (get-tvl-usd)
  (ok (var-get total-deposits))
)

;; Get liquidation stats
(define-read-only (get-liquidation-stats)
  (ok {
    liquidation-threshold: liquidation-threshold,
    liquidation-bonus: liquidation-bonus-bps,
    total-liquidations: u0  ;; Can be tracked if needed
  })
)
