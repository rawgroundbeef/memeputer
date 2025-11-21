# Integration Test

Integration testing suite for agent commands. Test all agents and their commands to verify end-to-end functionality.

## Setup

```bash
cd examples/integration-test
pnpm install
```

## Usage

### Test All Agents and Commands
```bash
# Test everything
pnpm test:all
```

### Test All Commands for an Agent
```bash
# Test all keywordputer commands
pnpm test:keywordputer

# Test all trendputer commands
pnpm test:trendputer

# Test all promptputer commands
pnpm test:promptputer

# Test all memeputer commands
pnpm test:memeputer
```

### Test Specific Command
```bash
# Test specific command with default params
pnpm test:keywordputer:keywords
pnpm test:trendputer:select_best_trend
pnpm test:promptputer:enhance_prompt
pnpm test:memeputer:ping
```

### Test with Custom Parameters
```bash
# Generic format: pnpm test <agentId> <command> [paramsJson]
pnpm test keywordputer keywords '{"text":"test task","maxKeywords":5}'
pnpm test trendputer select_best_trend '{"trendTitles":["NFL","Crypto"],"task":"test"}'
pnpm test promptputer enhance_prompt '{"basePrompt":"a cat"}'
```

## Available Agents and Commands

- **keywordputer**
  - `keywords` - Extract keywords from text

- **trendputer**
  - `discover_trends` - Discover trending topics
  - `select_best_trend` - Select best trend from a list

- **promptputer**
  - `enhance_prompt` - Enhance image generation prompts

- **memeputer**
  - `ping` - Simple ping command (no params)

## Configuration

Uses the same config system as hello-world:
- Wallet: `MEMEPUTER_WALLET` env var or `~/.config/solana/id.json`
- API URL: `MEMEPUTER_API_URL` env var or defaults to production
- Chain: `MEMEPUTER_CHAIN` env var (default: `solana`)

## Examples

### Test All Commands for Keywordputer
```bash
pnpm test:keywordputer
```

### Test Specific Command
```bash
pnpm test:trendputer:select_best_trend
```

### Test with Custom Parameters
```bash
pnpm test keywordputer keywords '{"text":"Create educational content about DeFi","maxKeywords":5}'
```

### Test Against Localhost
```bash
export MEMEPUTER_API_URL="http://localhost:3007/x402"
pnpm test:trendputer:select_best_trend
```

## What It Does

This integration test suite verifies end-to-end functionality:

1. **Wallet Setup**: Loads your wallet and checks balance
2. **SDK Initialization**: Creates Memeputer SDK instance
3. **Command Execution**: Calls the specified agent command with provided params (or defaults)
4. **Payment Flow**: Handles x402 payment flow automatically
5. **Response Validation**: Displays the response (pretty-printed if JSON)
6. **Payment Details**: Shows transaction details and explorer links

Perfect for:
- **Development**: Quickly test new agents or commands during development
- **CI/CD**: Run integration tests before deployment
- **Verification**: Ensure agents work correctly after backend changes

## Adding New Test Cases

Edit `test.ts` and add to `AGENT_TEST_CASES`:

```typescript
const AGENT_TEST_CASES: Record<string, Record<string, any>> = {
  // ... existing agents ...
  newagent: {
    newcommand: {
      param1: "value1",
      param2: "value2",
    },
  },
};
```

Then add npm scripts in `package.json`:
```json
{
  "scripts": {
    "test:newagent": "tsx test.ts newagent",
    "test:newagent:newcommand": "tsx test.ts newagent newcommand"
  }
}
```
