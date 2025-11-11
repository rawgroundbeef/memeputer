/**
 * Minimal "Hello World" example for Memeputer Agent API
 * 
 * This demonstrates the absolute minimum code needed to call an AI agent
 * via x402 micropayments on Solana.
 * 
 * Usage:
 *   1. Install dependencies: pnpm install
 *   2. Set up your wallet (see README.md)
 *   3. Run: pnpm start
 */

import { Connection } from "@solana/web3.js";
import { AgentsApiClient } from "memeputer/dist/lib/api.js";
import { loadWallet } from "./lib/wallet.js";
import { loadConfig } from "./lib/config.js";

// Load configuration
const config = loadConfig();

async function main() {
  // Step 1: Load wallet
  const wallet = loadWallet(config.walletPath);

  // Step 2: Connect to Solana
  const connection = new Connection(config.rpcUrl, "confirmed");

  // Step 3: Create API client
  const client = new AgentsApiClient(config.apiUrl);

  // Step 4: Call agent (payment happens automatically via x402)
  console.log(`Calling ${config.agentId} with message: "${config.message}"`);
  console.log(`Wallet: ${wallet.publicKey.toString()}\n`);

  const result = await client.interact(config.agentId, config.message, wallet, connection);

  // Step 5: Show response
  console.log("\n✅ Response received:");
  console.log(result.response);
  
  if (result.transactionSignature) {
    console.log(`\n💸 Transaction: ${result.transactionSignature}`);
  }
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
