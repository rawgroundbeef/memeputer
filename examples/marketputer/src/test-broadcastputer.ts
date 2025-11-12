#!/usr/bin/env node
/**
 * Test BroadcastPuter in isolation
 * Tests the post_telegram command to verify server-side changes work
 */
import 'dotenv/config';
import { Command } from 'commander';
import { Connection, Keypair } from '@solana/web3.js';
import { AgentsApiClient, InteractionResult } from '@memeputer/sdk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Extend InteractionResult to include x402Receipt
interface InteractionResultWithReceipt extends InteractionResult {
  x402Receipt?: {
    amountPaidUsdc: number;
    amountPaidMicroUsdc: number;
    payTo: string;
    transactionSignature: string;
    payer: string;
    merchant: string;
    timestamp: string;
  };
  x402Quote?: {
    amountQuotedUsdc: number;
    amountQuotedMicroUsdc: number;
    maxAmountRequired: number;
  };
}

const program = new Command();

program
  .name('test-broadcastputer')
  .description('Test BroadcastPuter post_telegram command in isolation')
  .option('-w, --wallet <path>', 'Path to wallet keypair JSON file', join(process.cwd(), 'wallet.json'))
  .option('--api-base <url>', 'API base URL', process.env.MEMEPUTER_API_URL || 'http://localhost:3006')
  .option('--rpc-url <url>', 'Solana RPC URL', process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com')
  .option('--chat-id <id>', 'Telegram chat ID', process.env.TELEGRAM_CHAT_ID || process.env.MEMEPUTER_TELEGRAM_CHAT_ID || '')
  .option('--caption <text>', 'Caption text to post', 'Test post from BroadcastPuter test script 🚀')
  .option('--image-url <url>', 'Image URL to post', 'https://via.placeholder.com/800x600/4A90E2/FFFFFF?text=Test+Image')
  .action(async (opts) => {
    try {
      // Load wallet
      const walletPath = opts.wallet.startsWith('~/') 
        ? opts.wallet.replace('~', homedir())
        : opts.wallet;
      
      if (!existsSync(walletPath)) {
        console.error(`❌ Wallet not found: ${walletPath}`);
        process.exit(1);
      }

      const walletContent = readFileSync(walletPath, 'utf-8');
      const walletData = JSON.parse(walletContent);
      const walletKeypair = Keypair.fromSecretKey(new Uint8Array(walletData));

      // Setup connection
      const connection = new Connection(opts.rpcUrl, 'confirmed');
      const apiClient = new AgentsApiClient(opts.apiBase);

      // Check chat ID
      if (!opts.chatId) {
        console.error('❌ Telegram chat ID required');
        console.error('   Set TELEGRAM_CHAT_ID or MEMEPUTER_TELEGRAM_CHAT_ID env var, or use --chat-id');
        process.exit(1);
      }

      console.log('\n🧪 Testing BroadcastPuter');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`API Base: ${opts.apiBase}`);
      console.log(`RPC URL: ${opts.rpcUrl}`);
      console.log(`Wallet: ${walletKeypair.publicKey.toString()}`);
      console.log(`Chat ID: ${opts.chatId}`);
      console.log(`Caption: ${opts.caption}`);
      console.log(`Image URL: ${opts.imageUrl}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('📤 Calling BroadcastPuter with post_telegram command...');
      
      const message = JSON.stringify({
        command: 'post_telegram',
        chatId: opts.chatId,
        caption: opts.caption,
        imageUrl: opts.imageUrl,
      });

      console.log(`\nRequest payload:`);
      console.log(JSON.stringify(JSON.parse(message), null, 2));

      const result = await apiClient.interact(
        'broadcastputer',
        message,
        walletKeypair,
        connection
      ) as InteractionResultWithReceipt;

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Response received');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Payment info
      if (result.transactionSignature) {
        console.log('💸 Payment:');
        console.log(`   Transaction: ${result.transactionSignature}`);
        console.log(`   🔗 View on Solscan: https://solscan.io/tx/${result.transactionSignature}`);
        
        if (result.x402Quote) {
          console.log(`   Amount quoted: ${result.x402Quote.amountQuotedUsdc.toFixed(4)} USDC`);
        }
        
        if (result.x402Receipt) {
          console.log(`   Amount paid: ${result.x402Receipt.amountPaidUsdc.toFixed(4)} USDC`);
          console.log(`   ✅ Payment confirmed`);
        }
      }

      // Response
      console.log('\n📥 Response:');
      console.log(`   Format: ${result.format || 'text'}`);
      console.log(`   Length: ${result.response.length} characters`);
      
      // Try to parse JSON response
      try {
        const parsed = JSON.parse(result.response);
        console.log('\n   Parsed JSON:');
        console.log(JSON.stringify(parsed, null, 2));
        
        if (parsed.messageLink || parsed.data?.messageLink) {
          const link = parsed.messageLink || parsed.data.messageLink;
          console.log(`\n   ✅ Telegram message link: ${link}`);
        } else {
          console.log('\n   ⚠️  No messageLink in response');
        }
      } catch {
        // Not JSON, show raw response
        console.log('\n   Raw response:');
        if (result.response.length < 500) {
          console.log(`   ${result.response}`);
        } else {
          console.log(`   ${result.response.substring(0, 500)}...`);
          console.log(`   ... (${result.response.length - 500} more characters)`);
        }
        
        // Check if it's a URL
        if (result.response.includes('http')) {
          console.log(`\n   ✅ Response appears to be a URL: ${result.response.trim()}`);
        }
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Test complete');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
      console.error('\n❌ Error:');
      console.error(error instanceof Error ? error.message : error);
      if (error instanceof Error && error.stack) {
        console.error('\nStack:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();

