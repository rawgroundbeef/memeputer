# Custom Commands Specification for New Agents

## Introduction

We're creating two new agents to demonstrate a true **agent-to-agent economy** where agents autonomously pay other agents to complete tasks. This is different from our existing pipeline examples where a single wallet pays agents sequentially.

### What We're Building

1. **Orchestrator Agent** - An autonomous agent that receives tasks and budgets, then decides which agents to hire and pays them from its own wallet to complete the work. This demonstrates agents making autonomous decisions about spending their own funds.

2. **BroadcastPuter** - An agent that posts content to social media platforms (Telegram, Farcaster) and receives payment via x402. This agent can be hired by other agents (like the Orchestrator) or directly by users.

### Key Difference

**Current Pattern (Pipeline):**
- User wallet → pays Agent 1 → pays Agent 2 → pays Agent 3

**New Pattern (Agent Economy):**
- Orchestrator Agent (with own wallet) → pays Agent 1 → pays Agent 2 → pays Agent 3
- Each agent operates autonomously with its own wallet and can earn/spend money

### Requirements

- All commands must return JSON responses
- All responses must include `success` boolean field
- All x402 payments must include transaction signature (`txId` or `transactionSignature`)
- Orchestrator Agent needs its own Solana wallet with USDC balance
- Commands should handle errors gracefully and return clear error messages

---

## Orchestrator Agent

**Agent ID:** `orchestratorputer` (or `1e7d0044-10c6-4036-9903-6ea995be82ec`)

### Command: `execute_task`

**Description:** Receives a task description and budget, then autonomously decides which agents to hire and pays them to complete the task. The agent uses its own wallet to pay other agents via x402.

**Request:**
```json
{
  "command": "execute_task",
  "task": "string - Description of the task to complete (e.g., 'Create a meme about Solana')",
  "budgetUsdc": "number - Maximum budget in USDC (e.g., 1.0)",
  "options": {
    "preferredAgents": ["array of agent IDs - optional"],
    "maxAgents": "number - optional, default unlimited",
    "timeoutSeconds": "number - optional, default 300"
  }
}
```

**Response:**
```json
{
  "success": true,
  "taskId": "string - Unique task identifier",
  "totalSpent": "number - Total USDC spent",
  "remainingBudget": "number - Remaining budget",
  "agentsHired": ["array of agent IDs that were hired"],
  "payments": [
    {
      "agentId": "string - Agent that was paid",
      "command": "string - Command executed on that agent",
      "amount": "number - USDC paid",
      "txId": "string - Transaction signature",
      "timestamp": "string - ISO timestamp"
    }
  ],
  "result": "string - Summary of completed work",
  "artifacts": {
    "trends": "object - optional, if trends were fetched",
    "brief": "object - optional, if brief was created",
    "imageUrl": "string - optional, if image was generated",
    "caption": "string - optional, if caption was generated"
  },
  "error": "string - optional, only present if success is false"
}
```

**Example Request:**
```json
{
  "command": "execute_task",
  "task": "Create a meme about Solana",
  "budgetUsdc": 1.0
}
```

**Example Response:**
```json
{
  "success": true,
  "taskId": "task_abc123xyz",
  "totalSpent": 0.9,
  "remainingBudget": 0.1,
  "agentsHired": ["trendputer", "briefputer", "pfpputer"],
  "payments": [
    {
      "agentId": "trendputer",
      "command": "get_trends",
      "amount": 0.1,
      "txId": "5j7s8k9m...",
      "timestamp": "2025-01-11T12:00:00Z"
    },
    {
      "agentId": "briefputer",
      "command": "generate_brief",
      "amount": 0.2,
      "txId": "8k9m2n3p...",
      "timestamp": "2025-01-11T12:01:00Z"
    },
    {
      "agentId": "pfpputer",
      "command": "pfp",
      "amount": 0.5,
      "txId": "2n3p4q5r...",
      "timestamp": "2025-01-11T12:02:00Z"
    }
  ],
  "result": "Created meme about Solana: trends found (5 items), brief created, image generated at https://example.com/image.png",
  "artifacts": {
    "trends": { "items": [/* trend items */] },
    "brief": { "angle": "Solana memecoin surge", "tone": "playful" },
    "imageUrl": "https://example.com/image.png",
    "caption": "Solana is pumping! 🚀"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Budget exhausted: only 0.05 USDC remaining, need 0.10 USDC for next agent",
  "totalSpent": 0.95,
  "agentsHired": ["trendputer", "briefputer"]
}
```

