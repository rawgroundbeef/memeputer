#!/usr/bin/env tsx
/**
 * Generate a Base/EVM wallet for local testing
 * 
 * Usage:
 *   pnpm tsx scripts/generate-base-wallet.ts
 * 
 * Outputs:
 *   - Private key (keep this secret!)
 *   - Address (public address for receiving funds)
 *   - Saves to ~/.memeputer/base-wallet.json
 */

import { Wallet } from 'ethers';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Generate a random wallet
const wallet = Wallet.createRandom();

// Create directory if it doesn't exist
const configDir = join(homedir(), '.memeputer');
if (!existsSync(configDir)) {
  mkdirSync(configDir, { recursive: true });
}

// Save wallet to file
const walletPath = join(configDir, 'base-wallet.json');
const walletData = {
  address: wallet.address,
  privateKey: wallet.privateKey,
  mnemonic: wallet.mnemonic?.phrase,
};

writeFileSync(walletPath, JSON.stringify(walletData, null, 2));

console.log('✅ Base Wallet Generated!\n');
console.log('📁 Saved to:', walletPath);
console.log('\n📋 Wallet Details:');
console.log('   Address:', wallet.address);
console.log('   Private Key:', wallet.privateKey);
console.log('   Mnemonic:', wallet.mnemonic?.phrase);
console.log('\n⚠️  IMPORTANT: Keep your private key secret!');
console.log('\n💡 To use this wallet, add to your .env file:');
console.log('');
console.log('   MEMEPUTER_CHAIN=base');
console.log('   MEMEPUTER_WALLET_PRIVATE_KEY=' + wallet.privateKey);
console.log('');
console.log('   Or export in your shell:');
console.log('   export MEMEPUTER_CHAIN=base');
console.log('   export MEMEPUTER_WALLET_PRIVATE_KEY=' + wallet.privateKey);
console.log('\n💰 Fund this wallet on Base Sepolia testnet:');
console.log('   https://www.alchemy.com/faucets/base-sepolia');

