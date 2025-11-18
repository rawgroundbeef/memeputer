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

import { Memeputer } from "@memeputer/sdk";
import { loadConfig } from "./lib/config";
import { showPaymentDetails } from "./lib/payment";
import { loadWallet } from "./lib/wallet";
import { checkBalance } from "./lib/balance";
import { Connection } from "@solana/web3.js";

// Load configuration
const config = loadConfig();

// Get message from command line argument or use config default
const message = process.argv[2] || config.message;

async function main() {
  console.log(`🔗 Chain: ${config.chain}`);
  console.log(`you: "${message}"\n`);

  let wallet;
  let connection;

  if (config.chain === 'solana') {
    // Step 1: Load Solana wallet and check balance
    wallet = loadWallet(config.walletPath);
    connection = new Connection(config.rpcUrl, "confirmed");
    
    console.log('💰 Checking wallet balance...');
    await checkBalance(wallet, connection);
  } else if (config.chain === 'base') {
    // Step 1: Load Base/EVM wallet
    const privateKey = process.env.MEMEPUTER_WALLET_PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error(
        'Base wallet not configured!\n' +
        '  Set MEMEPUTER_WALLET_PRIVATE_KEY in your .env file\n' +
        '  Run: pnpm run generate-base-wallet (from project root)'
      );
    }

    // Derive wallet address from private key to show user
    const { ethers } = await import('ethers');
    const evmWallet = new ethers.Wallet(privateKey);

    wallet = { privateKey };
    connection = null; // Base uses different provider
    
    console.log('💰 Using Base wallet');
    console.log('   Your Address:', evmWallet.address);
    console.log('   ⚠️  Make sure THIS address has USDC, not the payment recipient!');
  } else {
    throw new Error(`Unsupported chain: ${config.chain}. Use 'solana' or 'base'`);
  }

  // Step 2: Create Memeputer client with chain configuration
  const memeputer = new Memeputer({
    apiUrl: config.apiUrl,
    chain: config.chain,
    wallet,
    connection,
    verbose: true, // Enable verbose logging to see x402 protocol details
  });

  // Step 3: Prompt agent - Payment happens automatically via x402
  const result = await memeputer.prompt(config.agentId, message);

  // Step 4: Show agent response
  console.log(`\n${config.agentId}: "${result.response}"`);
  
  // Step 5: Show payment details
  showPaymentDetails(result);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
