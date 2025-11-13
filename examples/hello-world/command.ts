/**
 * Minimal "Command" example - demonstrates using commands
 * 
 * This shows the simplest way to execute a command on an agent.
 * 
 * Usage:
 *   pnpm command [agent]
 *   pnpm command rawgroundbeefbot
 */

import memeputer from "@memeputer/sdk";
import { loadConfig } from "./lib/config";
import { showPaymentDetails } from "./lib/payment";

// Load configuration
const config = loadConfig();

// Enable verbose logging to see x402 protocol details
memeputer.enableVerbose();

async function main() {
  // Execute ping command (same as: memeputer command memeputer ping)
  const agentId = process.argv[2] || config.agentId;
  console.log(`you: /ping`);

  // Use command method (matches prompt signature: command(agentId, commandName, params?))
  // Same as: memeputer command memeputer ping
  const result = await memeputer.command(agentId, "ping");

  // Show response
  if (result.response && result.response.trim()) {
    console.log(`\n${agentId}: "${result.response}"`);
  } else {
    console.log(`\n${agentId}: (command executed, but no text response)`);
    console.log(`   Note: Some commands may not return text responses.`);
  }
  
  // Show payment details
  showPaymentDetails(result);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});

