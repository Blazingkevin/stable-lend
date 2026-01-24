;; StableLend Pool V4
;; A decentralized lending protocol enabling users to:
;; - Deposit USDCx to earn yield through a share-based system
;; - Borrow USDCx against STX collateral with compound interest
;; - Liquidate undercollateralized positions for profit

;; ============================================
;; CONSTANTS
;; ============================================

(define-constant contract-owner tx-sender)
(define-constant zero-address 'SP000000000000000000002Q6VF78)

;; Interest Rates (basis points: 100 bps = 1%)
(define-constant borrower-annual-rate-bps u800)   ;; 8% APY for borrowers
(define-constant lender-annual-rate-bps u720)     ;; 7.2% max APY for lenders (90% of borrower rate)
(define-constant protocol-fee-bps u1000)          ;; 10% protocol fee on interest

;; Collateralization Parameters
(define-constant collateral-ratio u150)           ;; 150% required collateral
(define-constant liquidation-threshold u120)      ;; 120% triggers liquidation
(define-constant liquidation-bonus-bps u500)      ;; 5% bonus for liquidators

;; Time Constants (Stacks: ~10 min/block)
(define-constant blocks-per-year u52560)
(define-constant blocks-per-day u144)
(define-constant max-loan-duration-blocks u52560) ;; 365 days max loan duration

;; ============================================
;; VAULT SECURITY
;; ============================================

;; Minimum first deposit prevents share inflation attacks
(define-constant minimum-first-deposit u1000000)  ;; 1 USDCx (6 decimals)

;; Dead shares permanently locked to prevent zero-share exploits
(define-constant dead-shares-amount u1000)
(define-constant dead-shares-address 'SP000000000000000000002Q6VF78)

;; ============================================
;; ORACLE CONFIGURATION
;; ============================================

;; Primary: Pyth Network Oracle
(define-constant pyth-oracle-contract 'STR738QQX1PVTM6WTDF833Z18T8R0ZB791TCNEFM.pyth-oracle-v4)
(define-constant pyth-storage-contract 'STR738QQX1PVTM6WTDF833Z18T8R0ZB791TCNEFM.pyth-storage-v4)
(define-constant stx-price-feed-id 0xec7a775f46379b5e943c3526b1c8d54cd49749176b0b98e02dde68d1bd335c17)

;; Fallback: DIA Oracle
(define-constant dia-oracle-contract 'ST1S5ZGRZV5K4S9205RWPRTX9RGS9JV40KQMR4G1J.dia-oracle)
(define-constant stx-price-feed-key "STX/USD")

;; Price precision: 6 decimals (1000000 = $1.00)
(define-constant price-decimals u1000000)

;; Share precision: 8 decimals for high accuracy
(define-constant share-precision u100000000)

;; ============================================
;; ERROR CODES
;; ============================================

(define-constant ERR-NOT-AUTHORIZED u401)
(define-constant ERR-INSUFFICIENT-BALANCE u402)
(define-constant ERR-INSUFFICIENT-COLLATERAL u403)
(define-constant ERR-LOAN-NOT-FOUND u404)
(define-constant ERR-INVALID-AMOUNT u407)
(define-constant ERR-NOT-LIQUIDATABLE u408)
(define-constant ERR-TOO-MANY-LOANS u409)
(define-constant ERR-INVALID-ADDRESS u410)
(define-constant ERR-PROTOCOL-PAUSED u411)
(define-constant ERR-SUPPLY-CAP-EXCEEDED u412)
(define-constant ERR-BORROW-CAP-EXCEEDED u413)
(define-constant ERR-CANNOT-LIQUIDATE-SELF u414)
(define-constant ERR-ZERO-SHARES u415)
(define-constant ERR-ORACLE-FAILURE u416)
(define-constant ERR-REENTRANCY-DETECTED u420)
(define-constant ERR-SAME-BLOCK-INTERACTION u421)
(define-constant ERR-LOAN-NOT-ACTIVE u422)

;; ============================================
;; STATE: LENDER SHARES
;; ============================================

;; Lender share tracking for proportional yield distribution
(define-map lender-shares
  { lender: principal }
  { 
    shares: uint,
    first-deposit-block: uint,
    user-liquidity-index: uint
  }
)

(define-data-var total-shares uint u0)
(define-data-var total-pool-value uint u0)
(define-data-var last-interest-update-block uint u0)

;; Liquidity index tracks cumulative interest for fair distribution
(define-data-var liquidity-index uint u100000000)
(define-constant liquidity-index-precision u100000000)

;; Borrow index tracks cumulative debt growth
(define-data-var variable-borrow-index uint u100000000)
(define-constant variable-borrow-index-precision u100000000)

;; Loan tracking
(define-map loans
  { loan-id: uint }
  {
    borrower: principal,
    collateral-amount: uint,
    borrowed-amount: uint,
    borrow-block: uint,
    last-interest-block: uint,
    accumulated-interest: uint,
    user-borrow-index: uint,
    expiration-block: uint,
    active: bool
  }
)

(define-map borrower-loans
  { borrower: principal }
  { loan-ids: (list 100 uint) }
)

;; Data vars
(define-data-var next-loan-id uint u0)
(define-data-var total-borrowed uint u0)
(define-data-var total-interest-paid uint u0)

;; Statistics
(define-map unique-lenders { lender: principal } { active: bool })
(define-map unique-borrowers { borrower: principal } { active: bool })
(define-data-var total-lenders uint u0)
(define-data-var total-borrowers uint u0)
(define-data-var volume-24h uint u0)
(define-data-var last-volume-reset-block uint u0)

;; Protocol management
(define-data-var protocol-revenue-accumulated uint u0)
(define-data-var protocol-treasury principal contract-owner)
(define-data-var protocol-paused bool false)
(define-data-var supply-cap uint u100000000000)
(define-data-var borrow-cap uint u50000000000)

;; Oracle price state
(define-data-var last-known-stx-price uint u310000)  ;; Default ~$0.31 (6 decimals)
(define-data-var last-price-update-block uint u0)

;; Oracle error codes (used internally)
(define-constant ERR-STALE-PRICE u417)
(define-constant ERR-PYTH-ORACLE-FAILURE u418)
(define-constant ERR-DIA-ORACLE-FAILURE u419)

;; ============================================
;; REENTRANCY & FLASH LOAN PROTECTION
;; ============================================

;; Execution lock for reentrancy protection
(define-data-var execution-lock bool false)

;; User interaction tracking for same-block protection
(define-map user-last-interaction 
  { user: principal } 
  { block: uint }
)

;; ============================================
;; SECURITY HELPERS
;; ============================================

;; Check if user already interacted this block (flash loan protection)
(define-private (has-same-block-interaction (user principal))
  (let ((interaction (map-get? user-last-interaction { user: user })))
    (if (is-some interaction)
      (is-eq (get block (unwrap-panic interaction)) block-height)
      false
    )
  )
)

;; Record user's interaction for same-block protection
(define-private (update-user-interaction (user principal))
  (map-set user-last-interaction 
    { user: user } 
    { block: block-height }
  )
)

;; Acquire reentrancy lock
(define-private (acquire-lock)
  (if (var-get execution-lock)
    false
    (begin
      (var-set execution-lock true)
      true
    )
  )
)

;; Release reentrancy lock
(define-private (release-lock)
  (var-set execution-lock false)
)

;; ============================================
;; HELPER FUNCTIONS
;; ============================================

;; Calculate pool utilization rate (0-10000 basis points)
;; utilization = total_borrowed / total_deposits
(define-private (get-utilization-rate)
  (let (
    (total-pool (var-get total-pool-value))
    (total-borr (var-get total-borrowed))
  )
    (if (is-eq total-pool u0)
      u0
      (/ (* total-borr u10000) total-pool)
    )
  )
)

;; Calculate current value per share
;; share_value = total_pool_value / total_shares
(define-read-only (get-share-value)
  (let (
    (total-pool (var-get total-pool-value))
    (shares (var-get total-shares))
  )
    (if (is-eq shares u0)
      share-precision
      (/ (* total-pool share-precision) shares)
    )
  )
)

;; Calculate shares to mint for deposit amount
;; shares = (deposit * share_precision) / share_value
(define-private (calculate-shares-to-mint (deposit-amount uint))
  (let (
    (share-value (get-share-value))
  )
    (/ (* deposit-amount share-precision) share-value)
  )
)

;; Calculate value of shares using liquidity index for compound interest
;; Lenders earn proportional interest based on when they deposited
(define-private (calculate-value-of-shares-indexed (shares uint) (user-index uint))
  (let (
    (current-index (var-get liquidity-index))
    (share-value (get-share-value))
  )
    (if (is-eq user-index u0)
      (/ (* shares share-value) share-precision)
      (/ (* (* shares current-index) share-value) 
         (* user-index share-precision))
    )
  )
)

;; Accrue pool-wide interest and update global indexes
;; Called before any state-changing operation to ensure accurate accounting
(define-private (accrue-pool-interest)
  (let (
    (blocks-elapsed (- block-height (var-get last-interest-update-block)))
    (current-pool (var-get total-pool-value))
    (current-liquidity-index (var-get liquidity-index))
    (current-borrow-index (var-get variable-borrow-index))
    (utilization (get-utilization-rate))
    (lender-effective-rate-bps (/ (* lender-annual-rate-bps utilization) u10000))
    (borrower-rate-bps borrower-annual-rate-bps)
  )
    (if (is-eq blocks-elapsed u0)
      u0
      (let (
        (lender-rate-per-block-numerator (* lender-effective-rate-bps liquidity-index-precision))
        (rate-per-block-denominator (* u10000 blocks-per-year))
        (lender-interest-multiplier (/ (* (* lender-rate-per-block-numerator blocks-elapsed) current-liquidity-index) 
                                        (* rate-per-block-denominator liquidity-index-precision)))
        (new-liquidity-index (+ current-liquidity-index lender-interest-multiplier))
        (borrower-rate-per-block-numerator (* borrower-rate-bps variable-borrow-index-precision))
        (borrower-interest-multiplier (/ (* (* borrower-rate-per-block-numerator blocks-elapsed) current-borrow-index) 
                                          (* rate-per-block-denominator variable-borrow-index-precision)))
        (new-borrow-index (+ current-borrow-index borrower-interest-multiplier))
        (interest-earned (if (is-eq current-liquidity-index u0)
                            u0
                            (/ (* current-pool (- new-liquidity-index current-liquidity-index)) current-liquidity-index)))
      )
        (begin
          (var-set liquidity-index new-liquidity-index)
          (var-set variable-borrow-index new-borrow-index)
          (var-set total-pool-value (+ current-pool interest-earned))
          (var-set last-interest-update-block block-height)
          interest-earned
        )
      )
    )
  )
)

;; Calculate simple interest for a loan based on elapsed blocks
(define-private (calculate-loan-interest
    (borrowed-amount uint)
    (blocks-elapsed uint))
  (let (
    (interest-numerator (* (* borrowed-amount borrower-annual-rate-bps) blocks-elapsed))
    (interest-denominator (* u10000 blocks-per-year))
  )
    (/ interest-numerator interest-denominator)
  )
)

;; Calculate current debt using borrow index for compound interest
;; debt = (principal * current_index) / user_index
(define-private (calculate-loan-debt (principal uint) (user-borrow-index uint))
  (let (
    (current-borrow-index (var-get variable-borrow-index))
  )
    (if (is-eq user-borrow-index u0)
      principal
      (/ (* principal current-borrow-index) user-borrow-index)
    )
  )
)

;; ============================================
;; ORACLE FUNCTIONS
;; ============================================

;; Get cached STX price in USD (6 decimals)
(define-read-only (get-stx-price-usd)
  (var-get last-known-stx-price)
)

;; Update price from Pyth oracle
;; Pyth returns Unix timestamp for freshness, not block height
;; We validate only that we got a valid positive price
(define-private (update-price-from-pyth)
  (let ((pyth-result (contract-call? 'STR738QQX1PVTM6WTDF833Z18T8R0ZB791TCNEFM.pyth-oracle-v4 get-price stx-price-feed-id 'STR738QQX1PVTM6WTDF833Z18T8R0ZB791TCNEFM.pyth-storage-v4)))
    (if (is-ok pyth-result)
      (let (
        (price-data (unwrap-panic pyth-result))
        (price-value (get price price-data))
        (price-expo (get expo price-data))
        (expo-positive (if (< price-expo 0)
                          (- 0 price-expo) 
                          price-expo))
        (price-denomination (pow u10 (to-uint expo-positive)))
        ;; price is also int128, convert to uint for calculations
        (price-uint (if (< price-value 0) u0 (to-uint price-value)))
        (converted-price (/ (* price-uint price-decimals) price-denomination))
      )
        ;; Validate we got a reasonable price (greater than 0)
        (if (> converted-price u0)
          (begin
            (var-set last-known-stx-price converted-price)
            (var-set last-price-update-block block-height)
            (ok converted-price)
          )
          (err ERR-STALE-PRICE) ;; invalid price
        )
      )
      (err ERR-PYTH-ORACLE-FAILURE) ;; pyth oracle failure
    )
  )
)

;; Update price from DIA oracle
;; DIA returns price with 8 decimals, we convert to 6 decimals
(define-private (update-price-from-dia)
  (let ((dia-result (contract-call? 'ST1S5ZGRZV5K4S9205RWPRTX9RGS9JV40KQMR4G1J.dia-oracle get-value stx-price-feed-key)))
    (if (is-ok dia-result)
      (let (
        (price-data (unwrap-panic dia-result))
        (price-value (get value price-data))
        (converted-price (/ price-value u100))
      )
        (if (> converted-price u0)
          (begin
            (var-set last-known-stx-price converted-price)
            (var-set last-price-update-block block-height)
            (ok converted-price)
          )
          (err ERR-STALE-PRICE)
        )
      )
      (err ERR-DIA-ORACLE-FAILURE)
    )
  )
)

;; Update STX price with oracle fallback chain
;; Priority: Pyth -> DIA -> cached price
(define-private (update-stx-price)
  (let ((pyth-result (update-price-from-pyth)))
    (if (is-ok pyth-result)
      (unwrap-panic pyth-result)
      (let ((dia-result (update-price-from-dia)))
        (if (is-ok dia-result)
          (unwrap-panic dia-result)
          (var-get last-known-stx-price)
        )
      )
    )
  )
)

;; Calculate collateral value in USD (6 decimals)
(define-private (calculate-collateral-value (stx-amount uint))
  (let ((stx-price (var-get last-known-stx-price)))
    (/ (* stx-amount stx-price) price-decimals)
  )
)

;; Calculate health factor for a loan (collateral value / debt * 100)
;; Health factor < 150 means the loan is undercollateralized
(define-read-only (get-health-factor (loan-id uint))
  (let ((loan-entry (map-get? loans { loan-id: loan-id })))
    (if (is-some loan-entry)
      (let (
        (loan (unwrap-panic loan-entry))
        (stx-price (get-stx-price-usd))
        (collateral-value-usd (/ (* (get collateral-amount loan) stx-price) price-decimals))
        (principal-amount (get borrowed-amount loan))
        (user-borrow-index (get user-borrow-index loan))
        (total-debt (calculate-loan-debt principal-amount user-borrow-index))
      )
        (ok (if (is-eq total-debt u0)
          u0
          (/ (* collateral-value-usd u100) total-debt)
        ))
      )
      (err ERR-LOAN-NOT-FOUND)
    )
  )
)

;; ============================================
;; PUBLIC FUNCTIONS - LENDING
;; ============================================

;; Deposit USDCx into the pool and receive proportional shares
;; Shares entitle lenders to pool value growth from interest
(define-public (deposit (amount uint))
  (begin
    ;; Security checks
    (asserts! (acquire-lock) (err ERR-REENTRANCY-DETECTED))
    (asserts! (not (has-same-block-interaction tx-sender)) (err ERR-SAME-BLOCK-INTERACTION))
    
    ;; Validate
    (asserts! (not (var-get protocol-paused)) (err ERR-PROTOCOL-PAUSED))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (not (is-eq tx-sender zero-address)) (err ERR-INVALID-ADDRESS))
    
    ;; Enforce minimum first deposit
    (let ((current-total-shares (var-get total-shares)))
      (if (is-eq current-total-shares u0)
        (asserts! (>= amount minimum-first-deposit) (err ERR-INVALID-AMOUNT))
        true
      )
    )
    
    (accrue-pool-interest)
    
    (let (
      (current-pool (var-get total-pool-value))
      (new-pool (+ current-pool amount))
      (shares-to-mint (calculate-shares-to-mint amount))
      (current-liquidity-index (var-get liquidity-index))
      (current-total-shares (var-get total-shares))
      (is-first-deposit (is-eq current-total-shares u0))
      (current-user-shares (default-to 
        { shares: u0, first-deposit-block: block-height, user-liquidity-index: current-liquidity-index }
        (map-get? lender-shares { lender: tx-sender })
      ))
    )
      (asserts! (<= new-pool (var-get supply-cap)) (err ERR-SUPPLY-CAP-EXCEEDED))
      (asserts! (> shares-to-mint u0) (err ERR-ZERO-SHARES))
      
      (try! (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
        transfer amount tx-sender (as-contract tx-sender) none))
      
      ;; Lock dead shares on first deposit
      (let (
        (shares-for-user (if is-first-deposit
                            (- shares-to-mint dead-shares-amount)
                            shares-to-mint))
        (total-shares-to-add shares-to-mint)
      )
        (var-set total-pool-value new-pool)
        (var-set total-shares (+ (var-get total-shares) total-shares-to-add))
        
        (if is-first-deposit
          (map-set lender-shares
            { lender: dead-shares-address }
            {
              shares: dead-shares-amount,
              first-deposit-block: block-height,
              user-liquidity-index: current-liquidity-index
            }
          )
          true
        )
        
        ;; Update user shares with weighted average index
        (let (
          (old-shares (get shares current-user-shares))
          (old-index (get user-liquidity-index current-user-shares))
          (new-total-shares (+ old-shares shares-for-user))
          (weighted-index (if (is-eq new-total-shares u0)
                             current-liquidity-index
                             (/ (+ (* old-shares old-index) 
                                   (* shares-for-user current-liquidity-index))
                                new-total-shares)))
        )
          (map-set lender-shares
            { lender: tx-sender }
            {
              shares: new-total-shares,
              first-deposit-block: (get first-deposit-block current-user-shares),
              user-liquidity-index: weighted-index
            }
          )
        )
      )
      
      (if (is-none (map-get? unique-lenders { lender: tx-sender }))
        (begin
          (map-set unique-lenders { lender: tx-sender } { active: true })
          (var-set total-lenders (+ (var-get total-lenders) u1))
        )
        true
      )
      
      ;; Update 24h volume
      (let ((last-reset (var-get last-volume-reset-block)))
        (if (>= (- block-height last-reset) blocks-per-day)
          (begin
            (var-set volume-24h amount)
            (var-set last-volume-reset-block block-height)
          )
          (var-set volume-24h (+ (var-get volume-24h) amount))
        )
      )
      
      (update-user-interaction tx-sender)
      (release-lock)
      
      (print {
        event: "deposit",
        lender: tx-sender,
        amount: amount,
        shares-minted: shares-to-mint,
        share-value: (get-share-value),
        block: block-height
      })
      
      (ok { amount: amount, shares: shares-to-mint })
    )
  )
)

;; Withdraw USDCx by burning shares
;; Amount received includes proportional interest earned
(define-public (withdraw (shares-to-burn uint))
  (let ((lender tx-sender))
    (begin
      ;; Security checks
      (asserts! (acquire-lock) (err ERR-REENTRANCY-DETECTED))
      (asserts! (not (has-same-block-interaction lender)) (err ERR-SAME-BLOCK-INTERACTION))
      
      (asserts! (not (var-get protocol-paused)) (err ERR-PROTOCOL-PAUSED))
      (asserts! (> shares-to-burn u0) (err ERR-ZERO-SHARES))
      
      (accrue-pool-interest)
      
      (let (
        (user-shares-data (unwrap! 
          (map-get? lender-shares { lender: lender })
          (err ERR-NOT-AUTHORIZED)))
        (user-total-shares (get shares user-shares-data))
        (user-index (get user-liquidity-index user-shares-data))
        (amount-to-withdraw (calculate-value-of-shares-indexed shares-to-burn user-index))
        (current-pool (var-get total-pool-value))
        (available-liquidity (- current-pool (var-get total-borrowed)))
      )
        (asserts! (<= shares-to-burn user-total-shares) (err ERR-INSUFFICIENT-BALANCE))
        (asserts! (<= amount-to-withdraw available-liquidity) (err ERR-INSUFFICIENT-BALANCE))
        
        (var-set total-pool-value (- current-pool amount-to-withdraw))
        (var-set total-shares (- (var-get total-shares) shares-to-burn))
        
        (let ((remaining-shares (- user-total-shares shares-to-burn)))
          (if (is-eq remaining-shares u0)
            (begin
              (map-delete lender-shares { lender: lender })
              (let ((lender-entry (map-get? unique-lenders { lender: lender })))
                (if (is-some lender-entry)
                  (if (get active (unwrap-panic lender-entry))
                    (begin
                      (map-set unique-lenders { lender: lender } { active: false })
                      (var-set total-lenders (- (var-get total-lenders) u1))
                      true
                    )
                    true
                  )
                  true
                )
              )
            )
            (begin
              (map-set lender-shares
                { lender: lender }
                (merge user-shares-data { shares: remaining-shares })
              )
              true
            )
          )
        )
        
        (try! (as-contract (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
          transfer amount-to-withdraw tx-sender lender none)))
        
        (update-user-interaction lender)
        (release-lock)
        
        (print {
          event: "withdraw",
          lender: lender,
          amount: amount-to-withdraw,
          shares-burned: shares-to-burn,
          share-value: (get-share-value),
          block: block-height
        })
        
        (ok amount-to-withdraw)
      )
    )
  )
)

;; ============================================
;; PUBLIC FUNCTIONS - BORROWING
;; ============================================

;; Borrow USDCx against STX collateral
;; Requires 150% collateralization ratio to protect lenders
(define-public (borrow (amount uint) (collateral-stx uint))
  (let ((borrower tx-sender))
    (begin
      ;; Security checks
      (asserts! (acquire-lock) (err ERR-REENTRANCY-DETECTED))
      (asserts! (not (has-same-block-interaction borrower)) (err ERR-SAME-BLOCK-INTERACTION))
      
      (asserts! (not (var-get protocol-paused)) (err ERR-PROTOCOL-PAUSED))
      (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
      (asserts! (> collateral-stx u0) (err ERR-INVALID-AMOUNT))
      (asserts! (not (is-eq borrower zero-address)) (err ERR-INVALID-ADDRESS))
      
      (accrue-pool-interest)
      (update-stx-price)
      
      (let (
        (current-pool (var-get total-pool-value))
        (current-borrowed (var-get total-borrowed))
        (available-liquidity (- current-pool current-borrowed))
        (collateral-value (calculate-collateral-value collateral-stx))
        (required-collateral (/ (* amount collateral-ratio) u100))
        (loan-id (var-get next-loan-id))
      )
        (asserts! (>= collateral-value required-collateral) (err ERR-INSUFFICIENT-COLLATERAL))
        (asserts! (<= amount available-liquidity) (err ERR-INSUFFICIENT-BALANCE))
        (asserts! (<= (+ current-borrowed amount) (var-get borrow-cap)) (err ERR-BORROW-CAP-EXCEEDED))
        
        (try! (stx-transfer? collateral-stx borrower (as-contract tx-sender)))
        
        (map-set loans
          { loan-id: loan-id }
          {
            borrower: borrower,
            collateral-amount: collateral-stx,
            borrowed-amount: amount,
            borrow-block: block-height,
            last-interest-block: block-height,
            accumulated-interest: u0,
            user-borrow-index: (var-get variable-borrow-index),
            expiration-block: (+ block-height max-loan-duration-blocks),
            active: true
          }
        )
        
        (var-set next-loan-id (+ loan-id u1))
        (var-set total-borrowed (+ current-borrowed amount))
        
        (try! (add-loan-to-borrower borrower loan-id))
        
        (if (is-none (map-get? unique-borrowers { borrower: borrower }))
          (begin
            (map-set unique-borrowers { borrower: borrower } { active: true })
            (var-set total-borrowers (+ (var-get total-borrowers) u1))
          )
          true
        )
        
        ;; Transfer borrowed amount from contract to borrower
        (try! (as-contract (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
          transfer amount tx-sender borrower none)))
        
        (update-user-interaction borrower)
        (release-lock)
        
        (print {
          event: "borrow",
          loan-id: loan-id,
          borrower: borrower,
          amount: amount,
          collateral-stx: collateral-stx,
          block: block-height
        })
        
        (ok loan-id)
      )
    )
  )
)

;; Add more STX collateral to an existing loan
;; Helps borrowers avoid liquidation by improving their health factor
(define-public (add-collateral (loan-id uint) (additional-stx uint))
  (begin
    ;; Security checks
    (asserts! (acquire-lock) (err ERR-REENTRANCY-DETECTED))
    (asserts! (not (has-same-block-interaction tx-sender)) (err ERR-SAME-BLOCK-INTERACTION))
    
    (asserts! (not (var-get protocol-paused)) (err ERR-PROTOCOL-PAUSED))
    (asserts! (> additional-stx u0) (err ERR-INVALID-AMOUNT))
    
    (let (
      (loan-data (unwrap! (map-get? loans { loan-id: loan-id }) (err ERR-LOAN-NOT-FOUND)))
      (current-collateral (get collateral-amount loan-data))
      (new-collateral (+ current-collateral additional-stx))
    )
      ;; Only loan owner can add collateral
      (asserts! (is-eq tx-sender (get borrower loan-data)) (err ERR-NOT-AUTHORIZED))
      ;; Loan must be active
      (asserts! (get active loan-data) (err ERR-LOAN-NOT-FOUND))
      
      ;; Transfer additional STX from borrower to contract
      (try! (stx-transfer? additional-stx tx-sender (as-contract tx-sender)))
      
      ;; Update loan with new collateral amount
      (map-set loans
        { loan-id: loan-id }
        (merge loan-data { collateral-amount: new-collateral })
      )
      
      (update-user-interaction tx-sender)
      (release-lock)
      
      (print {
        event: "add-collateral",
        loan-id: loan-id,
        borrower: tx-sender,
        additional-stx: additional-stx,
        old-collateral: current-collateral,
        new-collateral: new-collateral,
        block: block-height
      })
      
      (ok new-collateral)
    )
  )
)

;; Repay loan fully and unlock all collateral
;; Interest is split: 90% to lenders, 10% protocol fee
(define-public (repay (loan-id uint))
  (begin
    ;; Security checks
    (asserts! (acquire-lock) (err ERR-REENTRANCY-DETECTED))
    (asserts! (not (has-same-block-interaction tx-sender)) (err ERR-SAME-BLOCK-INTERACTION))
    
    (accrue-pool-interest)
    
    (let (
      (loan-data (unwrap! (map-get? loans { loan-id: loan-id }) (err ERR-LOAN-NOT-FOUND)))
      (principal-amount (get borrowed-amount loan-data))
      (user-borrow-index (get user-borrow-index loan-data))
      
      ;; Calculate current debt using borrow index (compound interest)
      (current-debt (calculate-loan-debt principal-amount user-borrow-index))
      (total-interest (- current-debt principal-amount))
      
      ;; Split interest: 90% to lenders (pool), 10% to protocol
      (protocol-fee (/ (* total-interest protocol-fee-bps) u10000))
      (lender-share (- total-interest protocol-fee))
    )
      ;; Validate
      (asserts! (not (var-get protocol-paused)) (err ERR-PROTOCOL-PAUSED))
      (asserts! (is-eq tx-sender (get borrower loan-data)) (err ERR-NOT-AUTHORIZED))
      (asserts! (get active loan-data) (err ERR-LOAN-NOT-FOUND))
      
      ;; Mark loan as inactive
      (map-set loans
        { loan-id: loan-id }
        (merge loan-data { active: false })
      )
      
      ;; Update global state
      (var-set total-borrowed (- (var-get total-borrowed) principal-amount))
      (var-set total-interest-paid (+ (var-get total-interest-paid) total-interest))
      (var-set protocol-revenue-accumulated (+ (var-get protocol-revenue-accumulated) protocol-fee))
      
      ;; Add lender's share to pool (increases share value for all lenders)
      (var-set total-pool-value (+ (var-get total-pool-value) lender-share))
      
      ;; Transfer repayment from borrower
      (try! (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
        transfer current-debt tx-sender (as-contract tx-sender) none))
      
      ;; Return collateral to borrower
      (try! (as-contract (stx-transfer? (get collateral-amount loan-data) tx-sender (get borrower loan-data))))
      
      ;; Check if borrower has any other active loans
      (if (not (has-active-loans tx-sender))
        ;; No more active loans - decrement borrower count
        (let ((borrower-entry (map-get? unique-borrowers { borrower: tx-sender })))
          (if (is-some borrower-entry)
            (if (get active (unwrap-panic borrower-entry))
              (begin
                (map-set unique-borrowers { borrower: tx-sender } { active: false })
                (var-set total-borrowers (- (var-get total-borrowers) u1))
                true
              )
              true
            )
            true
          )
        )
        true  ;; Still has active loans
      )
      
      ;; Update user interaction and release lock
      (update-user-interaction tx-sender)
      (release-lock)
      
      (print {
        event: "repay",
        loan-id: loan-id,
        borrower: tx-sender,
        principal: principal-amount,
        repaid-amount: current-debt,
        total-interest: total-interest,
        protocol-fee: protocol-fee,
        lender-share: lender-share,
        borrow-index: user-borrow-index,
        current-borrow-index: (var-get variable-borrow-index),
        new-share-value: (get-share-value),
        block: block-height
      })
      
      (ok current-debt)
    )
  )
)

;; Repay partial amount toward loan
;; Payment applies to interest first, then principal
(define-public (repay-partial (loan-id uint) (repay-amount uint))
  (begin
    ;; Security checks
    (asserts! (acquire-lock) (err ERR-REENTRANCY-DETECTED))
    (asserts! (not (has-same-block-interaction tx-sender)) (err ERR-SAME-BLOCK-INTERACTION))
    
    (accrue-pool-interest)
    
    (let (
      (loan-data (unwrap! (map-get? loans { loan-id: loan-id }) (err ERR-LOAN-NOT-FOUND)))
      (principal-amount (get borrowed-amount loan-data))
      (user-borrow-index (get user-borrow-index loan-data))
      (current-debt (calculate-loan-debt principal-amount user-borrow-index))
      (actual-repay-amount (if (<= repay-amount current-debt)
                             repay-amount
                             current-debt))
      (total-interest-owed (- current-debt principal-amount))
      (interest-repaid (if (<= actual-repay-amount total-interest-owed)
                         actual-repay-amount
                         total-interest-owed))
      (principal-repaid (- actual-repay-amount interest-repaid))
      (protocol-fee (/ (* interest-repaid protocol-fee-bps) u10000))
      (lender-share (- interest-repaid protocol-fee))
      (new-principal (- principal-amount principal-repaid))
    )
      (asserts! (not (var-get protocol-paused)) (err ERR-PROTOCOL-PAUSED))
      (asserts! (is-eq tx-sender (get borrower loan-data)) (err ERR-NOT-AUTHORIZED))
      (asserts! (get active loan-data) (err ERR-LOAN-NOT-FOUND))
      (asserts! (> actual-repay-amount u0) (err ERR-INVALID-AMOUNT))
      (asserts! (> new-principal u0) (err ERR-INVALID-AMOUNT))
      
      (map-set loans
        { loan-id: loan-id }
        (merge loan-data { 
          borrowed-amount: new-principal,
          user-borrow-index: (var-get variable-borrow-index)
        })
      )
      
      (var-set total-borrowed (- (var-get total-borrowed) principal-repaid))
      (var-set total-interest-paid (+ (var-get total-interest-paid) interest-repaid))
      (var-set protocol-revenue-accumulated (+ (var-get protocol-revenue-accumulated) protocol-fee))
      (var-set total-pool-value (+ (var-get total-pool-value) lender-share))
      
      (try! (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
        transfer actual-repay-amount tx-sender (as-contract tx-sender) none))
      
      (update-user-interaction tx-sender)
      (release-lock)
      
      (print {
        event: "repay-partial",
        loan-id: loan-id,
        borrower: tx-sender,
        repay-amount: actual-repay-amount,
        interest-repaid: interest-repaid,
        principal-repaid: principal-repaid,
        protocol-fee: protocol-fee,
        lender-share: lender-share,
        old-principal: principal-amount,
        new-principal: new-principal,
        remaining-debt: (calculate-loan-debt new-principal (var-get variable-borrow-index)),
        borrow-index: (var-get variable-borrow-index),
        new-share-value: (get-share-value),
        block: block-height
      })
      
      (ok actual-repay-amount)
    )
  )
)

;; ============================================
;; PUBLIC FUNCTIONS - LIQUIDATION
;; ============================================

;; Liquidate an undercollateralized or expired loan
;; Liquidator pays debt, receives collateral + bonus
;; Loans can be liquidated if: health factor < 150% OR loan expired
(define-public (liquidate (loan-id uint))
  (let (
    ;; Capture liquidator address BEFORE any as-contract calls
    (liquidator tx-sender)
  )
    (begin
      ;; Security checks
      (asserts! (acquire-lock) (err ERR-REENTRANCY-DETECTED))
      (asserts! (not (has-same-block-interaction liquidator)) (err ERR-SAME-BLOCK-INTERACTION))
      
      (accrue-pool-interest)
      (update-stx-price)
      
      (let (
        (loan-data (unwrap! (map-get? loans { loan-id: loan-id }) (err ERR-LOAN-NOT-FOUND)))
        (principal-amount (get borrowed-amount loan-data))
        (user-borrow-index (get user-borrow-index loan-data))
        (total-debt (calculate-loan-debt principal-amount user-borrow-index))
        (total-interest (- total-debt principal-amount))
        (stx-price (get-stx-price-usd))
        (collateral-value (calculate-collateral-value (get collateral-amount loan-data)))
        (health-factor (if (is-eq total-debt u0) 
                          u0 
                          (/ (* collateral-value u100) total-debt)))
        (liquidation-bonus (/ (* total-debt liquidation-bonus-bps) u10000))
        (liquidator-payout (+ total-debt liquidation-bonus))
        (stx-to-liquidator (/ (* liquidator-payout price-decimals) stx-price))
        (remaining-collateral (if (> (get collateral-amount loan-data) stx-to-liquidator)
                                (- (get collateral-amount loan-data) stx-to-liquidator)
                                u0))
        (protocol-fee (/ (* total-interest protocol-fee-bps) u10000))
        (lender-share (- total-interest protocol-fee))
      )
        (asserts! (not (var-get protocol-paused)) (err ERR-PROTOCOL-PAUSED))
        (asserts! (get active loan-data) (err ERR-LOAN-NOT-FOUND))
        
        ;; Check if loan is expired or undercollateralized
        (let ((is-expired (>= block-height (get expiration-block loan-data))))
          (asserts! 
            (or is-expired (< health-factor liquidation-threshold))
            (err ERR-NOT-LIQUIDATABLE))
        )
        
        (asserts! (not (is-eq liquidator (get borrower loan-data))) (err ERR-CANNOT-LIQUIDATE-SELF))
        (asserts! (>= collateral-value liquidator-payout) (err ERR-INSUFFICIENT-COLLATERAL))
        
        (map-set loans
          { loan-id: loan-id }
          (merge loan-data { active: false })
        )
        
        (var-set total-borrowed (- (var-get total-borrowed) (get borrowed-amount loan-data)))
        (var-set total-interest-paid (+ (var-get total-interest-paid) total-interest))
        (var-set protocol-revenue-accumulated (+ (var-get protocol-revenue-accumulated) protocol-fee))
        (var-set total-pool-value (+ (var-get total-pool-value) lender-share))
        
        ;; Liquidator pays the debt
        (try! (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
          transfer total-debt liquidator (as-contract tx-sender) none))
        
        ;; Transfer collateral TO the liquidator (not tx-sender which would be contract inside as-contract)
        (try! (as-contract (stx-transfer? stx-to-liquidator tx-sender liquidator)))
        
        ;; Send remaining collateral to protocol treasury
        (if (> remaining-collateral u0)
          (try! (as-contract (stx-transfer? remaining-collateral tx-sender (var-get protocol-treasury))))
          true
        )
        
        (update-user-interaction liquidator)
        (release-lock)
        
        (print {
          event: "liquidate",
          loan-id: loan-id,
          liquidator: liquidator,
          borrower: (get borrower loan-data),
          debt-repaid: total-debt,
          collateral-seized: stx-to-liquidator,
          liquidation-bonus: liquidation-bonus,
          health-factor: health-factor,
          lender-share: lender-share,
          protocol-fee: protocol-fee,
          block: block-height
        })
        
        (ok { 
          debt-repaid: total-debt,
          collateral-seized: stx-to-liquidator,
          bonus-earned: liquidation-bonus
        })
      )
    )
  )
)

;; ============================================
;; ADMIN FUNCTIONS
;; ============================================

;; Pause or unpause the protocol (emergency control)
(define-public (set-protocol-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err ERR-NOT-AUTHORIZED))
    (var-set protocol-paused paused)
    (print {
      event: "protocol-pause-updated",
      paused: paused,
      admin: tx-sender,
      block: block-height
    })
    (ok paused)
  )
)

;; Update protocol treasury address for fee collection
(define-public (set-protocol-treasury (new-treasury principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-treasury zero-address)) (err ERR-INVALID-ADDRESS))
    (let ((old-treasury (var-get protocol-treasury)))
      (var-set protocol-treasury new-treasury)
      (print {
        event: "treasury-updated",
        old-treasury: old-treasury,
        new-treasury: new-treasury,
        admin: tx-sender,
        block: block-height
      })
      (ok new-treasury)
    )
  )
)

;; Update maximum total deposits allowed
(define-public (set-supply-cap (new-cap uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-cap u0) (err ERR-INVALID-AMOUNT))
    (let ((old-cap (var-get supply-cap)))
      (var-set supply-cap new-cap)
      (print {
        event: "supply-cap-updated",
        old-cap: old-cap,
        new-cap: new-cap,
        admin: tx-sender,
        block: block-height
      })
      (ok new-cap)
    )
  )
)

;; Update maximum total borrows allowed
(define-public (set-borrow-cap (new-cap uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-cap u0) (err ERR-INVALID-AMOUNT))
    (let ((old-cap (var-get borrow-cap)))
      (var-set borrow-cap new-cap)
      (print {
        event: "borrow-cap-updated",
        old-cap: old-cap,
        new-cap: new-cap,
        admin: tx-sender,
        block: block-height
      })
      (ok new-cap)
    )
  )
)

;; Withdraw accumulated protocol fees to treasury
(define-public (withdraw-protocol-revenue)
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err ERR-NOT-AUTHORIZED))
    (let (
      (revenue (var-get protocol-revenue-accumulated))
      (treasury (var-get protocol-treasury))
    )
      (asserts! (> revenue u0) (err ERR-INVALID-AMOUNT))
      
      ;; Reset revenue counter
      (var-set protocol-revenue-accumulated u0)
      
      ;; Transfer revenue to treasury
      (try! (as-contract (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx
        transfer revenue tx-sender treasury none)))
      
      (print {
        event: "protocol-revenue-withdrawn",
        amount: revenue,
        treasury: treasury,
        admin: tx-sender,
        block: block-height
      })
      
      (ok revenue)
    )
  )
)

