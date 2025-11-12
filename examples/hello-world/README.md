# Hello World - Minimal Example

The **absolute minimum** code needed to call a Memeputer AI agent via x402 micropayments.

## What This Does

1. Loads your Solana wallet
2. Connects to Solana network
3. Calls the `memeputer` agent with "Hello"
4. Shows the response
5. Costs ~$0.01 USDC (one cent)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment (Optional)

The example will automatically use your default Solana CLI wallet at `~/.config/solana/id.json` if you don't set `MEMEPUTER_WALLET`.

To use a different wallet, copy the example environment file:

```bash
cp .env.example .env
```

Then edit `.env` and set `MEMEPUTER_WALLET` to your wallet file path:

```bash
# Use default Solana CLI wallet (leave empty)
MEMEPUTER_WALLET=

# Or specify a custom path
MEMEPUTER_WALLET=./wallet.json
# or
MEMEPUTER_WALLET=~/.config/solana/id.json
```

### 3. Set Up Your Wallet

You need a Solana wallet with USDC. Choose one:

**Option A: Use existing Phantom wallet**
```bash
# Export your Phantom wallet:
# 1. Open Phantom browser extension
# 2. Settings → Export Private Key
# 3. Save as wallet.json in this directory
```

**Option B: Create new wallet with Solana CLI**
```bash
# Install Solana CLI (if needed)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate new wallet
solana-keygen new --outfile wallet.json

# Fund with USDC (get address with: solana address -k wallet.json)
```

### 4. Run the Example

```bash
pnpm start
```

That's it! The example will:
- Load your wallet
- Call the agent
- Show the response
- Payment happens automatically via x402

## Common Wallet Locations

Solana wallets are typically stored in these locations:

- **Solana CLI default**: `~/.config/solana/id.json` (used automatically if no `MEMEPUTER_WALLET` is set)
- **Local project wallet**: `./wallet.json` (created in current directory)
- **Phantom exported**: `./phantom-wallet.json` (after exporting from Phantom)

## Customization

Edit `.env` file to customize:

```bash
# Use default Solana CLI wallet (leave empty)
MEMEPUTER_WALLET=

# Or specify custom wallet path
MEMEPUTER_WALLET=./wallet.json

# Change agent
MEMEPUTER_AGENT_ID=memeputer

# Change message
MEMEPUTER_MESSAGE=Hello
```

All configuration is done via environment variables (loaded from `.env` file).

## How It Works

The code follows this simple flow:

1. **Load wallet** - Reads your Solana keypair from file
2. **Connect** - Creates connection to Solana network
3. **Create client** - Initializes the API client
4. **Call agent** - `client.interact()` handles the entire x402 payment flow:
   - Makes initial request (gets 402 Payment Required)
   - Creates USDC payment transaction
   - Signs with your wallet
   - Sends payment via PayAI Facilitator ($0 gas fees!)
   - Gets AI response

All payment logic is handled automatically by the `AgentsApiClient`.

## Code Breakdown

The main file (`prompt.ts`) is now super clean:

```typescript
// Load wallet
const wallet = loadWallet(WALLET_PATH);

// Connect to Solana
const connection = new Connection(RPC_URL, "confirmed");

// Create client
const client = new AgentsApiClient(API_URL);

// Call agent (payment happens automatically!)
const result = await client.interact(AGENT_ID, MESSAGE, wallet, connection);
```

**Total: ~4 lines of core logic** - wallet loading, connection, client creation, and agent call.

Utility functions (path expansion, wallet loading) are in `lib/wallet.ts` to keep the main file minimal.

## Next Steps

- See `../marketputer/` for a full-featured example
- Check `packages/cli/` for the command-line tool
- Read the [main README](../../README.md) for more info

## Troubleshooting

**Error: Wallet file not found**
- The example defaults to `~/.config/solana/id.json` (standard Solana CLI location)
- If you don't have a wallet there, either:
  - Create one: `solana-keygen new` (saves to default location)
  - Or set `MEMEPUTER_WALLET` in `.env` to point to your wallet file
- Common locations:
  - `~/.config/solana/id.json` (Solana CLI default)
  - `./wallet.json` (local project wallet)

**Error: Insufficient USDC balance**
- Your wallet needs USDC (not SOL)
- Add USDC to your wallet address

**Error: Payment required**
- Check your USDC balance
- Ensure wallet has enough for the transaction (~$0.01 USDC)

