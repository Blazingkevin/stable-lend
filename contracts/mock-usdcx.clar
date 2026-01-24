;; Mock USDCx Token for Local Testing Only
;; This contract is ONLY used for running tests in Clarinet's simnet
;; For testnet/mainnet, we use the real USDCx contract

(impl-trait .sip-010-trait.sip-010-trait)

(define-fungible-token usdcx-token)

(define-constant contract-owner tx-sender)
(define-constant err-not-authorized (err u401))
(define-constant err-insufficient-balance (err u402))

;; Mint tokens (for testing only)
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-not-authorized)
    (try! (ft-mint? usdcx-token amount recipient))
    (ok true)
  )
)

;; SIP-010 Transfer
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) err-not-authorized)
    (try! (ft-transfer? usdcx-token amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

;; SIP-010 Read-only functions
(define-read-only (get-name)
  (ok "USDCx Mock")
)

(define-read-only (get-symbol)
  (ok "USDCx")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance usdcx-token account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply usdcx-token))
)

(define-read-only (get-token-uri)
  (ok none)
)

