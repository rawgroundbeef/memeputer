---
"@memeputer/sdk": patch
---

Fix EIP-3009 authorization clock skew and Solana fee payer

- Add 60-second buffer to validAfter timestamp to account for blockchain clock skew
- Use fee payer address from 402 response instead of hardcoded value
- Update fallback fee payer to correct address (561oabzy81vXYYbs1ZHR1bvpiEr6Nbfd6PGTxPshoz4p)

