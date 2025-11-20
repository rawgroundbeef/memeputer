/**
 * Quick Agent Test Script
 * 
 * Test any agent command quickly with:
 *   pnpm test <agentId> <command> [params...]
 * 
 * Examples:
 *   pnpm test keywordputer extract_keywords
 *   pnpm test keywordputer extract_keywords '{"task":"test task"}'
 *   pnpm test promptputer enhance_prompt '{"basePrompt":"a cat"}'
 */

import { Memeputer } from "@memeputer/sdk";
import { loadConfig } from "./lib/config";
import { showPaymentDetails } from "./lib/payment";
import { loadWallet } from "./lib/wallet";
import { checkBalance } from "./lib/balance";
import { Connection } from "@solana/web3.js";

const config = loadConfig();

async function main() {
  // Parse arguments: <agentId> <command> [paramsJson]
  const agentId = process.argv[2];
  const command = process.argv[3];
  const paramsJson = process.argv[4];

  if (!agentId || !command) {
    console.error("Usage: pnpm test <agentId> <command> [paramsJson]");
    console.error("");
    console.error("Examples:");
    console.error('  pnpm test keywordputer extract_keywords');
    console.error('  pnpm test keywordputer extract_keywords \'{"task":"test task","maxKeywords":5}\'');
    console.error('  pnpm test promptputer enhance_prompt \'{"basePrompt":"a cat"}\'');
    console.error('  pnpm test trendputer discover_trends \'{"keywords":["crypto"],"maxResults":5}\'');
    process.exit(1);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Testing: ${agentId} → ${command}`);
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

  // Parse params if provided
  let params: any = {};
  if (paramsJson) {
    try {
      params = JSON.parse(paramsJson);
      console.log("📝 Parameters:");
      console.log(JSON.stringify(params, null, 2));
      console.log("");
    } catch (error) {
      console.error("❌ Failed to parse params JSON:", error);
      process.exit(1);
    }
  }

  try {
    console.log(`🚀 Calling ${agentId}.${command}...\n`);
    
    const result = await memeputer.command(agentId, command, params);
    
    console.log("\n✅ Response received:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Try to parse as JSON for pretty printing
    try {
      const parsed = JSON.parse(result.response);
      console.log(JSON.stringify(parsed, null, 2));
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

