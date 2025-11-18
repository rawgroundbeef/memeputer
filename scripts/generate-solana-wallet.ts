#!/usr/bin/env tsx
/**
 * Generate a Solana wallet for local testing
 * 
 * Usage:
 *   pnpm tsx scripts/generate-solana-wallet.ts
 * 
 * Outputs:
 *   - Public key (address)
 *   - Secret key (keep this secret!)
 *   - Saves to ~/.config/solana/id.json (standard Solana CLI location)
 */

import { Keypair } from '@solana/web3.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Generate a random keypair
const keypair = Keypair.generate();

// Create Solana config directory if it doesn't exist
const solanaDir = join(homedir(), '.config', 'solana');
if (!existsSync(solanaDir)) {
  mkdirSync(solanaDir, { recursive: true });
}

// Save wallet to standard Solana CLI location
const walletPath = join(solanaDir, 'id.json');
const secretKeyArray = Array.from(keypair.secretKey);

// Check if wallet already exists
if (existsSync(walletPath)) {
  console.log('⚠️  Warning: Wallet already exists at', walletPath);
  console.log('   Saving backup to id-backup.json\n');
  
  // Backup existing wallet
  const backupPath = join(solanaDir, 'id-backup.json');
  const existingWallet = require(walletPath);
  writeFileSync(backupPath, JSON.stringify(existingWallet));
}

writeFileSync(walletPath, JSON.stringify(secretKeyArray));

console.log('✅ Solana Wallet Generated!\n');
console.log('📁 Saved to:', walletPath);
console.log('\n📋 Wallet Details:');
console.log('   Public Key (Address):', keypair.publicKey.toString());
console.log('\n⚠️  IMPORTANT: Keep your secret key safe!');
console.log('   Secret key saved to:', walletPath);
console.log('\n💡 To use this wallet, add to your .env file:');
console.log('');
console.log('   MEMEPUTER_CHAIN=solana');
console.log('   MEMEPUTER_WALLET=' + walletPath);
console.log('');
console.log('   Or export in your shell:');
console.log('   export MEMEPUTER_CHAIN=solana');
console.log('   export MEMEPUTER_WALLET=' + walletPath);
console.log('\n💰 Fund this wallet on Solana devnet:');
console.log('   solana airdrop 1 ' + keypair.publicKey.toString() + ' --url devnet');
console.log('\n💰 Or get mainnet SOL:');
console.log('   https://phantom.app (buy/transfer SOL)');
console.log('   Then swap for USDC on Jupiter: https://jup.ag');

