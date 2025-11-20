/**
 * Test 5: Mixed Format (Positional + Flags)
 * 
 * Tests: /enhance_prompt a peaceful landscape --style="minimalist" --tone="serene"
 * 
 * This tests if the backend can handle mixed format with positional argument
 * followed by CLI flags.
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
  console.log("Test 5: Mixed Format (Positional + Flags)");
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

  // Test: Send mixed format (positional + flags)
  const cliCommand = '/enhance_prompt a peaceful landscape --style="minimalist" --tone="serene"';
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
        if (parsed.style) {
          console.log(`   Style: ${parsed.style}`);
        }
        if (parsed.tone) {
          console.log(`   Tone: ${parsed.tone}`);
        }
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