;; Emergency: manually set STX price if both oracles fail
(define-public (set-emergency-stx-price (price uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err ERR-NOT-AUTHORIZED))
    (asserts! (> price u0) (err ERR-INVALID-AMOUNT))
    (let ((old-price (var-get last-known-stx-price)))
      (var-set last-known-stx-price price)
      (var-set last-price-update-block block-height)
      (print {
        event: "emergency-price-updated",
        old-price: old-price,
        new-price: price,
        admin: tx-sender,
        block: block-height,
        warning: "EMERGENCY: Manual price override - both oracles may be failing"
      })
      (ok price)
    )
  )
)

;; Get admin dashboard statistics (owner only)
(define-read-only (get-admin-stats)
  (if (is-eq tx-sender contract-owner)
    (ok {
      protocol-paused: (var-get protocol-paused),
      supply-cap: (var-get supply-cap),
      protocol-treasury: (var-get protocol-treasury),
      protocol-revenue: (var-get protocol-revenue-accumulated),
      total-pool-value: (var-get total-pool-value),
      total-borrowed: (var-get total-borrowed),
      utilization-rate: (get-utilization-rate),
      liquidity-index: (var-get liquidity-index),
      borrow-index: (var-get variable-borrow-index),
      last-known-stx-price: (var-get last-known-stx-price),
      last-price-update: (var-get last-price-update-block),
      total-lenders: (var-get total-lenders),
      total-borrowers: (var-get total-borrowers),
      total-shares: (var-get total-shares),
      share-value: (get-share-value)
    })
    (err ERR-NOT-AUTHORIZED)
  )
)

