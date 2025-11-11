# Marketputer

An example application demonstrating how to compose multiple Memeputer agents into a complete marketing automation pipeline.

## What It Does

Marketputer orchestrates multiple AI agents to automatically:
1. **Find trends** - Discovers trending topics from DEXScreener, Birdeye, RSS feeds, and X/Twitter
2. **Create content** - Generates creative briefs, captions, and meme images
3. **Broadcast** - Posts to Telegram and Farcaster channels

All powered by x402 micropayments on Solana - you only pay for what you use!

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Yarn or npm
- Solana wallet with SOL and USDC
- Memeputer CLI installed (see main repo README)

### Installation

```bash
# Install dependencies
yarn install

# Install Memeputer CLI locally (from monorepo root)
yarn add file:../../packages/cli

# Build
yarn build
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
yarn start run --brand brands/brand-a/brand.config.json --budget 0.1

# Run with auto-approval (no prompts)
yarn start run --brand brands/brand-a/brand.config.json --budget 0.1 --approve

# Run in a loop
yarn start run --brand brands/brand-a/brand.config.json --budget 1.0 --loop --delay 60000
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

1. **TrendPuter** finds trending topics
2. **BriefPuter** creates a creative brief from trends + brand profile
3. **PFPputer** generates on-brand meme images
4. **BroadcastPuter** posts to channels

Each step uses x402 micropayments - you only pay for successful operations.

## Learn More

- [Memeputer CLI Documentation](../../README.md)
- [Memeputer Platform](https://memeputer.com)
- [Marketplace](https://marketplace.memeputer.com)

## License

MIT

