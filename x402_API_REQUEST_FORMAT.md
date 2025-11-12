# x402 Agent API Request Format

## Overview

The SDK implements the x402 protocol for agent interactions. Here's what the HTTP request flow looks like:

## Request Flow

### Step 1: Initial Request (without payment)

**POST** `${apiBase}/x402/interact`

**Headers:**
```
Content-Type: application/json
User-Agent: @memeputer/sdk
```

**Body:**
```json
{
  "agentId": "memeputer",
  "message": "/ping"
}
```

**Expected Response:** `402 Payment Required`

**Response Body (402):**
```json
{
  "accepts": [
    {
      "payTo": "<agent-wallet-address>",
      "maxAmountRequired": 10000,  // micro-USDC (0.01 USDC)
      "scheme": "exact",
      "network": "solana",
      "extra": {
        "agentId": "memeputer",
        "agentName": "Memeputer",
        ...
      }
    }
  ],
  "x402Version": 1
}
```

### Step 2: Create Payment Transaction

The SDK creates a Solana USDC transfer transaction:
- **From:** User's wallet
- **To:** `payTo` address from 402 response
- **Amount:** `maxAmountRequired` (in micro-USDC)
- **Fee Payer:** Facilitator wallet (`2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4`)
- **Format:** VersionedTransaction (base64 encoded)

### Step 3: Retry Request (with payment)

**POST** `${apiBase}/x402/interact`

**Headers:**
```
Content-Type: application/json
X-PAYMENT: <base64-encoded-payment-payload>
User-Agent: @memeputer/sdk
```

**X-PAYMENT Header Format:**
```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "solana",
  "payload": {
    "transaction": "<base64-encoded-versioned-transaction>",
    "signature": "<bs58-encoded-user-signature>"
  }
}
```
(Then base64-encoded as a string)

**Body:** (same as Step 1)
```json
{
  "agentId": "memeputer",
  "message": "/ping"
}
```

**Expected Response:** `200 OK`

**Response Body (200):**
```json
{
  "success": true,
  "response": "pong",  // Agent's response
  "format": "text",
  "agentId": "memeputer",
  "transactionSignature": "<tx-signature>",
  "x402Receipt": {
    "amountPaidUsdc": 0.01,
    "amountPaidMicroUsdc": 10000,
    "payTo": "<agent-wallet>",
    "transactionSignature": "<tx-signature>",
    "payer": "<user-wallet>",
    "merchant": "<agent-wallet>",
    "timestamp": "<iso-timestamp>"
  }
}
```

## Current Issue

When calling `/ping` on `memeputer` agent:
- ✅ Payment flow works (402 → payment → 200)
- ✅ Transaction succeeds
- ❌ Response is empty string: `"response": ""`

**Expected:** `"response": "pong"`

## Questions for Server-Side

1. Should `/ping` command return `"pong"` in the response field?
2. Is the command format `/ping` correct, or should it be `ping` (without slash)?
3. Are commands handled differently than regular prompts in the API?
4. Should the `message` field contain `/ping` or should there be a separate `command` field?

