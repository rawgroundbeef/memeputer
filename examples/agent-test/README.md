# Agent Test

Quick test script for testing any agent command locally.

## Setup

```bash
cd examples/agent-test
pnpm install
```

## Usage

```bash
# Test any agent command
pnpm test <agentId> <command> [paramsJson]

# Examples:
pnpm test keywordputer extract_keywords
pnpm test keywordputer extract_keywords '{"task":"test task","maxKeywords":5}'
pnpm test promptputer enhance_prompt '{"basePrompt":"a cat"}'
pnpm test trendputer discover_trends '{"keywords":["crypto"],"maxResults":5}'
```

## Testing Commands

### Test Keywordputer
```bash
# Quick test with predefined params (uses production by default)
pnpm test:keywordputer

# Or test with custom params
pnpm test keywordputer extract_keywords '{"task":"Find relevant topics and create a meme about them"}'
```

### Test Command Without Parameters (ping)
```bash
# Test ping command (no parameters)
pnpm test:ping

# To test against localhost:
# export MEMEPUTER_API_URL="http://localhost:3007/x402"
# pnpm test:ping
```

**Expected Behavior:**
- SDK should send `{ "command": "ping" }` (no `message` field)
- Backend should handle the command correctly
- No errors about undefined message field

## Configuration

Uses the same config system as hello-world:
- Wallet: `MEMEPUTER_WALLET` env var or `~/.config/solana/id.json`
- API URL: `MEMEPUTER_API_URL` env var or defaults to production
- Chain: `MEMEPUTER_CHAIN` env var (default: `solana`)

## Examples

### Test Keywordputer
```bash
pnpm test keywordputer extract_keywords '{"task":"Create educational content about DeFi","maxKeywords":5}'
```

### Test Promptputer
```bash
pnpm test promptputer enhance_prompt '{"basePrompt":"a futuristic cityscape","style":"artistic"}'
```

### Test Trendputer
```bash
pnpm test trendputer discover_trends '{"keywords":["crypto","solana"],"maxResults":3}'
```

## What It Does

1. Loads your wallet and checks balance
2. Creates Memeputer SDK instance
3. Calls the specified agent command with provided params
4. Displays the response (pretty-printed if JSON)
5. Shows payment details

Perfect for quickly testing new agents or commands during development!

