# Testing Guide: Agent Economy

## Prerequisites

1. **Backend running locally:**
   - Agents API running on `http://localhost:3006`
   - Orchestrator Agent registered with ID: `1e7d0044-10c6-4036-9903-6ea995be82ec`
   - BroadcastPuter registered with ID: `d8582864-da79-4d9b-8fa3-26df9ce7de06`
   - Commands registered in database

2. **Orchestrator Agent Wallet:**
   - Wallet file with USDC balance
   - Wallet configured in backend (for the Orchestrator agent itself)

3. **Dependencies installed:**
   ```bash
   cd examples/agent-economy
   pnpm install
   ```

---

## Option 1: Test via Orchestrator Agent Command (Recommended)

This tests the **actual Orchestrator Agent** running on your backend.

### Step 1: Call Orchestrator Agent's `execute_task` Command

Using curl or your API client:

```bash
curl -X POST http://localhost:3006/x402/interact \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "1e7d0044-10c6-4036-9903-6ea995be82ec",
    "message": "{\"command\":\"execute_task\",\"task\":\"Create a meme about Solana\",\"budgetUsdc\":1.0}"
  }'
```

**Note:** You'll need to handle the 402 Payment Required response and include X-PAYMENT header. Use the memeputer CLI or SDK for this.

### Step 2: Use Memeputer CLI

```bash
# From the monorepo root or where memeputer CLI is installed
memeputer ask orchestratorputer "{\"command\":\"execute_task\",\"task\":\"Create a meme about Solana\",\"budgetUsdc\":1.0}" \
  --wallet /path/to/orchestrator/wallet.json \
  --api-base http://localhost:3006
```

### Step 3: Check Task Status

```bash
memeputer ask orchestratorputer "{\"command\":\"get_status\",\"taskId\":\"task_abc123\"}" \
  --wallet /path/to/orchestrator/wallet.json \
  --api-base http://localhost:3006
```

### Step 4: Check Balance

```bash
memeputer ask orchestratorputer "{\"command\":\"get_balance\"}" \
  --wallet /path/to/orchestrator/wallet.json \
  --api-base http://localhost:3006
```

---

## Option 2: Test Client-Side Example (Simulation)

This uses the client-side example that simulates an orchestrator agent calling other agents directly.

### Step 1: Set Environment Variables

Create `.env` file in `examples/agent-economy/`:

```bash
# Orchestrator wallet (the wallet that will pay other agents)
ORCHESTRATOR_WALLET=/path/to/orchestrator/wallet.json

# API endpoint (your local backend)
MEMEPUTER_API_BASE=http://localhost:3006

# Solana RPC (use devnet for testing)
SOLANA_RPC_URL=https://api.devnet.solana.com
```

Or set in `~/.memeputerrc`:

```json
{
  "orchestratorWallet": "/path/to/orchestrator/wallet.json",
  "apiUrl": "http://localhost:3006",
  "rpcUrl": "https://api.devnet.solana.com"
}
```

### Step 2: Build the Example

```bash
cd examples/agent-economy
pnpm build
```

### Step 3: Run a Test Task

```bash
# Simple test
pnpm start run --task "Create a meme about Solana" --budget 1.0

# With explicit wallet
pnpm start run \
  --task "Create a meme about Solana" \
  --budget 1.0 \
  --orchestrator-wallet /path/to/wallet.json \
  --api-base http://localhost:3006 \
  --rpc-url https://api.devnet.solana.com
```

### Step 4: Expected Output

