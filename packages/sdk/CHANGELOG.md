# @memeputer/sdk

## 1.5.0

### Minor Changes

- Add Base/EVM wallet support with auto-detection
  - Auto-detect Base wallets from `MEMEPUTER_BASE_WALLET_PRIVATE_KEY` env var, `~/.memeputerrc` config, or `~/.memeputer/base-wallet.json`
  - Automatically switch between Solana and Base wallets based on agent payment requests
  - Add `autoDetectBaseWallet()` utility function
  - Export `BaseWallet` interface

- Implement EIP-3009 authorization format for Base payments
  - Switch from raw transaction format to EIP-3009 `signature` + `authorization` format
  - Enables PayAI facilitator for gasless Base transactions
  - Use EIP-712 typed data signing for authorizations
  - Generate proper nonces for transfer authorizations

- Add Base USDC balance checking
  - Add `getBaseUsdcBalance()` function to check USDC balance on Base network
  - Support both Solana and Base balance queries

- Improve transaction hash handling
  - Compute transaction hash client-side for Base payments
  - Prefer backend-provided transaction signature when valid
  - Fallback to computed hash for Base transactions

- Fix payer address extraction
  - Derive Base wallet address from private key when missing
  - Prevent "unknown" payer addresses in receipts

## 1.4.0

### Minor Changes

- Add multi-chain support for Solana and Base (EVM) chains
  - Add chain parameter to SDK and CLI with auto-detection from environment
  - Update API URL structure to /x402/{chain}/{agentId}
  - Implement EVM payment transaction creation using ethers.js
  - Add wallet generation scripts for both Solana and Base
  - Support MEMEPUTER_CHAIN environment variable
  - Update all tests for multi-chain URL structure

  **Breaking Changes:**
  - API endpoint structure changed from `/x402/interact` to `/x402/{chain}/{agentId}`
  - `interact()` method signature updated to accept `Keypair | any` for multi-chain wallet support

  **Client-side ready:**
  - ✅ Solana payments working in production
  - ✅ Base payment creation implemented (pending backend support)

## 1.3.0

### Minor Changes

- Migrate to unified domain agents.memeputer.com/x402

  BREAKING CHANGE: The default API URL has changed from `agents.api.memeputer.com` to `agents.memeputer.com/x402`. The endpoint structure has also changed - agent IDs are now in the URL path (e.g., `POST /x402/{agentId}`) instead of the request body.

  **For users:**
  - Update your configuration files to use the new domain
  - Environment variable `MEMEPUTER_API_URL` should be set to `https://agents.memeputer.com/x402`
  - Local development now uses `http://localhost:3006/x402`

  **Changes:**
  - Default API URLs updated across SDK and CLI
  - Agent ID now in URL path instead of request body
  - Endpoint paths simplified (no duplicate `/x402` segments)
  - All tests updated to reflect new structure
