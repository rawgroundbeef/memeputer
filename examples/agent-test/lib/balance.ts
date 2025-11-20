import { Connection, Keypair } from "@solana/web3.js";
import { getUsdcBalance } from "@memeputer/sdk";

/**
 * Check wallet balance and exit if insufficient
 */
export async function checkBalance(
  wallet: Keypair,
  connection: Connection
): Promise<void> {
  console.log("💰 Checking wallet balance...");
  
  const balance = await getUsdcBalance(connection, wallet);
  console.log(`   Current balance: ${balance.toFixed(4)} USDC`);
  console.log(`   Wallet: ${wallet.publicKey.toBase58()}\n`);
  
  if (balance === 0) {
    console.error("❌ Error: Insufficient USDC balance");
    console.error(`   Your wallet has 0 USDC. Please fund your wallet with USDC to continue.`);
    console.error(`   Wallet address: ${wallet.publicKey.toBase58()}`);
    process.exit(1);
  }
  
  if (balance < 0.01) {
    console.warn(`⚠️  Warning: Low balance (${balance.toFixed(4)} USDC)`);
    console.warn(`   Typical agent interactions cost 0.01-0.10 USDC`);
    console.warn(`   You may not have enough for this interaction.\n`);
  }
}

