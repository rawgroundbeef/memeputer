/**
 * Quick test for Keywordputer extract_keywords command
 * 
 * Usage:
 *   pnpm test:keywordputer
 * 
 * Uses production API by default. To test locally:
 *   MEMEPUTER_API_URL=http://localhost:3007/x402 pnpm test:keywordputer
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
  console.log("Testing Keywordputer → extract_keywords");
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

  // Test parameters
  const testParams = {
    task: "Find relevant topics and create a meme about them",
    context: "Creating content for Solana community",
    targetAudience: "Solana degens",
    contentGoal: "meme",
    maxKeywords: 10,
  };

  console.log("📝 Test Parameters:");
  console.log(JSON.stringify(testParams, null, 2));
  console.log("");

  try {
    console.log("🚀 Calling keywordputer.extract_keywords...\n");
    
    const result = await memeputer.command('keywordputer', 'extract_keywords', testParams);
    
    console.log("\n✅ Response received:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Try to parse as JSON for pretty printing
    try {
      const parsed = JSON.parse(result.response);
      console.log(JSON.stringify(parsed, null, 2));
      
      const keywords = parsed.data?.keywords || [];
      
      if (Array.isArray(keywords) && keywords.length > 0) {
        console.log(`\n✅ Extracted ${keywords.length} keywords:`);
        keywords.forEach((kw: string, idx: number) => {
          console.log(`   ${idx + 1}. ${kw}`);
        });
      } else {
        console.log(`\n⚠️  No keywords found in response`);
      }
    } catch {
      // Not JSON, print as-is
      console.log(result.response);
    }
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    showPaymentDetails(result);
    
    console.log("\n✅ Test completed successfully!");
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

