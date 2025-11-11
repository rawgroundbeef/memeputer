# Marketputer

An example application demonstrating how to compose multiple Memeputer agents into a complete marketing automation **pipeline**.

## What It Does

Marketputer orchestrates multiple AI agents to automatically:
1. **Find trends** - Discovers trending topics from DEXScreener, Birdeye, RSS feeds, and X/Twitter
2. **Create content** - Generates creative briefs, captions, and meme images
3. **Broadcast** - Posts to Telegram and Farcaster channels

All powered by x402 micropayments on Solana - you only pay for what you use!

## Pipeline vs Agent Economy

**This example (Marketputer)** demonstrates a **pipeline pattern**:
- A single wallet (yours) pays agents sequentially
- Centralized control: Client → Agent 1 → Agent 2 → Agent 3
- Good for: Orchestrated workflows, predictable costs

**For agents paying other agents**, see the **[agent-economy](../agent-economy/README.md)** example:
- Agents have their own wallets and pay each other
- Decentralized economy: Agent → Agent → Agent
- Good for: Autonomous agent networks, agent-to-agent economy

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Solana wallet with SOL and USDC
- Memeputer CLI installed (see main repo README)

### Installation

```bash
# Install dependencies
pnpm install

# Install Memeputer CLI locally (from monorepo root)
pnpm add file:../../packages/cli

# Build
pnpm build
```

### Setup

1. **Create a brand config** - Copy `brands/brand-a/brand.config.json` and customize:
   ```bash
   cp brands/brand-a/brand.config.json my-brand.json
   ```

2. **Configure wallet** - Set up your Solana wallet:
   ```bash
   # Create ~/.memeputerrc
   echo '{"wallet": "/path/to/your/wallet.json"}' > ~/.memeputerrc
   
   # Verify it works
   memeputer balance
   ```

### Run a Campaign

```bash
# Run a single campaign
pnpm run --brand brands/brand-a/brand.config.json --budget 0.1

# Run with auto-approval (no prompts)
pnpm run:memeputer

# Run PayAI brand
pnpm run:payai

# Run in a loop (custom command)
pnpm run --brand brands/brand-a/brand.config.json --budget 1.0 --loop --delay 60000
```

### Options

- `--brand <path>` - Path to brand config JSON (required)
- `--budget <sol>` - Budget in SOL (required)
- `--channels <list>` - Channels to post to: `tg,fc` (default: `tg`)
- `--sources <list>` - Trend sources: `x,rss,dexscreener,birdeye` (default: `x`)
- `--max-items <n>` - Maximum trends to fetch (default: `20`)
- `--approve` - Auto-approve without prompts
- `--loop` - Run campaigns in a loop
- `--delay <ms>` - Delay between loop iterations (default: `30000`)
- `--mock` - Use mock mode (no API calls)

## Brand Configuration

Create a brand config JSON file with:

```json
{
  "name": "Your Brand",
  "personality": "fun, crypto-native, memes",
  "targetAudience": "Solana degens",
  "voice": "casual, humorous",
  "denyTerms": ["scam", "rug"],
  "requireDisclaimer": true,
  "brandAgentId": "your-brand-agent-id"
}
```

See `brands/brand-a/brand.config.json` for a complete example.

## How It Works

This is a **sequential pipeline** where your wallet pays each agent:

1. **Your wallet** pays **TrendPuter** to find trending topics
2. **Your wallet** pays **BriefPuter** to create a creative brief
3. **Your wallet** pays **PFPputer** to generate on-brand meme images
4. **Your wallet** pays **BroadcastPuter** to post to channels

Each step uses x402 micropayments - you only pay for successful operations.

**Note**: This is a pipeline pattern. For an example where agents pay other agents (agent-to-agent economy), see the [agent-economy](../agent-economy/README.md) example.

## Learn More

- [Memeputer CLI Documentation](../../README.md)
- [Memeputer Platform](https://memeputer.com)
- [Marketplace](https://marketplace.memeputer.com)

## License

MIT

