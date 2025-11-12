# Quick Start: Testing Agent Economy Step-by-Step

This is a quick reference for testing the agent economy example step-by-step.

## Prerequisites

1. Make sure you have a wallet set up (see main README.md)
2. Set up `.env` file:
   ```bash
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   MEMEPUTER_WALLET=~/.config/solana/id.json
   ```

## List Available Steps

```bash
pnpm step-list
```

## Run Step 0 (First Step)

This is the first step - asking AI what to focus on:

```bash
# Basic usage
pnpm step0 --task "Create a meme about Solana"

# With save result (recommended)
pnpm step0 --task "Create a meme about Solana" --save-result

# With custom wallet
pnpm step0 --task "Create a meme about Solana" \
  --orchestrator-wallet ~/.config/solana/id.json \
  --save-result
```

**What it does:**
- Calls BriefPuter to analyze your task
- Gets keywords and topics to focus on
- Saves result to `step-results/step0-{timestamp}.json` (if `--save-result`)

**Expected output:**
- 📥 INPUT: Your task and configuration
- 📤 OUTPUT: Focus plan with keywords, topics, and reasoning
- 💸 PAYMENT: Payment details (agent, amount, transaction)
- ✅ SUCCESS: Confirmation with focus plan summary

## Next Steps

After Step 0, you can continue with:

```bash
# Step 1: Decide if we need trends
pnpm step1 --task "Create a meme about Solana"

# Step 1a: Get trends (use keywords from step0)
pnpm step1a --task "Create a meme about Solana" \
  --keywords "Solana,crypto,blockchain" \
  --save-result
```

## Full Example: First 3 Steps

```bash
# Step 0: Get focus plan
pnpm step0 --task "Create a meme about Solana" --save-result
# Note the keywords from output (e.g., "Solana", "crypto", "blockchain")

# Step 1: Decide if we need trends
pnpm step1 --task "Create a meme about Solana"

# Step 1a: Get trends (replace keywords with actual ones from step0)
pnpm step1a --task "Create a meme about Solana" \
  --keywords "Solana,crypto,blockchain" \
  --save-result
```

## Understanding the Logs

Each step logs everything with clear markers:

- **📥 INPUT [STEP_NAME]**: All inputs (task, prompts, config)
- **📤 OUTPUT [STEP_NAME]**: All outputs (API responses, parsed data)
- **💸 PAYMENT [STEP_NAME]**: Payment details (agent, amount, TX)
- **ℹ️ [STEP_NAME]**: General info
- **✅ [STEP_NAME]**: Success messages
- **❌ [STEP_NAME]**: Errors

All inputs/outputs are separated by `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` for easy reading.

## Troubleshooting

**Wallet not found:**
```bash
# Option 1: Set in .env
MEMEPUTER_WALLET=~/.config/solana/id.json

# Option 2: Use flag
pnpm step0 --task "..." --orchestrator-wallet ~/.config/solana/id.json
```

**API errors:**
- Make sure API is accessible
- Check your network connection

**Payment failures:**
- Ensure wallet has USDC balance
- Check transaction signature in logs

## More Information

- See main `README.md` for full setup instructions

