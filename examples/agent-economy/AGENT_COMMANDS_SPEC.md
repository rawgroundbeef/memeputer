# Agent Custom Commands Specification

This document specifies the custom commands needed for the Orchestrator Agent and BroadcastPuter agents.

---

## 1. Orchestrator Agent

**Agent ID:** `orchestratorputer` (or `orchestrator`)

**Purpose:** An autonomous agent that receives tasks and budgets, then hires and pays other agents to complete the work.

### Command: `execute_task`

**Description:** Receives a task description and budget, then autonomously decides which agents to hire and pays them to complete the task.

**Request Format:**
```json
{
  "command": "execute_task",
  "task": "string - Description of the task to complete",
  "budgetUsdc": "number - Maximum budget in USDC",
  "options": {
    "preferredAgents": ["array of agent IDs - optional"],
    "maxAgents": "number - optional, default unlimited",
    "timeoutSeconds": "number - optional, default 300"
  }
}
```

**Response Format:**
```json
{
  "success": "boolean",
  "taskId": "string - Unique task identifier",
  "totalSpent": "number - Total USDC spent",
  "remainingBudget": "number - Remaining budget",
  "agentsHired": ["array of agent IDs that were hired"],
  "payments": [
    {
      "agentId": "string",
      "command": "string - Command executed",
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
  "error": "string - optional, if task failed"
}
```

**Example Request:**
```json
{
  "command": "execute_task",
  "task": "Create a meme about Solana",
  "budgetUsdc": 1.0,
  "options": {
    "maxAgents": 5
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "taskId": "task_abc123",
  "totalSpent": 0.9,
  "remainingBudget": 0.1,
  "agentsHired": ["trendputer", "briefputer", "pfpputer"],
  "payments": [
    {
      "agentId": "trendputer",
      "command": "get_trends",
      "amount": 0.1,
      "txId": "5j7s...",
      "timestamp": "2025-01-11T12:00:00Z"
    },
    {
      "agentId": "briefputer",
      "command": "generate_brief",
      "amount": 0.2,
      "txId": "8k9m...",
      "timestamp": "2025-01-11T12:01:00Z"
    },
    {
      "agentId": "pfpputer",
      "command": "pfp",
      "amount": 0.5,
      "txId": "2n3p...",
      "timestamp": "2025-01-11T12:02:00Z"
    }
  ],
  "result": "Created meme about Solana: trends found (5 items), brief created, image generated at https://...",
  "artifacts": {
    "trends": { "items": [...] },
    "brief": { "angle": "..." },
    "imageUrl": "https://...",
    "caption": "..."
  }
}
```

### Command: `get_status`

**Description:** Get the status of a running or completed task.

**Request Format:**
```json
{
  "command": "get_status",
  "taskId": "string - Task identifier"
}
```

**Response Format:**
```json
{
  "taskId": "string",
  "status": "pending | in_progress | completed | failed",
  "progress": "number - 0-100",
  "totalSpent": "number",
  "agentsHired": ["array"],
  "currentStep": "string - Description of current step",
  "result": "string - optional",
  "error": "string - optional"
}
```

### Command: `get_balance`

**Description:** Get the orchestrator agent's current USDC balance.

**Request Format:**
```json
{
  "command": "get_balance"
}
```

**Response Format:**
```json
{
  "balance": "number - USDC balance",
  "wallet": "string - Public key of agent's wallet"
}
```

---

## 2. BroadcastPuter

**Agent ID:** `broadcastputer` (or `broadcast`)

**Purpose:** An agent that posts content to social media platforms (Telegram, Farcaster) and receives payment via x402.

### Command: `post_telegram`

**Description:** Post an image with caption to a Telegram channel/group.

**Request Format:**
```json
{
  "command": "post_telegram",
  "botToken": "string - Telegram bot token",
  "chatId": "string - Telegram chat/channel ID",
  "caption": "string - Post caption (supports HTML)",
  "imageUrl": "string - URL of image to post"
}
```

