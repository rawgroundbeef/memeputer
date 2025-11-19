# memeputer

## 1.5.0

### Minor Changes

- Updated dependencies
  - @memeputer/sdk@1.6.0

  **Improvements:**
  - Fixed double `/x402` prefix issue in resource URLs
  - Added URL construction debug logging
  - Improved error handling for agent requests
  - Support for `discover_trends` command

## 1.4.0

### Minor Changes

- Updated dependencies
  - @memeputer/sdk@1.5.0

  **New Features:**
  - Base/EVM wallet support with auto-detection
  - EIP-3009 payment format for gasless Base transactions
  - Base USDC balance checking
  - Improved transaction hash and payer address handling

## 1.3.0

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

### Patch Changes

- Updated dependencies
  - @memeputer/sdk@1.4.0

## 1.2.0

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

### Patch Changes

- Updated dependencies
  - @memeputer/sdk@1.3.0
