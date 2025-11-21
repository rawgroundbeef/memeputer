/**
 * Test 2: Single Argument (With Quotes)
 * 
 * Tests: /enhance_prompt "a futuristic cityscape at sunset"
 * 
 * This tests if the backend can parse a quoted positional argument
 * and properly strip the quotes.
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
  console.log("Test 2: Single Argument (With Quotes)");
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

  // Test: Send CLI format string with quotes
  const cliCommand = '/enhance_prompt "a futuristic cityscape at sunset"';
  console.log(`📝 Sending CLI format:`);
  console.log(`   ${cliCommand}\n`);

  try {
    const result = await memeputer.prompt('promptputer', cliCommand);
    
    console.log("\n✅ Response received:");
    console.log(`   ${result.response.substring(0, 200)}${result.response.length > 200 ? '...' : ''}\n`);
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(result.response);
      console.log("✅ Valid JSON response:");
      console.log(JSON.stringify(parsed, null, 2));
      if (parsed.enhancedPrompt) {
        console.log(`\n✅ Enhanced Prompt: ${parsed.enhancedPrompt.substring(0, 150)}...`);
      }
    } catch {
      console.log("⚠️  Response is not JSON (may be plain text)");
    }
    
    showPaymentDetails(result);
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});

