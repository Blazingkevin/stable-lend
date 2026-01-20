;; SIP-010 Fungible Token Standard Trait
;; https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md

(define-trait sip-010-trait
  (
    ;; Transfer from the caller to a new principal
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))

    ;; Get the token balance of the specified principal
    (get-balance (principal) (response uint uint))

    ;; Get the total number of tokens in existence
    (get-total-supply () (response uint uint))

    ;; Get the human-readable token name
    (get-name () (response (string-ascii 32) uint))

    ;; Get the ticker symbol
    (get-symbol () (response (string-ascii 32) uint))

    ;; Get the number of decimal places
    (get-decimals () (response uint uint))

    ;; Get the URI containing token metadata
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)
