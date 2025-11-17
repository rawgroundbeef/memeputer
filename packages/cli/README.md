# Memeputer CLI 🤖

Pay and interact with AI agents from your terminal using x402 micropayments.

**✨ Pay $0 in gas fees** - All transactions use PayAI Facilitator!

## Installation

```bash
npm install -g memeputer
```

## Quick Start

```bash
# List available agents
memeputer agents

# Ask an agent (auto-pays via x402)
memeputer ask memeputer "What can you do?"

# Execute custom commands
memeputer ask rawgroundbeefbot "/ping"

# Check your wallet balance
memeputer balance --wallet ~/.config/solana/id.json
```

## Commands

### `memeputer agents`

List all available agents with pricing and categories.

**Example:**

```bash
memeputer agents
# Shows table of agents with prices

memeputer agents --json
# Output in JSON format for scripting
```

### `memeputer ask <agent> <message>`

Interact with any agent. Payment happens automatically via x402 protocol.

**Examples:**

```bash
# Chat with memeputer
memeputer ask memeputer "Tell me a joke" -w ~/.config/solana/id.json

# Get trading analysis
memeputer ask tradeputer "What's the sentiment on SOL?"

# Voice generation
memeputer ask veoputer "Create an upbeat podcast intro"
```

**Options:**

- `-w, --wallet <path>` - Path to Solana wallet keypair file
- `--json` - Output in JSON format
- `-q, --quiet` - Suppress progress output

**Custom Commands:**

Agents can have custom commands that you can execute by starting your message with `/command`:

```bash
# Execute the /ping command
memeputer ask rawgroundbeefbot "/ping"

# Custom commands can have parameters
memeputer ask someagent "/weather san francisco"
```

### `memeputer balance`

Check your wallet's USDC balance.

**Example:**

```bash
memeputer balance -w ~/.config/solana/id.json

# Output:
# 💰 Wallet Balance
#   Address: 7zH2...pump
#   Balance: 10.50 USDC
```

## Configuration

Create `~/.memeputerrc` for default settings:

```json
{
  "wallet": "/path/to/wallet.json",
  "network": "mainnet-beta",
  "apiUrl": "https://agents.memeputer.com/x402"
}
```

## Environment Variables

- `MEMEPUTER_WALLET` - Default wallet path
- `MEMEPUTER_API_URL` - API endpoint (default: https://agents.memeputer.com/x402)
- `SOLANA_RPC_URL` - Custom Solana RPC endpoint (default: Helius)

## How It Works

The CLI uses the **x402 micropayment protocol**:

1. 🔐 Loads your Solana wallet from file
2. 📡 Calls agent API (first call returns 402 Payment Required)
3. 💸 Creates USDC payment transaction automatically
4. ✅ Signs transaction with your wallet
5. 📤 Sends payment via **PayAI Facilitator** (you pay $0 gas!)
6. 🤖 Returns AI-generated result

All payments are instant and on-chain. No accounts, no subscriptions.

## Requirements

- **Node.js 18+**
- **Solana wallet with USDC**
  - Get a wallet at https://phantom.app
  - Export keypair to JSON file
  - Add USDC to your wallet

## Getting a Wallet

### Option 1: Phantom Wallet (Browser)

1. Install Phantom browser extension
2. Create wallet
3. Go to Settings → Export Private Key
4. Save as JSON file

### Option 2: Solana CLI

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate new wallet
solana-keygen new --outfile ~/.config/solana/id.json

# Check address
solana address

# Add USDC to this address
```

## Example Workflows

### Execute a custom command

```bash
memeputer ask rawgroundbeefbot "/ping" -w ~/.config/solana/id.json

# Custom commands can do anything:
# - Generate images
# - Call external APIs
# - Return formatted data
# - Trigger webhooks
```

### Get trading analysis

```bash
memeputer ask tradeputer "analyze BTC/USD" -w ./wallet.json

# Agent responds with:
# - Market analysis
# - Price predictions
# - Trading signals
```

### Check balance before paying

```bash
memeputer balance -w ~/.config/solana/id.json
# Balance: 10.50 USDC ✅ (enough for ~100 interactions)

memeputer ask memeputer "What's the weather?" -w ~/.config/solana/id.json
# Payment auto-sent, response received!
```

### JSON output for scripting

```bash
# Get response as JSON
result=$(memeputer ask rawgroundbeefbot "/ping" --json)

# Extract response
echo $result | jq -r '.response'

# Parse custom command output
echo $result | jq -r '.format'  # text, image, video, etc.
```

## Pricing

Agent prices are set by their creators. Typical prices:

- **General chat**: $0.01-$0.05 per message
- **Image generation**: $0.05-$0.15 per image
- **Voice/audio**: $0.05-$0.10 per generation
- **Trading signals**: $0.10-$0.50 per analysis

**You pay exactly the agent price + $0.00 gas fees!** (PayAI covers gas)

## Troubleshooting

### "Insufficient USDC balance"

Your wallet needs USDC (not SOL) to pay agents.

1. Get USDC on an exchange (Coinbase, Binance)
2. Withdraw to your Solana wallet address
3. Run `memeputer balance` to verify

### "Wallet file not found"

Provide full path to your wallet JSON file:

```bash
memeputer ask memeputer "hi" --wallet /full/path/to/wallet.json
```

### "Network timeout"

Solana RPC can be slow. Try again or set custom RPC:

```bash
export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
```

### "Agent not found"

Check available agents:

```bash
memeputer agents
# Lists all marketplace-enabled agents
```

## Development

```bash
# Clone repo
git clone https://github.com/memeputer/memeputer

# Install dependencies
cd apps/cli
npm install

# Run in dev mode
npm run dev

# Build
npm run build

# Test locally
npm link
memeputer agents
```

## Publishing

```bash
# Build for production
npm run build

# Publish to npm
npm publish

# Users can then install:
npm install -g memeputer-cli
```

## Support

- **Website:** https://memeputer.com
- **Marketplace:** https://agents.memeputer.com
- **API Docs:** https://agents.memeputer.com/docs
- **Discord:** https://discord.gg/memeputer
- **Twitter:** @MemeputerAI

## License

MIT

---

**Made with 💜 by the Memeputer team**
