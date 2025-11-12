#!/usr/bin/env node
/**
 * Test CaptionPuter in isolation
 * 
 * This script tests CaptionPuter's generate_captions command
 * without running the full orchestrator workflow.
 */

import 'dotenv/config';
import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join, homedir } from 'path';
import { Keypair, Connection } from '@solana/web3.js';
import { AgentsApiClient, InteractionResult } from '@memeputer/sdk';
import { BrandProfileSchema } from './types.js';

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
  .name('test-captionputer')
  .description('Test CaptionPuter in isolation')
  .option('--wallet <path>', 'Path to wallet JSON file', 'wallet.json')
  .option('--api-base <url>', 'API base URL', process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL || 'https://agents.api.memeputer.com')
  .option('--rpc-url <url>', 'Solana RPC URL', process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com')
  .option('--image-description <text>', 'Image description from ImageDescripterPuter')
  .option('--image-prompt <text>', 'Image generation prompt used')
  .option('--trend-title <text>', 'Trend title', 'Digital Activism Through Meme Culture')
  .option('--trend-summary <text>', 'Trend summary', 'Memes are becoming powerful tools for activism')
  .option('--brief-angle <text>', 'Creative brief angle')
  .option('--brand-agent-id <uuid>', 'Brand agent ID (UUID)')
  .option('--brand <path>', 'Path to brand JSON file (e.g., brands/memeputer.json)')
  .option('--num-variants <number>', 'Number of caption variants to generate', '3')
  .option('--prompt-template <text>', 'Custom prompt template instructions for CaptionPuter (overrides brand file)')
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

      console.log('\n🧪 Testing CaptionPuter');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`API Base: ${opts.apiBase}`);
      console.log(`RPC URL: ${opts.rpcUrl}`);
      console.log(`Wallet: ${walletKeypair.publicKey.toString()}`);
      console.log(`Image Description: ${opts.imageDescription ? opts.imageDescription.substring(0, 100) + '...' : 'Not provided'}`);
      console.log(`Image Prompt: ${opts.imagePrompt ? opts.imagePrompt.substring(0, 100) + '...' : 'Not provided'}`);
      console.log(`Trend: ${opts.trendTitle}`);
      console.log(`Brand Agent ID: ${opts.brandAgentId || 'Not provided'}`);
      console.log(`Brand File: ${opts.brand || 'Not provided'}`);
      console.log(`Number of Variants: ${opts.numVariants}`);

      // Load brand profile if provided
      let brandProfile: any = null;
      if (opts.brand) {
        try {
          let brandPath = opts.brand.startsWith('~/') 
            ? opts.brand.replace('~', homedir())
            : opts.brand;
          
          if (!existsSync(brandPath)) {
            // Try relative to brands directory
            const brandsPath = join(process.cwd(), 'brands', brandPath);
            if (existsSync(brandsPath)) {
              brandPath = brandsPath;
            } else {
              // Try as-is relative to current directory
              const currentDirPath = join(process.cwd(), brandPath);
              if (existsSync(currentDirPath)) {
                brandPath = currentDirPath;
              }
            }
          }
          
          if (existsSync(brandPath)) {
            const brandContent = readFileSync(brandPath, 'utf-8');
            brandProfile = BrandProfileSchema.parse(JSON.parse(brandContent));
            console.log(`✅ Loaded brand profile from: ${brandPath}`);
          } else {
            console.warn(`⚠️  Brand file not found: ${opts.brand}`);
          }
        } catch (error) {
          console.warn(`⚠️  Failed to load brand profile: ${error instanceof Error ? error.message : error}`);
        }
      }

      // Build payload
      const payload: any = {
        imageDescription: opts.imageDescription || 'A minimalist logo design consisting of three layered squares of varying shades of blue.',
        imagePrompt: opts.imagePrompt || null,
        trendItem: {
          title: opts.trendTitle,
          summary: opts.trendSummary,
          source: 'TEST',
        },
        brief: opts.briefAngle ? {
          angle: opts.briefAngle,
        } : null,
        numVariants: parseInt(opts.numVariants) || 3,
      };

      // Add customInstructions - prioritize CLI option, then brand file, then nothing
      if (opts.promptTemplate) {
        payload.customInstructions = opts.promptTemplate;
        console.log(`Using custom prompt template from CLI: ${opts.promptTemplate.substring(0, 80)}${opts.promptTemplate.length > 80 ? '...' : ''}`);
      } else if (brandProfile?.captionPuterOptions?.promptTemplate) {
        payload.customInstructions = brandProfile.captionPuterOptions.promptTemplate;
        console.log(`Using prompt template from brand file: ${brandProfile.captionPuterOptions.promptTemplate.substring(0, 80)}${brandProfile.captionPuterOptions.promptTemplate.length > 80 ? '...' : ''}`);
      }
      
      // Add brand agent ID or brand profile (required by CaptionPuter)
      if (opts.brandAgentId) {
        payload.brandAgentId = opts.brandAgentId;
        console.log(`Using brand agent ID: ${opts.brandAgentId}`);
      } else if (brandProfile) {
        // Use loaded brand profile
        if (brandProfile.brandAgentId) {
          payload.brandAgentId = brandProfile.brandAgentId;
          console.log(`Using brand agent ID from brand file: ${brandProfile.brandAgentId}`);
        } else {
          payload.brandProfile = brandProfile;
          console.log(`Using brand profile from file: ${brandProfile.brandName || 'Custom'}`);
        }
      } else {
        // Default brand profile if nothing provided
        payload.brandProfile = {
          brandName: 'Memeputer',
          personality: 'fun, crypto-native, memes',
          targetAudience: 'Solana degens',
          voice: 'casual, humorous',
          denyTerms: [],
        };
        console.log('Using default brand profile: Memeputer');
      }

      const message = JSON.stringify({
        command: 'generate_captions',
        ...payload,
      });

      console.log('\n📤 Calling CaptionPuter with generate_captions command...');
      console.log('\nRequest payload:');
      console.log(JSON.stringify(payload, null, 2));

      const result = await apiClient.interact(
        'captionputer',
        message,
        walletKeypair,
        connection
      ) as InteractionResultWithReceipt;

      console.log('\n✅ Response received!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Payment details
      if (result.x402Quote) {
        console.log('\n💰 Payment Quote:');
        console.log(`   Amount Quoted: ${result.x402Quote.amountQuotedUsdc?.toFixed(4) || result.x402Quote.amountQuotedUsdc || 'N/A'} USDC`);
        if (result.x402Quote.maxAmountRequired !== undefined) {
          const maxAmount = typeof result.x402Quote.maxAmountRequired === 'number' 
            ? result.x402Quote.maxAmountRequired.toFixed(4)
            : result.x402Quote.maxAmountRequired;
          console.log(`   Max Amount Required: ${maxAmount} USDC`);
        }
      }

      if (result.x402Receipt) {
        console.log('\n💸 Payment Receipt:');
        console.log(`   Amount Paid: ${result.x402Receipt.amountPaidUsdc.toFixed(4)} USDC`);
        console.log(`   Transaction: ${result.x402Receipt.transactionSignature}`);
        console.log(`   Solscan: https://solscan.io/tx/${result.x402Receipt.transactionSignature}`);
        console.log(`   From: ${result.x402Receipt.payer}`);
        console.log(`   To: ${result.x402Receipt.payTo}`);
        console.log(`   Solscan (From): https://solscan.io/account/${result.x402Receipt.payer}`);
        console.log(`   Solscan (To): https://solscan.io/account/${result.x402Receipt.payTo}`);
      }

      if (result.transactionSignature) {
        console.log(`\n🔗 Transaction: ${result.transactionSignature}`);
        console.log(`   Solscan: https://solscan.io/tx/${result.transactionSignature}`);
      }

      // Parse and display captions
      console.log('\n📄 Response:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      try {
        const parsed = JSON.parse(result.response);
        console.log(JSON.stringify(parsed, null, 2));
        
        // Extract captions
        const captions = parsed.captions || parsed.data?.captions || [];
        
        if (captions.length > 0) {
          console.log('\n✍️  Generated Captions:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          captions.forEach((cap: any, idx: number) => {
            console.log(`\n📝 Caption ${idx + 1}:`);
            if (cap.text) {
              console.log(`   ${cap.text}`);
            }
            if (cap.hashtags && cap.hashtags.length > 0) {
              console.log(`   🏷️  Hashtags: ${cap.hashtags.join(', ')}`);
            }
            if (cap.length) {
              console.log(`   📏 Length: ${cap.length}`);
            }
            if (cap.disclaimer) {
              console.log(`   ⚠️  Disclaimer: ${cap.disclaimer}`);
            }
          });
          
          console.log(`\n✅ Successfully generated ${captions.length} caption variant${captions.length > 1 ? 's' : ''}`);
        } else {
          console.log('\n⚠️  No captions found in response');
          console.log(`   Response keys: ${Object.keys(parsed).join(', ')}`);
        }
      } catch (parseError) {
        console.log('⚠️  Response is not JSON, showing raw:');
        console.log(result.response);
      }

      console.log('\n✅ Test completed!\n');
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      if (error instanceof Error && error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();

