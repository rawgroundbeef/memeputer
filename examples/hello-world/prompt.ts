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

import memeputer from "@memeputer/sdk";
import { loadConfig } from "./lib/config";
import { showPaymentDetails } from "./lib/payment";

// Load configuration
const config = loadConfig();

// Enable verbose logging to see x402 protocol details
memeputer.enableVerbose();

// Get message from command line argument or use config default
const message = process.argv[2] || config.message;

async function main() {
  // Step 1: Show user message
  console.log(`you: "${message}"`);

  // Step 2: Prompt agent (wallet & connection auto-detected!)
  // Payment happens automatically via x402
  const result = await memeputer.prompt(config.agentId, message);

  // Step 3: Show agent response
  console.log(`\n${config.agentId}: "${result.response}"`);
  
  // Step 4: Show payment details
  showPaymentDetails(result);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