```
🤖 Agent Economy Example

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Task: Create a meme about Solana
💰 Budget: 1 USDC
🔑 Orchestrator Wallet: 7zH2pump...
🌐 API: http://localhost:3006
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Starting task execution...
   The orchestrator agent will autonomously decide
   which agents to hire and pay them from its wallet.

🤖 Orchestrator Agent analyzing task...
   Task: "Create a meme about Solana"
   Budget: 1 USDC
   Wallet: 7zH2pump...

📊 Step 1: Hiring TrendPuter to find trends...

   💸 Paying trendputer up to 0.1 USDC...
      Command: get_trends
      From wallet: 7zH2pump...
   ✅ Paid trendputer: 0.1000 USDC
      Transaction: 5j7s8k9m...

📝 Step 2: Hiring BriefPuter to create a brief...

   💸 Paying briefputer up to 0.2 USDC...
      Command: generate_brief
      From wallet: 7zH2pump...
   ✅ Paid briefputer: 0.2000 USDC
      Transaction: 8k9m2n3p...

🎨 Step 3: Hiring PFPputer to generate image...

   💸 Paying pfpputer up to 0.5 USDC...
      Command: pfp
      From wallet: 7zH2pump...
   ✅ Paid pfpputer: 0.5000 USDC
      Transaction: 2n3p4q5r...

✅ Task completed!
   Total spent: 0.9000 USDC
   Remaining budget: 0.1000 USDC

✅ Task completed successfully!

📊 Summary:
   Total spent: 0.9000 USDC
   Agents hired: 3
   Payments made: 3

💸 Payment Details:
   1. Paid trendputer: 0.1000 USDC
      Transaction: 5j7s8k9m...
   2. Paid briefputer: 0.2000 USDC
      Transaction: 8k9m2n3p...
   3. Paid pfpputer: 0.5000 USDC
      Transaction: 2n3p4q5r...

📄 Result:
Trends found: 5 items
Brief created: Solana memecoin surge
Image generated: https://example.com/image.png
Caption: Solana is pumping! 🚀
```

---

## Option 3: Test BroadcastPuter Directly

Test the BroadcastPuter agent independently:

### Post to Telegram

```bash
memeputer ask broadcastputer '{
  "command": "post_telegram",
  "botToken": "YOUR_BOT_TOKEN",
  "chatId": "YOUR_CHAT_ID",
  "caption": "Test post from BroadcastPuter! 🚀",
  "imageUrl": "https://example.com/test-image.png"
}' \
  --wallet /path/to/wallet.json \
  --api-base http://localhost:3006
```

### Post to Farcaster

```bash
memeputer ask broadcastputer '{
  "command": "post_farcaster",
  "neynarApiKey": "YOUR_NEYNAR_KEY",
  "fid": 12345,
  "caption": "Test cast from BroadcastPuter! 🚀",
  "imageUrl": "https://example.com/test-image.png"
}' \
  --wallet /path/to/wallet.json \
  --api-base http://localhost:3006
```

---

## Troubleshooting

### Issue: "Could not find orchestrator agent wallet"

**Solution:**
- Set `ORCHESTRATOR_WALLET` in `.env` file
- Or use `--orchestrator-wallet` flag
- Or add to `~/.memeputerrc`

### Issue: "Payment required but payment was rejected"

**Solution:**
- Ensure orchestrator wallet has USDC balance
- Check wallet has SOL for transaction fees (~0.002 SOL)
- Verify USDC token account is initialized

### Issue: "Agent not found" or 404

**Solution:**
- Verify agent IDs are correct:
  - Orchestrator: `1e7d0044-10c6-4036-9903-6ea995be82ec`
  - BroadcastPuter: `d8582864-da79-4d9b-8fa3-26df9ce7de06`
- Check commands are registered in database
- Verify agents-api is running on port 3006

### Issue: "Connection refused" to localhost:3006

**Solution:**
- Ensure agents-api is running: `cd apps/api && pnpm dev`
- Check port 3006 is not blocked
- Verify `MEMEPUTER_API_BASE` is set correctly

### Issue: Agent calls fail with timeout

**Solution:**
- Check other agents (trendputer, briefputer, pfpputer) are available
- Verify x402 payment flow is working
- Check backend logs for errors

---

## Verification Checklist

- [ ] Orchestrator agent can receive `execute_task` command
- [ ] Orchestrator agent checks its balance before executing
- [ ] Orchestrator agent calls other agents via x402
- [ ] Payments are tracked correctly
- [ ] Task status can be queried
- [ ] BroadcastPuter can post to Telegram
- [ ] BroadcastPuter can post to Farcaster
- [ ] All payments show correct transaction signatures
- [ ] Budget constraints are respected

---

## Next Steps

1. Test with real wallet and USDC on devnet
2. Verify all payments are on-chain (check Solana explorer)
3. Test error scenarios (insufficient balance, agent unavailable)
4. Test with multiple concurrent tasks
5. Monitor backend logs for any issues

