#!/bin/bash

# Quick test script for Agent Economy
# Make sure your backend is running on localhost:3006

set -e

echo "🧪 Testing Agent Economy"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wallet path is provided
if [ -z "$1" ]; then
    echo "Usage: ./test.sh <wallet-path> [api-base]"
    echo "Example: ./test.sh ~/.config/solana/id.json http://localhost:3006"
    exit 1
fi

WALLET_PATH=$1
API_BASE=${2:-"http://localhost:3006"}

echo -e "${BLUE}Configuration:${NC}"
echo "  Wallet: $WALLET_PATH"
echo "  API: $API_BASE"
echo ""

# Check if wallet exists
if [ ! -f "$WALLET_PATH" ]; then
    echo "❌ Error: Wallet file not found: $WALLET_PATH"
    exit 1
fi

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed"
    exit 1
fi

# Build if needed
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}Building...${NC}"
    pnpm build
fi

echo -e "${GREEN}Running test task...${NC}"
echo ""

# Run the test
pnpm start run \
    --task "Create a meme about Solana" \
    --budget 1.0 \
    --orchestrator-wallet "$WALLET_PATH" \
    --api-base "$API_BASE" \
    --rpc-url "https://api.devnet.solana.com"

echo ""
echo -e "${GREEN}✅ Test complete!${NC}"