**Response Format:**
```json
{
  "success": "boolean",
  "messageLink": "string - Link to posted message",
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
  "caption": "Check out this meme! 🚀",
  "imageUrl": "https://example.com/image.png"
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

### Command: `post_farcaster`

**Description:** Post a cast (image + text) to Farcaster.

**Request Format:**
```json
{
  "command": "post_farcaster",
  "neynarApiKey": "string - Neynar API key",
  "fid": "number - Farcaster FID (user ID)",
  "caption": "string - Cast text",
  "imageUrl": "string - URL of image to post"
}
```

**Response Format:**
```json
{
  "success": "boolean",
  "castUrl": "string - Link to cast",
  "castHash": "string - Cast hash",
  "fid": "number - Farcaster FID",
  "timestamp": "string - ISO timestamp"
}
```

**Example Request:**
```json
{
  "command": "post_farcaster",
  "neynarApiKey": "your-neynar-api-key",
  "fid": 12345,
  "caption": "Check out this meme! 🚀",
  "imageUrl": "https://example.com/image.png"
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

### Command: `post_multi`

**Description:** Post to multiple platforms at once.

**Request Format:**
```json
{
  "command": "post_multi",
  "platforms": ["telegram", "farcaster"],
  "telegram": {
    "botToken": "string",
    "chatId": "string"
  },
  "farcaster": {
    "neynarApiKey": "string",
    "fid": "number"
  },
  "caption": "string",
  "imageUrl": "string"
}
```

**Response Format:**
```json
{
  "success": "boolean",
  "results": {
    "telegram": {
      "success": "boolean",
      "messageLink": "string - optional",
      "error": "string - optional"
    },
    "farcaster": {
      "success": "boolean",
      "castUrl": "string - optional",
      "error": "string - optional"
    }
  }
}
```

---

## Implementation Notes

### Orchestrator Agent

1. **Wallet Management:**
   - Agent must have its own Solana wallet with USDC
   - Wallet should be initialized with USDC token account
   - Agent needs ~0.002 SOL for token account initialization

2. **Agent Hiring Logic:**
   - Agent should autonomously decide which agents to hire based on task
   - Should respect budget constraints
   - Should track all payments made
   - Should handle failures gracefully (retry or skip)

3. **Payment Flow:**
   - When calling other agents, orchestrator agent pays via x402
   - Payment amount determined by called agent's pricing
   - Track all transactions for reporting

4. **Error Handling:**
   - If an agent call fails, should try alternative agents if available
   - Should return partial results if some steps succeed
   - Should respect timeout limits

### BroadcastPuter

1. **Platform Support:**
   - Currently: Telegram, Farcaster
   - Future: X/Twitter, Bluesky, etc.

2. **Image Handling:**
   - Should download image from URL if needed
   - Should validate image format and size
   - Should handle image uploads for platforms that require it

3. **Caption Formatting:**
   - Telegram supports HTML formatting
   - Farcaster supports markdown
   - Should sanitize user input

4. **Error Handling:**
   - Should validate API credentials before attempting post
   - Should return clear error messages
   - Should handle rate limits gracefully

---

## Testing Recommendations

### Orchestrator Agent
- Test with various task types
- Test budget exhaustion scenarios
- Test with non-existent agents
- Test timeout scenarios
- Verify payment tracking accuracy

### BroadcastPuter
- Test with valid/invalid credentials
- Test with various image formats
- Test caption length limits
- Test rate limiting
- Test multi-platform posting

---

## Pricing Suggestions

### Orchestrator Agent
- `execute_task`: $0.05 - $0.10 USDC (base fee for orchestration)
- `get_status`: $0.01 USDC (low cost status check)
- `get_balance`: Free (no computation needed)

### BroadcastPuter
- `post_telegram`: $0.05 - $0.10 USDC per post
- `post_farcaster`: $0.05 - $0.10 USDC per post
- `post_multi`: $0.10 - $0.15 USDC (discounted multi-platform)

---

## Response Format Standard

All commands should return JSON responses with:
- `success`: boolean indicating if operation succeeded
- Error details in `error` field if `success` is false
- Relevant data fields based on command
- Transaction signature in `txId` or `transactionSignature` field (for x402 payments)