---

### Command: `get_status`

**Description:** Get the status of a running or completed task.

**Request:**
```json
{
  "command": "get_status",
  "taskId": "string - Task identifier from execute_task response"
}
```

**Response:**
```json
{
  "success": true,
  "taskId": "string",
  "status": "pending | in_progress | completed | failed",
  "progress": "number - 0-100",
  "totalSpent": "number",
  "agentsHired": ["array"],
  "currentStep": "string - Description of current step",
  "result": "string - optional, present if completed",
  "error": "string - optional, present if failed"
}
```

---

### Command: `get_balance`

**Description:** Get the orchestrator agent's current USDC balance.

**Request:**
```json
{
  "command": "get_balance"
}
```

**Response:**
```json
{
  "success": true,
  "balance": "number - USDC balance",
  "wallet": "string - Public key of agent's wallet"
}
```

---

## BroadcastPuter

**Agent ID:** `[TO BE PROVIDED]`

### Command: `post_telegram`

**Description:** Post an image with caption to a Telegram channel/group. The agent downloads the image from the provided URL and uploads it to Telegram. Uses the agent's configured bot token if available, otherwise requires botToken in request.

**Request:**
```json
{
  "command": "post_telegram",
  "botToken": "string - Optional: Telegram bot token (if agent doesn't have one configured)",
  "chatId": "string - Telegram chat/channel ID (can be negative for groups)",
  "caption": "string - Post caption (supports HTML formatting)",
  "imageUrl": "string - Publicly accessible URL of image to post"
}
```

**Note:** If BroadcastPuter agent has a bot token configured in the Memeputer system, `botToken` can be omitted and the agent will use its own token.

**Response:**
```json
{
  "success": true,
  "messageLink": "string - Link to posted message (format: https://t.me/c/{chatId}/{messageId})",
  "messageId": "number - Telegram message ID",
  "chatId": "string - Chat ID where posted",
  "timestamp": "string - ISO timestamp"
}
```

**Example Request:**
```json
{
  "command": "post_telegram",
  "botToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
  "chatId": "-1001234567890",
  "caption": "Check out this meme! 🚀\n\n<b>Trend:</b> Solana memecoin surge",
  "imageUrl": "https://example.com/meme.png"
}
```

**Example Response:**
```json
{
  "success": true,
  "messageLink": "https://t.me/c/1234567890/123",
  "messageId": 123,
  "chatId": "-1001234567890",
  "timestamp": "2025-01-11T12:00:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid bot token or chat ID",
  "messageLink": null
}
```

---

### Command: `post_farcaster`

**Description:** Post a cast (image + text) to Farcaster using the Neynar API.

**Request:**
```json
{
  "command": "post_farcaster",
  "neynarApiKey": "string - Neynar API key",
  "fid": "number - Farcaster FID (user ID)",
  "caption": "string - Cast text",
  "imageUrl": "string - Publicly accessible URL of image to post"
}
```

**Response:**
```json
{
  "success": true,
  "castUrl": "string - Link to cast (format: https://warpcast.com/username/0x...)",
  "castHash": "string - Cast hash",
  "fid": "number - Farcaster FID",
  "timestamp": "string - ISO timestamp"
}
```

**Example Request:**
```json
{
  "command": "post_farcaster",
  "neynarApiKey": "your-neynar-api-key-here",
  "fid": 12345,
  "caption": "Check out this meme! 🚀\n\nSolana is pumping!",
  "imageUrl": "https://example.com/meme.png"
}
```

**Example Response:**
```json
{
  "success": true,
  "castUrl": "https://warpcast.com/username/0xabc123",
  "castHash": "0xabc123def456...",
  "fid": 12345,
  "timestamp": "2025-01-11T12:00:00Z"
}
```

---

### Command: `post_multi`

**Description:** Post to multiple platforms simultaneously. Useful when the same content needs to be posted to multiple channels.

**Request:**
```json
{
  "command": "post_multi",
  "platforms": ["array of platform names: 'telegram', 'farcaster'"],
  "telegram": {
    "botToken": "string",
    "chatId": "string"
  },
  "farcaster": {
    "neynarApiKey": "string",
    "fid": "number"
  },
  "caption": "string - Caption for all platforms",
  "imageUrl": "string - Image URL"
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "telegram": {
      "success": true,
      "messageLink": "string - optional",
      "error": "string - optional, present if failed"
    },
    "farcaster": {
      "success": true,
      "castUrl": "string - optional",
      "error": "string - optional, present if failed"
    }
  }
}
```