;; ============================================
;; READ-ONLY FUNCTIONS
;; ============================================

;; Check if loan has exceeded maximum duration
(define-read-only (is-loan-expired (loan-id uint))
  (let ((loan (map-get? loans { loan-id: loan-id })))
    (if (is-some loan)
      (ok (>= block-height (get expiration-block (unwrap-panic loan))))
      (err ERR-LOAN-NOT-FOUND)
    )
  )
)

;; Get lender's current balance and share information
(define-read-only (get-lender-balance (lender principal))
  (let ((shares-entry (map-get? lender-shares { lender: lender })))
    (if (is-some shares-entry)
      (let (
        (shares-data (unwrap-panic shares-entry))
        (user-shares (get shares shares-data))
        (share-value (get-share-value))
        (user-index (get user-liquidity-index shares-data))
        (balance (calculate-value-of-shares-indexed user-shares user-index))
      )
        (ok {
          shares: user-shares,
          balance: balance,
          share-value: share-value,
          first-deposit-block: (get first-deposit-block shares-data)
        })
      )
      (err ERR-NOT-AUTHORIZED)
    )
  )
)

;; Get protocol-wide statistics for dashboard display
(define-read-only (get-protocol-stats)
  (ok {
    total-deposits: (var-get total-pool-value),
    total-borrowed: (var-get total-borrowed),
    total-interest-paid: (var-get total-interest-paid),
    protocol-revenue: (var-get protocol-revenue-accumulated),
    utilization-rate: (get-utilization-rate),
    total-shares: (var-get total-shares),
    share-value: (get-share-value),
    liquidity-index: (var-get liquidity-index),
    variable-borrow-index: (var-get variable-borrow-index),
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

;; Get complete loan details including calculated debt
(define-read-only (get-loan-details (loan-id uint))
  (let ((loan-entry (map-get? loans { loan-id: loan-id })))
    (if (is-some loan-entry)
      (let (
        (loan-data (unwrap-panic loan-entry))
        (principal-amount (get borrowed-amount loan-data))
        (user-borrow-index (get user-borrow-index loan-data))
        ;; Calculate current debt using borrow index
        (total-debt (calculate-loan-debt principal-amount user-borrow-index))
        (interest-owed (- total-debt principal-amount))
        (health-factor-result (get-health-factor loan-id))
        (health-factor (if (is-ok health-factor-result) (unwrap-panic health-factor-result) u0))
        (expiration-block (get expiration-block loan-data))
        (is-expired (>= block-height expiration-block))
        (blocks-until-expiration (if is-expired u0 (- expiration-block block-height)))
      )
        (ok {
          borrower: (get borrower loan-data),
          collateral-stx: (get collateral-amount loan-data),
          borrowed-amount: principal-amount,
          interest-owed: interest-owed,
          total-debt: total-debt,
          health-factor: health-factor,
          active: (get active loan-data),
          borrow-block: (get borrow-block loan-data),
          user-borrow-index: user-borrow-index,
          current-borrow-index: (var-get variable-borrow-index),
          expiration-block: expiration-block,
          is-expired: is-expired,
          blocks-until-expiration: blocks-until-expiration,
          is-liquidatable: (or (< health-factor liquidation-threshold) is-expired)
        })
      )
      (err ERR-LOAN-NOT-FOUND)
    )
  )
)

;; Get all loan IDs for a borrower
(define-read-only (get-borrower-loans (borrower principal))
  (ok (default-to 
    { loan-ids: (list) } 
    (map-get? borrower-loans { borrower: borrower })
  ))
)

;; Calculate user's actual balance using liquidity index
;; Ensures fair distribution: users earn interest proportional to deposit duration
(define-private (calculate-user-balance (user-shares uint) (user-index uint))
  (let (
    (current-index (var-get liquidity-index))
  )
    ;; actual_balance = (shares * current_index) / user_index
    ;; This gives the user their principal + interest earned since their deposit
    (if (is-eq user-index u0)
      u0  ;; Safety: prevent division by zero
      (/ (* user-shares current-index) user-index)
    )
  )
)

;; Get user's current balance in USDCx
(define-read-only (get-user-balance (user principal))
  (let ((lender-entry (map-get? lender-shares { lender: user })))
    (if (is-some lender-entry)
      (let (
        (user-data (unwrap-panic lender-entry))
        (shares (get shares user-data))
        (user-index (get user-liquidity-index user-data))
      )
        (ok (calculate-user-balance shares user-index))
      )
      (ok u0)
    )
  )
)

;; Check if borrower has any active (non-repaid) loans
(define-private (has-active-loans (borrower principal))
  (let ((borrower-entry (map-get? borrower-loans { borrower: borrower })))
    (if (is-some borrower-entry)
      (let ((loan-ids (get loan-ids (unwrap-panic borrower-entry))))
        (fold check-loan-active loan-ids false)
      )
      false
    )
  )
)

;; Fold helper: returns true if any loan in list is active
(define-private (check-loan-active (loan-id uint) (found-active bool))
  (if found-active
    true
    (let ((loan (map-get? loans { loan-id: loan-id })))
      (if (is-some loan)
        (get active (unwrap-panic loan))
        false
      )
    )
  )
)

;; Add loan ID to borrower's loan history (max 100 loans)
(define-private (add-loan-to-borrower (borrower principal) (loan-id uint))
  (let (
    (current-loans (default-to { loan-ids: (list) } (map-get? borrower-loans { borrower: borrower })))
    (loan-ids (get loan-ids current-loans))
    (new-loan-ids (as-max-len? (append loan-ids loan-id) u100))
  )
    (if (is-some new-loan-ids)
      (begin
        (map-set borrower-loans
          { borrower: borrower }
          { loan-ids: (unwrap-panic new-loan-ids) }
        )
        (ok true)
      )
      (err ERR-TOO-MANY-LOANS)
    )
  )
)
