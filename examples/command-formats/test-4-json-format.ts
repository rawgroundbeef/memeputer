/**
 * Test 4: JSON Format (SDK Method)
 * 
 * Tests: Using SDK's command() method with structured parameters
 * 
 * This tests the standard JSON format that the SDK sends.
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
  console.log("Test 4: JSON Format (SDK Method)");
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

  // Test: Use SDK's command() method (sends JSON format)
  console.log(`📝 Using SDK command() method:`);
  console.log(`   memeputer.command('promptputer', 'enhance_prompt', {`);
  console.log(`     basePrompt: 'a space station',`);
  console.log(`     qualityModifiers: ['8K', 'cinematic', 'artstation'],`);
  console.log(`     style: 'photorealistic'`);
  console.log(`   })\n`);

  try {
    const result = await memeputer.command('promptputer', 'enhance_prompt', {
      basePrompt: 'a space station',
      qualityModifiers: ['8K', 'cinematic', 'artstation'],
      style: 'photorealistic',
      detailLevel: 'high',
      includeTechnicalSpecs: true,
    });
    
    console.log("\n✅ Response received:");
    console.log(`   ${result.response.substring(0, 200)}${result.response.length > 200 ? '...' : ''}\n`);
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(result.response);
      console.log("✅ Valid JSON response:");
      console.log(JSON.stringify(parsed, null, 2));
      if (parsed.enhancedPrompt) {
        console.log(`\n✅ Enhanced Prompt: ${parsed.enhancedPrompt.substring(0, 150)}...`);
        if (parsed.modifiersApplied) {
          console.log(`   Modifiers Applied: ${parsed.modifiersApplied.join(', ')}`);
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