**Example Request:**
```json
{
  "command": "post_multi",
  "platforms": ["telegram", "farcaster"],
  "telegram": {
    "botToken": "123456:ABC-DEF...",
    "chatId": "-1001234567890"
  },
  "farcaster": {
    "neynarApiKey": "your-key",
    "fid": 12345
  },
  "caption": "Amazing meme! 🚀",
  "imageUrl": "https://example.com/meme.png"
}
```

**Example Response:**
```json
{
  "success": true,
  "results": {
    "telegram": {
      "success": true,
      "messageLink": "https://t.me/c/1234567890/123"
    },
    "farcaster": {
      "success": true,
      "castUrl": "https://warpcast.com/username/0xabc123"
    }
  }
}
```

---

## Implementation Notes

### Orchestrator Agent

1. **Wallet Management:**
   - Agent must have its own Solana wallet with USDC
   - Wallet should be initialized with USDC token account (~0.002 SOL needed for initialization)
   - Agent should check balance before attempting to pay other agents

2. **Agent Hiring Logic:**
   - Agent should autonomously decide which agents to hire based on task keywords/content
   - Should respect budget constraints (don't exceed `budgetUsdc`)
   - Should track all payments made for reporting
   - Should handle failures gracefully (try alternative agents or return partial results)

3. **Payment Flow:**
   - When calling other agents, orchestrator agent pays via x402 protocol
   - Payment amount determined by called agent's pricing (from 402 response)
   - Track all transactions in `payments` array for reporting

4. **Error Handling:**
   - If an agent call fails, try alternative agents if available
   - Return partial results if some steps succeed
   - Respect timeout limits
   - Return clear error messages

### BroadcastPuter

1. **Platform Support:**
   - Currently: Telegram, Farcaster
   - Future extensibility: X/Twitter, Bluesky, etc.

2. **Image Handling:**
   - Should download image from URL if platform requires upload
   - Should validate image format and size
   - Should handle various image formats (PNG, JPG, GIF, etc.)

3. **Caption Formatting:**
   - Telegram supports HTML formatting (`<b>`, `<i>`, `<a>`, etc.)
   - Farcaster supports markdown
   - Should sanitize user input to prevent injection

4. **Error Handling:**
   - Validate API credentials before attempting post
   - Return clear error messages for invalid credentials
   - Handle rate limits gracefully
   - Handle network errors (image download failures, etc.)

---

## Response Format Standard

All commands must follow this standard:

1. **Success Response:**
   ```json
   {
     "success": true,
     // ... command-specific fields
   }
   ```

2. **Error Response:**
   ```json
   {
     "success": false,
     "error": "string - Clear error message describing what went wrong"
   }
   ```

3. **x402 Payment Responses:**
   - Must include transaction signature in `txId` or `transactionSignature` field
   - Should include payment amount in `amount` field (USDC)

4. **All timestamps:**
   - Use ISO 8601 format: `"2025-01-11T12:00:00Z"`

---

## Testing Checklist

### Orchestrator Agent
- [ ] Test with various task types (meme creation, trend analysis, etc.)
- [ ] Test budget exhaustion scenarios
- [ ] Test with non-existent agents (should handle gracefully)
- [ ] Test timeout scenarios
- [ ] Verify payment tracking accuracy
- [ ] Test partial completion (some agents succeed, some fail)

### BroadcastPuter
- [ ] Test with valid/invalid Telegram credentials
- [ ] Test with valid/invalid Farcaster credentials
- [ ] Test with various image formats (PNG, JPG, GIF)
- [ ] Test caption length limits
- [ ] Test HTML formatting in Telegram captions
- [ ] Test rate limiting scenarios
- [ ] Test multi-platform posting (both succeed, one fails, both fail)
- [ ] Test with invalid image URLs

---

## Pricing Recommendations

### Orchestrator Agent
- `execute_task`: $0.05 - $0.10 USDC (base orchestration fee)
- `get_status`: $0.01 USDC (low cost status check)
- `get_balance`: Free (no computation needed)

### BroadcastPuter
- `post_telegram`: $0.05 - $0.10 USDC per post
- `post_farcaster`: $0.05 - $0.10 USDC per post
- `post_multi`: $0.10 - $0.15 USDC (discounted multi-platform rate)

---

## Questions?

If you need clarification on any command or implementation detail, please reach out. The agent IDs will be provided separately once they're created.

