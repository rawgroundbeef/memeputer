#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { OrchestratorAgent } from './orchestrator-agent';
import { BrandProfile, BrandProfileSchema } from './types';

const program = new Command();

program
  .name('agent-economy')
  .description('Demonstrates agents paying other agents - a true agent-to-agent economy')
  .version('0.1.0');

program
  .command('run')
  .description('Run a task where an agent pays other agents')
  .requiredOption('--task <description>', 'Task description for the orchestrator agent')
  .requiredOption('--budget <usdc>', 'Budget in USDC for the orchestrator agent')
  .option('--brand <path>', 'Path to brand config JSON file (supports brandAgentId or brandProfile)')
  .option('--agent-id <id>', 'Orchestrator agent ID (default: 1e7d0044-10c6-4036-9903-6ea995be82ec)')
  .option('--orchestrator-wallet <path>', 'Path to orchestrator agent wallet JSON file (or set MEMEPUTER_WALLET in .env)')
  .option('--api-base <url>', 'Memeputer API base URL (or set MEMEPUTER_API_BASE in .env)')
  .option('--rpc-url <url>', 'Solana RPC URL (or set SOLANA_RPC_URL in .env)')
  .action(async (opts) => {
    try {
      const budgetUsdc = parseFloat(opts.budget);
      const apiBase = opts.apiBase || process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL || 'https://agents.api.memeputer.com';
      
      // Load orchestrator wallet from local file
      // Note: In open source, we can't expose wallet secret keys from the backend
      // So we use a local wallet file that represents the orchestrator agent's wallet
      let wallet: Keypair;
      let walletPath = opts.orchestratorWallet;
      
      if (!walletPath) {
        // Try env vars (check multiple common names)
        walletPath = process.env.ORCHESTRATOR_WALLET || 
                     process.env.MEMEPUTER_WALLET || 
                     process.env.WALLET_SECRET_KEY;
      }
      
      if (!walletPath) {
        // Try RC file
        const rcPath = join(homedir(), '.memeputerrc');
        if (existsSync(rcPath)) {
          try {
            const rcContent = readFileSync(rcPath, 'utf-8');
            const rcConfig = JSON.parse(rcContent);
            if (rcConfig.orchestratorWallet) {
              walletPath = rcConfig.orchestratorWallet;
            }
          } catch {
            // Silently fail
          }
        }
      }
      
      if (!walletPath) {
        console.error('❌ Error: Could not find orchestrator agent wallet');
        console.error('\nPlease provide the orchestrator wallet using one of these methods:');
        console.error('  1. Use --orchestrator-wallet <path> flag');
        console.error('  2. Set MEMEPUTER_WALLET or ORCHESTRATOR_WALLET in .env file');
        console.error('  3. Create ~/.memeputerrc with: {"orchestratorWallet": "/path/to/wallet.json"}');
        console.error('\nNote: The orchestrator agent needs USDC to pay other agents!');
        process.exit(1);
      }

      // Expand tilde (~) in path to home directory
      if (walletPath.startsWith('~/')) {
        walletPath = walletPath.replace('~', homedir());
      }

      // Load wallet
      try {
        // First check if it's a file path
        if (existsSync(walletPath)) {
          const walletContent = readFileSync(walletPath, 'utf-8');
          const walletData = JSON.parse(walletContent);
          wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
        } else {
          // Try as base58 encoded string or JSON string
          try {
            const walletData = JSON.parse(walletPath);
            wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
          } catch {
            wallet = Keypair.fromSecretKey(bs58.decode(walletPath));
          }
        }
      } catch (error) {
        throw new Error(
          `Failed to load wallet. ` +
          `Path "${walletPath}" is neither a valid file path nor a base58-encoded secret key. ` +
          `Original error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      
      console.log(`\n🔑 Loaded orchestrator wallet`);
      console.log(`   Public Key: ${wallet.publicKey.toString()}`);

      // Get RPC URL
      const rpcUrl = opts.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

      // Load brand profile if provided
      let brandProfile: BrandProfile | undefined;
      if (opts.brand) {
        try {
          const brandPath = opts.brand.startsWith('~/') 
            ? opts.brand.replace('~', homedir())
            : opts.brand;
          
          if (!existsSync(brandPath)) {
            // Try relative to brands directory
            const brandsPath = join(process.cwd(), 'brands', brandPath);
            if (existsSync(brandsPath)) {
              const brandContent = readFileSync(brandsPath, 'utf-8');
              brandProfile = BrandProfileSchema.parse(JSON.parse(brandContent));
            } else {
              throw new Error(`Brand config not found: ${brandPath}`);
            }
          } else {
            const brandContent = readFileSync(brandPath, 'utf-8');
            brandProfile = BrandProfileSchema.parse(JSON.parse(brandContent));
          }
          
          if (brandProfile.brandAgentId) {
            console.log(`🎨 Brand: Using brand agent ${brandProfile.brandAgentId}`);
          } else if (brandProfile.brandName) {
            console.log(`🎨 Brand: ${brandProfile.brandName}`);
          }
        } catch (error) {
          console.error(`⚠️  Failed to load brand config: ${error instanceof Error ? error.message : error}`);
          console.error('   Continuing without brand profile...\n');
        }
      }

      console.log('\n🤖 Agent Economy Example\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 Task:', opts.task);
      console.log('💰 Budget:', budgetUsdc, 'USDC');
      if (brandProfile) {
        if (brandProfile.brandAgentId) {
          console.log('🎨 Brand Agent:', brandProfile.brandAgentId);
        } else {
          console.log('🎨 Brand:', brandProfile.brandName || 'Custom');
        }
      }
      console.log('🔑 Wallet:', wallet.publicKey.toString());
      console.log('🌐 API:', apiBase);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const connection = new Connection(rpcUrl, 'confirmed');
      
      // Create orchestrator agent
      const orchestrator = new OrchestratorAgent({
        wallet,
        connection,
        apiBase,
      });

      // Run the task
      console.log('🚀 Starting task execution...');
      console.log('   The orchestrator agent will autonomously decide');
      console.log('   which agents to hire and pay them.\n');

      const result = await orchestrator.executeTask({
        task: opts.task,
        budgetUsdc,
        brandProfile,
      });

      if (result.success) {
        console.log('\n✅ Task completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   Total spent: ${result.totalSpent.toFixed(4)} USDC`);
        console.log(`   Agents hired: ${result.agentsHired.length}`);
        console.log(`   Payments made: ${result.payments.length}`);
        
        // Display detailed admin information
        if (result.artifacts) {
          // Trend information
          if (result.artifacts.trends?.selectedTrend) {
            const trend = result.artifacts.trends.selectedTrend;
            console.log(`\n📈 Selected Trend:`);
            console.log(`   Title: ${trend.title || 'N/A'}`);
            console.log(`   Summary: ${trend.summary || 'N/A'}`);
            console.log(`   Source: ${trend.source || 'N/A'}`);
            console.log(`   Score: ${trend.score || 'N/A'}`);
            if (trend.hashtags && trend.hashtags.length > 0) {
              console.log(`   Hashtags: ${trend.hashtags.join(', ')}`);
            }
            if (trend.canonicalUrl) {
              console.log(`   URL: ${trend.canonicalUrl}`);
            }
          }
          
          // Brief information
          if (result.artifacts.brief) {
            const brief = result.artifacts.brief;
            console.log(`\n📝 Creative Brief:`);
            console.log(`   Angle: ${brief.angle || 'N/A'}`);
            console.log(`   Tone: ${brief.tone || 'N/A'}`);
            if (brief.visualStyle && brief.visualStyle.length > 0) {
              console.log(`   Visual Style: ${brief.visualStyle.join(', ')}`);
            }
            console.log(`   CTA: ${brief.callToAction || 'N/A'}`);
            if (brief.negativeConstraints && brief.negativeConstraints.length > 0) {
              console.log(`   Constraints: ${brief.negativeConstraints.join(', ')}`);
            }
          }
          
          // Image generation details
          if (result.artifacts.imageGeneration) {
            const img = result.artifacts.imageGeneration;
            console.log(`\n🎨 Image Generation:`);
            if (img.prompt) {
              console.log(`   Prompt: ${img.prompt}`);
            }
            if (img.imageUrl) {
              console.log(`   Image URL: ${img.imageUrl}`);
            }
            if (img.imageHash) {
              console.log(`   Image Hash: ${img.imageHash}`);
            }
            if (img.seed) {
              console.log(`   Seed: ${img.seed}`);
            }
            if (img.guidance) {
              console.log(`   Guidance: ${img.guidance}`);
            }
          }
          
          // Caption information
          if (result.artifacts.caption) {
            const cap = result.artifacts.caption;
            console.log(`\n✍️  Caption:`);
            console.log(`   Text: ${cap.text || 'N/A'}`);
            if (cap.hashtags && cap.hashtags.length > 0) {
              console.log(`   Hashtags: ${cap.hashtags.join(' ')}`);
            }
            if (cap.disclaimer) {
              console.log(`   Disclaimer: ${cap.disclaimer}`);
            }
            if (cap.length) {
              console.log(`   Length: ${cap.length}`);
            }
          }
          
          // Posted links
          if (result.artifacts.postedLinks) {
            console.log(`\n📱 Posted Links:`);
            if (result.artifacts.postedLinks.telegram) {
              console.log(`   Telegram: ${result.artifacts.postedLinks.telegram}`);
            }
            if (result.artifacts.postedLinks.farcaster) {
              console.log(`   Farcaster: ${result.artifacts.postedLinks.farcaster}`);
            }
          }
          
          // Brand information
          if (result.artifacts.brandProfile) {
            const brand = result.artifacts.brandProfile;
            console.log(`\n🎨 Brand Profile:`);
            if (brand.brandAgentId) {
              console.log(`   Brand Agent ID: ${brand.brandAgentId}`);
            } else {
              console.log(`   Brand Name: ${brand.brandName || 'N/A'}`);
              console.log(`   Voice: ${brand.voice || brand.personality || 'N/A'}`);
            }
          }
        }
        
        // Payment details
        if (result.payments.length > 0) {
          console.log(`\n💸 Payment Details:`);
          result.payments.forEach((payment, idx) => {
            console.log(`   ${idx + 1}. ${payment.agentId} (${payment.command}): ${payment.amount.toFixed(4)} USDC`);
            console.log(`      TX: ${payment.txId}`);
          });
        }
        
        if (result.result) {
          console.log(`\n📄 Result:`);
          console.log(result.result);
        }
      } else {
        console.error('\n❌ Task failed:', result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();

