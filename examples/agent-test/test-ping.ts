/**
 * Test command without parameters (e.g., ping)
 * 
 * Usage:
 *   pnpm test:ping
 *   MEMEPUTER_API_URL=http://localhost:3007/x402 pnpm test:ping
 */

import { Memeputer } from "@memeputer/sdk";
import { loadConfig } from "./lib/config";
import { showPaymentDetails } from "./lib/payment";
import { loadWallet } from "./lib/wallet";
import { checkBalance } from "./lib/balance";
import { Connection } from "@solana/web3.js";

const config = loadConfig();

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Testing Command Without Parameters: ping");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  const wallet = loadWallet(config.walletPath);
  const connection = new Connection(config.rpcUrl, "confirmed");
  await checkBalance(wallet, connection);

  const memeputer = new Memeputer({
    apiUrl: config.apiUrl,
    chain: config.chain,
    wallet,
    connection,
    verbose: true,
  });

  try {
    console.log("🚀 Calling ping command (no parameters)...\n");
    
    // Test 1: Command without parameters
    const result = await memeputer.command('memeputer', 'ping');
    
    console.log("\n✅ Response received:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(result.response);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    showPaymentDetails(result);
    
    console.log("\n✅ Test completed successfully!");
    console.log("\n📋 Expected Request Body:");
    console.log('   { "command": "ping" }');
    console.log("   (No 'message' field should be sent)");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});

