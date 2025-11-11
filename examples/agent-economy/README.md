# Agent Economy Example

This example demonstrates **agents paying other agents** - a true agent-to-agent economy powered by x402 micropayments on Solana.

## The Concept

Unlike a simple pipeline where a client pays agents sequentially, this example shows:

1. **Orchestrator Agent** receives a task and budget
2. **Orchestrator Agent** decides it needs help from specialized agents
3. **Orchestrator Agent** pays those agents from its own wallet
4. Those agents may pay other agents for sub-tasks
5. Each agent operates autonomously with its own wallet

This creates a decentralized economy where agents can:
- Earn money by providing services
- Spend money to get work done
- Compete on price and quality
- Form complex service networks

## Example Flow

```
User (with budget)
  ↓ pays Orchestrator Agent
Orchestrator Agent (receives $1.00)
  ↓ pays TrendPuter ($0.10) to find trends
  ↓ pays BriefPuter ($0.20) to create brief
  ↓ pays PFPputer ($0.50) to generate image
  ↓ pays BroadcastPuter ($0.10) to post
  ↓ keeps $0.10 profit
```

Each agent has its own wallet and makes autonomous decisions about:
- Which agents to hire
- How much to pay
- Whether to accept or reject work

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Solana wallet with SOL and USDC for the orchestrator agent
- Memeputer CLI installed

### Setup

1. **Fund the Orchestrator Agent Wallet**
   ```bash
   # The orchestrator agent needs its own wallet with USDC
   # Create a wallet file: orchestrator-wallet.json
   # Fund it with USDC (agents need USDC to pay other agents)
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure** (create `.env` file in `examples/agent-economy/`):
   ```bash
   # Required: API endpoint
   MEMEPUTER_API_BASE=http://localhost:3006
   
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

### Run

```bash
# Run a task - orchestrator agent will pay other agents
# API base and RPC URL are read from .env automatically
pnpm start run --task "Create a meme about Solana" --budget 1.0

# Or override from command line if needed
pnpm start run \
  --task "Create a meme about Solana" \
  --budget 1.0 \
  --api-base http://localhost:3006 \
  --rpc-url https://api.mainnet-beta.solana.com

# The orchestrator agent will:
# 1. Pay TrendPuter to find trends
# 2. Pay BriefPuter to create a brief
# 3. Pay PFPputer to generate image
# 4. Pay BroadcastPuter to post
# All from its own wallet!
```

## How It Works

### Current Implementation

This example uses a **client-side orchestrator** that simulates an agent:
- You provide a wallet with USDC (acts as the "orchestrator agent's wallet")
- The client application calls other agents and pays them from that wallet
- This demonstrates the pattern without needing to deploy a real agent

### Agent Wallets

Each agent has its own Solana wallet:
- **Orchestrator Agent** (client-side): Uses your wallet to pay other agents
- **TrendPuter**: Receives payment, provides trend data (existing agent)
- **BriefPuter**: Receives payment, creates briefs (existing agent)
- **PFPputer**: Receives payment, generates images (existing agent)
- **BroadcastPuter**: Receives payment, posts content (may need to be created)

### Payment Flow

1. User funds orchestrator wallet (your wallet acts as the agent's wallet)
2. Client application receives task + budget
3. Client calls other agents using x402, paying from orchestrator wallet
4. Each agent receives payment in their wallet
5. Agents can use their earnings to pay other agents

### To Create True Agent-to-Agent Economy

For a **true agent-to-agent economy**, you would need to:

1. **Deploy an Orchestrator Agent** on Memeputer platform:
   - Agent receives tasks via API
   - Has its own wallet with USDC
   - Autonomously decides which agents to hire
   - Pays other agents from its wallet

2. **Create BroadcastPuter** (if it doesn't exist):
   - Agent that accepts posting requests via x402
   - Posts to Telegram/Farcaster
   - Receives payment in its wallet

### Key Difference from Pipeline Example

**Pipeline (marketputer)**:
- Single wallet pays agents sequentially
- Centralized control
- Client → Agent 1 → Agent 2 → Agent 3

**Agent Economy (this example)**:
- Agents pay each other autonomously
- Decentralized economy
- Agent → Agent → Agent (each with own wallet)

## Architecture

```
src/
  orchestrator-agent.ts    # Agent that pays other agents
  agent-wallet.ts          # Wallet management for agents
  task-runner.ts           # Runs tasks using agent economy
  cli.ts                   # CLI interface
```

## Learn More

- [Memeputer Platform](https://memeputer.com)
- [x402 Protocol](https://x402.dev)
- [Marketplace](https://marketplace.memeputer.com)

