;; Mock USDCx Token (SIP-010 Fungible Token)
;; For testing purposes only - simulates the real USDCx token

(impl-trait .sip-010-trait.sip-010-trait)

(define-fungible-token usdcx)

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))

;; SIP-010 Functions

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) err-not-token-owner)
    (try! (ft-transfer? usdcx amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-read-only (get-name)
  (ok "Mock USDCx")
)

(define-read-only (get-symbol)
  (ok "USDCx")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-balance (who principal))
  (ok (ft-get-balance usdcx who))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply usdcx))
)

(define-read-only (get-token-uri)
  (ok (some u"https://example.com/usdcx"))
)

;; Mint function for testing
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ft-mint? usdcx amount recipient)
  )
)

