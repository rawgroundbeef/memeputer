# Marketputer

An orchestrator agent that autonomously coordinates multiple specialized agents to create memes about trending topics, using x402 micropayments on Solana.

## What It Does

Marketputer demonstrates **autonomous agent orchestration** with x402 payments:

1. **Orchestrator Agent** receives a budget and autonomously executes a fixed task
2. **Orchestrator Agent** makes decisions about which agents to hire and when
3. **Orchestrator Agent** pays specialized agents from its own wallet using x402
4. Each agent receives payment and completes their specialized task
5. The orchestrator coordinates the entire workflow end-to-end

## The Task

**Fixed task**: "Find relevant topics and create a meme about them"

The orchestrator follows a structured workflow to complete this task, making autonomous decisions at key points.

## Workflow

```
Orchestrator Agent (receives budget)
  ↓
1. Get focus plan from Briefputer (identify keywords/topics)
  ↓
2. Get trending topics from Trendputer (investigate 10 trends)
  ↓
3. Select best trend using Briefputer (evaluate quality)
  ↓
4. Generate creative brief from Briefputer (strategy & angle)
  ↓
5. Enhance image prompt with Promptputer
  ↓
6. Generate image from PFPputer
  ↓
7. Describe image with ImageDescripterputer
  ↓
8. Generate captions from Captionputer
  ↓
9. Post to Telegram via Broadcastputer
```

Each step involves an x402 micropayment from the orchestrator's wallet to the specialized agent.

## Autonomous Decisions

The orchestrator makes autonomous decisions using AI:

- **Trend Selection**: Uses Briefputer to evaluate and select the best trend from available options
- **Brief Generation**: Decides whether a creative brief is needed based on context
- **Quality Control**: Retries trend fetching if quality is insufficient

The overall workflow is fixed, but the orchestrator adapts based on the quality and relevance of intermediate results.

## Agents Used

The orchestrator coordinates these specialized agents:

- **briefputer**: Focus planning, trend evaluation, creative brief generation
- **trendputer**: Trend investigation and discovery
- **promptputer**: Image prompt enhancement
- **pfpputer**: Image generation
- **imagedescripterputer**: Image analysis and description
- **captionputer**: Caption generation
- **broadcastputer**: Social media posting (Telegram)

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Solana wallet with SOL and USDC

### Setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Configure** (create `.env` file in `examples/marketputer/`):
   ```bash
   # Optional: Solana RPC (defaults to mainnet)
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   
   # Optional: Orchestrator wallet (choose one)
   # Option 1: Wallet file path
   ORCHESTRATOR_WALLET=~/.config/solana/orchestrator-wallet.json
   
   # Option 2: Use existing MEMEPUTER_WALLET
   MEMEPUTER_WALLET=~/.config/solana/id.json
   
   # Option 3: Agent wallet secret (if using agent's wallet from backend)
   ORCHESTRATOR_AGENT_WALLET_SECRET=your-wallet-secret-here
   ```

3. **Fund your wallet**
   - Ensure your wallet has USDC for payments
   - Ensure your wallet has SOL for transaction fees

### Run

```bash
# Run the orchestrator agent
pnpm start run --budget 1.0

# The orchestrator will:
# 1. Pay Briefputer to get focus plan
# 2. Pay Trendputer to find trends
# 3. Pay Briefputer to select best trend
# 4. Pay Briefputer to generate brief
# 5. Pay Promptputer to enhance prompt
# 6. Pay PFPputer to generate image
# 7. Pay ImageDescripterputer to describe image
# 8. Pay Captionputer to generate captions
# 9. Pay Broadcastputer to post to Telegram
# All payments tracked with Solscan links
```

### With Brand Profile

```bash
# Use a brand profile for consistent voice/style
pnpm start run --budget 1.0 --brand brands/memeputer.json
```

### Loop Mode

```bash
# Run continuously, creating a new meme every 60 seconds
pnpm start run --budget 1.0 --loop --loop-delay 60
```

## How It Works

### Implementation

This is a **client-side orchestrator** that simulates an autonomous agent:

- You provide a wallet with USDC (acts as the "orchestrator agent's wallet")
- The client application autonomously coordinates multiple agents
- Each agent call is paid via x402 micropayments
- All payments are tracked and logged with Solscan links

### Payment Flow

1. User provides wallet with USDC balance
2. Orchestrator receives task and budget
3. Orchestrator autonomously calls agents using x402, paying from its wallet
4. Each agent receives payment in their wallet
5. Orchestrator tracks spending and manages budget

### Architecture

```
src/
  orchestrator-agent.ts    # Main orchestrator logic
  cli.ts                   # CLI interface
  logger.ts                # Clean logging utility
  types.ts                 # TypeScript types
  step-by-step.ts          # Step-by-step testing CLI
```

## Step-by-Step Testing

For detailed testing and debugging, you can run individual steps:

```bash
# List available steps
pnpm step-list

# Run individual steps
pnpm step0  # Get focus plan
pnpm step3  # Get trends
pnpm step4  # Select trend
pnpm step6  # Generate brief
```

See `QUICK_START.md` for detailed step-by-step instructions.

## Learn More

- [Memeputer Platform](https://memeputer.com)
- [x402 Protocol](https://x402.dev)
- [Marketplace](https://marketplace.memeputer.com)
