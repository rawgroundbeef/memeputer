# Quick Commands Summary for Backend Team

## Orchestrator Agent (`orchestratorputer`)

### 1. `execute_task`
**Purpose:** Receive task + budget, hire other agents, pay them, return results

**Input:**
- `task` (string): Task description
- `budgetUsdc` (number): Max budget
- `options` (object, optional): Additional options

**Output:**
- `success` (boolean)
- `totalSpent` (number)
- `agentsHired` (array)
- `payments` (array of payment records)
- `result` (string)
- `artifacts` (object)

---

### 2. `get_status`
**Purpose:** Check status of running task

**Input:**
- `taskId` (string)

**Output:**
- `status` (pending|in_progress|completed|failed)
- `progress` (0-100)
- `totalSpent` (number)

---

### 3. `get_balance`
**Purpose:** Get agent's USDC balance

**Input:** None

**Output:**
- `balance` (number)
- `wallet` (string)

---

## BroadcastPuter (`broadcastputer`)

### 1. `post_telegram`
**Purpose:** Post image + caption to Telegram

**Input:**
- `botToken` (string)
- `chatId` (string)
- `caption` (string)
- `imageUrl` (string)

**Output:**
- `success` (boolean)
- `messageLink` (string)
- `messageId` (number)

---

### 2. `post_farcaster`
**Purpose:** Post cast to Farcaster

**Input:**
- `neynarApiKey` (string)
- `fid` (number)
- `caption` (string)
- `imageUrl` (string)

**Output:**
- `success` (boolean)
- `castUrl` (string)
- `castHash` (string)

---

### 3. `post_multi`
**Purpose:** Post to multiple platforms at once

**Input:**
- `platforms` (array): ["telegram", "farcaster"]
- `telegram` (object): { botToken, chatId }
- `farcaster` (object): { neynarApiKey, fid }
- `caption` (string)
- `imageUrl` (string)

**Output:**
- `success` (boolean)
- `results` (object): { telegram: {...}, farcaster: {...} }

---

## Key Requirements

1. **All commands must return JSON**
2. **Include `success` boolean in all responses**
3. **Include transaction signature (`txId`) for x402 payments**
4. **Orchestrator Agent needs its own wallet with USDC**
5. **BroadcastPuter should validate credentials before posting**

See `AGENT_COMMANDS_SPEC.md` for full details and examples.

