# Integration Test - Command Formats

Integration testing suite for command format parsing. Tests various input formats (CLI strings vs JSON) to ensure the backend correctly parses different command formats that users might input.

## Purpose

These scripts test whether the backend can parse different CLI format strings that users might type in x402scan's single text box interface. This ensures the `enhance_prompt` command works regardless of how users format their input.

## Setup

1. Install dependencies:
   ```bash
   cd examples/integration-test-command-formats
   pnpm install
   ```

2. Configure your wallet (same as hello-world example):
   - Set `MEMEPUTER_WALLET` environment variable, or
   - Place your wallet at `~/.config/solana/id.json`

3. Set API URL (optional):
   ```bash
   export MEMEPUTER_API_URL="https://agents.memeputer.com/x402"
   ```

## Test Scripts

### Test 1: Single Argument (No Quotes)
```bash
pnpm test:1
```
**Tests:** `/enhance_prompt a cyberpunk samurai`

Verifies that a simple positional argument without quotes is parsed correctly as `basePrompt`.

---

### Test 2: Single Argument (With Quotes)
```bash
pnpm test:2
```
**Tests:** `/enhance_prompt "a futuristic cityscape at sunset"`

Verifies that quoted positional arguments are parsed correctly and quotes are stripped.

---

### Test 3: Multiple Arguments (CLI Flags)
```bash
pnpm test:3
```
**Tests:** `/enhance_prompt --basePrompt="a cat wearing sunglasses" --style="artistic" --detailLevel="high"`

Verifies that CLI flags in `--flag=value` format are parsed correctly.

---

### Test 4: JSON Format (SDK Method)
```bash
pnpm test:4
```
**Tests:** Using SDK's `command()` method with structured parameters

This is the standard format that the SDK uses. This should always work.

---

### Test 5: Mixed Format (Positional + Flags)
```bash
pnpm test:5
```
**Tests:** `/enhance_prompt a peaceful landscape --style="minimalist" --tone="serene"`

Verifies that mixed format (positional argument + flags) is handled correctly.

---

## Run All Tests

```bash
pnpm test:all
```

This runs all test scripts sequentially.

## Expected Results

### ✅ Should Work
- **Test 4** (JSON format via SDK) - This is the standard format
- Any test that sends JSON string directly

### ❓ Depends on Backend Support
- **Test 1-3, 5** (CLI format strings) - Requires backend to parse CLI format and convert to JSON

## What Each Test Does

Each test script:
1. Loads wallet and checks balance
2. Creates a Memeputer SDK instance
3. Sends the command in the specified format
4. Displays the response
5. Attempts to parse response as JSON
6. Shows payment details

## Understanding the Results

### Success Indicators
- ✅ Response received without errors
- ✅ Response is valid JSON
- ✅ Response contains `enhancedPrompt` field
- ✅ Enhanced prompt is actually enhanced (longer/more detailed than input)

### Failure Indicators
- ❌ Error parsing command
- ❌ Error response from backend
- ❌ Response is not JSON when expected
- ❌ Missing `enhancedPrompt` field

## Notes

- Each test costs ~$0.05 USDC (check current pricing)
- Tests use verbose logging to show the exact HTTP request/response
- All tests use the `promptputer` agent
- CLI format tests use `prompt()` method to send raw strings
- JSON format test uses `command()` method (standard SDK usage)

## Troubleshooting

### "No private key found"
- Make sure your wallet is configured (see Setup)

### "Insufficient balance"
- Add USDC to your Solana wallet

### "Command not found" or parsing errors
- The backend may not support CLI format parsing yet
- Test 4 (JSON format) should always work

### Response is not JSON
- Some backends may return plain text instead of JSON
- Check if the response contains the enhanced prompt anyway

