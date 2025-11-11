#!/usr/bin/env node
import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { getUsdcBalance } from 'memeputer/dist/lib/x402Client.js';

async function checkBalance() {
  // Load wallet from env
  let walletPath = process.env.MEMEPUTER_WALLET || process.env.ORCHESTRATOR_WALLET;
  
  if (!walletPath) {
    console.error('❌ MEMEPUTER_WALLET not set');
    process.exit(1);
  }

  // Expand tilde
  if (walletPath.startsWith('~/')) {
    walletPath = walletPath.replace('~', homedir());
  }

  // Load wallet
  let wallet: Keypair;
  try {
    if (!existsSync(walletPath)) {
      throw new Error(`Wallet file not found: ${walletPath}`);
    }
    const walletContent = readFileSync(walletPath, 'utf-8');
    const walletData = JSON.parse(walletContent);
    wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
  } catch (error) {
    console.error('❌ Failed to load wallet:', error);
    process.exit(1);
  }

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log('\n💰 Wallet Balance Check\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Wallet:', wallet.publicKey.toString());
  console.log('Network:', rpcUrl.includes('devnet') ? 'Devnet' : 'Mainnet');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Check SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey);
    const solAmount = solBalance / LAMPORTS_PER_SOL;
    console.log(`SOL Balance: ${solAmount.toFixed(4)} SOL`);
    
    if (solAmount < 0.01) {
      console.log('⚠️  Warning: Low SOL balance. Need at least ~0.002 SOL for token account initialization.');
    }

    // Check USDC balance
    const usdcBalance = await getUsdcBalance(connection, wallet);
    console.log(`USDC Balance: ${usdcBalance.toFixed(4)} USDC`);
    
    if (usdcBalance === 0) {
      console.log('⚠️  Warning: No USDC balance. The orchestrator agent needs USDC to pay other agents.');
      console.log('   Fund this wallet with USDC on devnet/mainnet.');
    }

    console.log('\n✅ Balance check complete!\n');
  } catch (error) {
    console.error('❌ Error checking balance:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.message.includes('token account')) {
      console.log('\n💡 Tip: The USDC token account may not be initialized.');
      console.log('   Transfer some USDC to this wallet to initialize it.');
    }
    process.exit(1);
  }
}

checkBalance();

