# Quick Start Guide

The fastest way to get started with Memeputer on Solana or Base.

## 1. Install Dependencies

```bash
pnpm install
```

## 2. Generate a Wallet

Choose your blockchain:

```bash
# Generate a Solana wallet (saves to ~/.config/solana/id.json)
pnpm run generate-solana-wallet

# OR generate a Base wallet (saves to ~/.memeputer/base-wallet.json)
pnpm run generate-base-wallet
```

## 3. Fund Your Wallet

### For Solana:
- **Devnet (testing):** `solana airdrop 1 YOUR_ADDRESS --url devnet`
- **Mainnet:** Buy SOL on any exchange, send to your address, then swap for USDC on [Jupiter](https://jup.ag)

### For Base:
- **Testnet:** Get Base Sepolia ETH from [Alchemy Faucet](https://www.alchemy.com/faucets/base-sepolia)
- **Mainnet:** Bridge funds to Base using [Base Bridge](https://bridge.base.org)

## 4. Run Hello World Example

```bash
cd examples/hello-world

# Run on Solana (default)
export MEMEPUTER_CHAIN=solana
pnpm run prompt "What's the weather?"

# OR run on Base
export MEMEPUTER_CHAIN=base
pnpm run prompt "What's the weather?"
```

## 5. Switch Chains Anytime

Just change one environment variable:

```bash
# Solana
export MEMEPUTER_CHAIN=solana
export MEMEPUTER_API_URL=http://localhost:3007/x402

# Base
export MEMEPUTER_CHAIN=base
export MEMEPUTER_API_URL=http://localhost:3007/x402
```

That's it! The SDK handles everything else automatically.

## Configuration Options

### Environment Variables

- `MEMEPUTER_API_URL` - API endpoint (default: `https://agents.memeputer.com/x402`)
- `MEMEPUTER_CHAIN` - Blockchain: `solana` (default) or `base`
- `MEMEPUTER_WALLET` - Path to wallet file (Solana)
- `MEMEPUTER_WALLET_PRIVATE_KEY` - Private key (Base/EVM)

### Config File (~/.memeputerrc)

```json
{
  "apiUrl": "https://agents.memeputer.com/x402",
  "chain": "solana",
  "wallet": "~/.config/solana/id.json"
}
```

## What Happens Next?

1. Your app calls an agent (e.g., `memeputer`)
2. Server returns `402 Payment Required` with payment details
3. SDK creates and signs a USDC payment transaction
4. Payment sent via **PayAI Facilitator** (you pay $0 gas!)
5. Server processes request and returns AI response

All payments are on-chain and instant. No accounts, no subscriptions.

## Need Help?

- **Documentation:** [packages/cli/README.md](./packages/cli/README.md)
- **Examples:** [examples/](./examples/)
- **Issues:** [GitHub Issues](https://github.com/rawgroundbeef/memeputer/issues)

