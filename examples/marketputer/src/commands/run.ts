import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getUsdcBalance, getBaseUsdcBalance, autoDetectBaseWallet } from '@memeputer/sdk';
import { Orchestrator } from '../orchestrator';
import { BrandProfile, BrandProfileSchema } from '../types';
import { CleanLogger } from '../lib/logger';

export function createRunCommand(): Command {
  return new Command('run')
    .description('Run autonomous agent economy: Find relevant topics and create a meme about them')
    .option('--task <description>', 'DEPRECATED: Task is now fixed to "Find relevant topics and create a meme about them"')
    .requiredOption('--budget <usdc>', 'Budget in USDC for the orchestrator agent')
    .option('--brand <path>', 'Path to brand config JSON file (supports brandAgentId or brandProfile)')
    .option('--agent-id <id>', 'Orchestrator agent ID (default: 1e7d0044-10c6-4036-9903-6ea995be82ec)')
    .option('--wallet <path>', 'Path to wallet JSON file (defaults to ~/.config/solana/id.json or set MEMEPUTER_WALLET in .env)')
    .option('--api-base <url>', 'Memeputer API base URL (or set MEMEPUTER_API_BASE in .env)')
    .option('--rpc-url <url>', 'Solana RPC URL (or set SOLANA_RPC_URL in .env)')
    .option('--loop', 'Run continuously in a loop (press Ctrl+C to stop)')
    .option('--loop-delay <seconds>', 'Delay between loop iterations in seconds (default: 60)', '60')
    .action(async (opts) => {
      const logger = new CleanLogger();
      try {
        const budgetUsdc = parseFloat(opts.budget);
        const apiBase = opts.apiBase || process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL || 'https://agents.memeputer.com/x402';
        
        // Fixed task: Find relevant topics and create a meme about them
        const task = 'Find relevant topics and create a meme about them';
        
        if (opts.task) {
          logger.warn('Note: --task option is deprecated. Task is now fixed to: "Find relevant topics and create a meme about them"');
        }
        
        // Load wallet - defaults to ~/.config/solana/id.json (same as hello-world)
        function getDefaultWalletPath(): string {
          return join(homedir(), '.config', 'solana', 'id.json');
        }
        
        function expandPath(path: string): string {
          if (path.startsWith('~/')) {
            return join(homedir(), path.slice(2));
          }
          if (path === '~') {
            return homedir();
          }
          if (path.startsWith('~')) {
            return join(homedir(), path.slice(1));
          }
          return path;
        }
        
        function loadWallet(walletPath: string): Keypair {
          const expandedPath = expandPath(walletPath);
          
          if (!existsSync(expandedPath)) {
            throw new Error(`Wallet file not found: ${expandedPath}`);
          }

          const walletData = JSON.parse(readFileSync(expandedPath, 'utf-8'));
          
          if (Array.isArray(walletData)) {
            return Keypair.fromSecretKey(Uint8Array.from(walletData));
          } else if (typeof walletData === 'string') {
            return Keypair.fromSecretKey(bs58.decode(walletData));
          } else {
            throw new Error('Invalid wallet format');
          }
        }
        
        // Get wallet path: flag > env var > default Solana CLI wallet
        const walletPath = opts.wallet || process.env.MEMEPUTER_WALLET || getDefaultWalletPath();
        const wallet = loadWallet(walletPath);
        
        // Get RPC URL
        const rpcUrl = opts.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

        // Load brand profile - default to memeputer.json if not specified
        let brandProfile: BrandProfile | undefined;
        const brandPathToLoad = opts.brand || 'memeputer.json';
        
        try {
          const brandPath = brandPathToLoad.startsWith('~/') 
            ? brandPathToLoad.replace('~', homedir())
            : brandPathToLoad;
          
          if (!existsSync(brandPath)) {
            // Try relative to brands directory
            const brandsPath = join(process.cwd(), 'brands', brandPath);
            if (existsSync(brandsPath)) {
              const brandContent = readFileSync(brandsPath, 'utf-8');
              brandProfile = BrandProfileSchema.parse(JSON.parse(brandContent));
            } else {
              // If no brand specified and memeputer.json doesn't exist, continue without brand
              if (!opts.brand) {
                brandProfile = undefined;
              } else {
                throw new Error(`Brand config not found: ${brandPath}`);
              }
            }
          } else {
            const brandContent = readFileSync(brandPath, 'utf-8');
            brandProfile = BrandProfileSchema.parse(JSON.parse(brandContent));
          }
          
          if (brandProfile) {
            if (brandProfile.brandAgentId) {
              logger.log(`🎨 Brand: Using brand agent ${brandProfile.brandAgentId}`);
            } else if (brandProfile.brandName) {
              logger.log(`🎨 Brand: ${brandProfile.brandName}`);
            }
          }
        } catch (error) {
          // Only show error if brand was explicitly specified
          if (opts.brand) {
            logger.logError(`⚠️  Failed to load brand config: ${error instanceof Error ? error.message : error}`);
            logger.logError('   Continuing without brand profile...\n');
          }
          brandProfile = undefined;
        }

        logger.log('\n🤖 Agent Economy Example\n');
        logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.log(`📋 Task: ${task}`);
        logger.log('   🎯 Orchestrator will autonomously discover trending topics');
        logger.log('   🎯 and create a meme about them');
        logger.log(`💰 Budget: ${budgetUsdc} USDC`);
        if (brandProfile) {
          if (brandProfile.brandAgentId) {
            logger.log(`🎨 Brand Agent: ${brandProfile.brandAgentId}`);
          } else {
            logger.log(`🎨 Brand: ${brandProfile.brandName || 'Custom'}`);
          }
        }
        // Show wallet addresses - check if Base wallet is available
        let baseWalletAddress: string | undefined;
        try {
          const baseWallet = autoDetectBaseWallet();
          baseWalletAddress = baseWallet.address;
        } catch {
          // Base wallet not configured
        }
        
        if (baseWalletAddress) {
          logger.log(`🔑 Solana Wallet: ${wallet.publicKey.toString()}`);
          logger.log(`🔑 Base Wallet: ${baseWalletAddress}`);
        } else {
          logger.log(`🔑 Wallet: ${wallet.publicKey.toString()}`);
        }
        logger.log(`🌐 API: ${apiBase}`);
        logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const connection = new Connection(rpcUrl, 'confirmed');
        
        // Check wallet balances before proceeding
        // Since agents may request Base payments, check both Solana and Base balances
        logger.log('💰 Checking wallet balances...');
        
        // Check Solana balance
        const solanaBalance = await getUsdcBalance(connection, wallet);
        logger.log(`   Solana USDC balance: ${solanaBalance.toFixed(4)} USDC (${wallet.publicKey.toString()})`);
        
        // Try to check Base balance (may not be configured)
        let baseBalance = 0;
        if (baseWalletAddress) {
          // Base wallet was already loaded above, use it for balance check
          try {
            const baseWallet = autoDetectBaseWallet();
            baseBalance = await getBaseUsdcBalance(baseWallet);
            logger.log(`   Base USDC balance: ${baseBalance.toFixed(4)} USDC (${baseWalletAddress})`);
          } catch (error) {
            logger.log(`   Base wallet: Error checking balance`);
          }
        } else {
          logger.log(`   Base wallet: Not configured (agents requesting Base payments will auto-load if available)`);
        }
        
        logger.log(`   Budget requested: ${budgetUsdc.toFixed(4)} USDC`);
        
        // Check if we have sufficient balance on either network
        // Since agents may request Base payments, we need Base balance
        // But we'll check Solana balance for backward compatibility
        const hasSolanaBalance = solanaBalance >= budgetUsdc;
        const hasBaseBalance = baseBalance >= budgetUsdc;
        
        if (!hasSolanaBalance && !hasBaseBalance) {
          logger.logError('\n❌ ERROR: Insufficient USDC balance on both networks!');
          logger.logError(`   Solana Wallet: ${wallet.publicKey.toString()}`);
          logger.logError(`   Solana Balance: ${solanaBalance.toFixed(4)} USDC`);
          if (baseWalletAddress) {
            logger.logError(`   Base Wallet: ${baseWalletAddress}`);
            logger.logError(`   Base Balance: ${baseBalance.toFixed(4)} USDC`);
          }
          logger.logError(`   Budget: ${budgetUsdc.toFixed(4)} USDC`);
          logger.logError('\n   Please add more USDC to your wallet(s) before proceeding.');
          logger.logError('   Execution stopped to prevent partial failures.\n');
          process.exit(1);
        } else {
          const network = hasBaseBalance ? 'Base' : 'Solana';
          const balance = hasBaseBalance ? baseBalance : solanaBalance;
          const remaining = balance - budgetUsdc;
          logger.log(`   ✅ Sufficient balance on ${network} (${remaining.toFixed(4)} USDC remaining after budget)`);
          if (hasBaseBalance && baseWalletAddress !== 'N/A') {
            logger.info(`Note: Agents requesting Base payments will use Base wallet: ${baseWalletAddress}`);
          }
          logger.spacer();
        }
        
        // Create orchestrator
        const orchestrator = new Orchestrator({
          wallet,
          connection,
          apiBase,
        });

        // Run the task
        logger.log('🚀 Starting execution...');
        logger.log('   The orchestrator will discover trending topics');
        logger.log('   and create a meme about them.');
        logger.log('\n📋 Execution Plan:');
        logger.log('   1. What\'s the Plan? - Briefputer analyzes task and identifies keywords/topics');
        logger.log('   2. Discover Trends - Trendputer investigates 10 trending topics');
        logger.log('   3. Select Best Trend - Briefputer evaluates and selects highest quality trend');
        logger.log('   4. Create Creative Brief - Briefputer generates strategic brief with angle, tone, and style');
        logger.log('   5. Enhance Image Prompt - Promptputer refines prompt with quality modifiers');
        logger.log('   6. Generate Image - PFPputer creates meme-ready image');
        logger.log('   7. Describe Image - ImageDescripterputer analyzes and describes the image');
        logger.log('   8. Write Captions - Captionputer generates multiple caption options');
        logger.log('   9. Broadcast to Telegram - Broadcastputer posts final content');
        logger.log('\n💸 Each step involves paying agents via x402 micropayments');
        logger.log('   All payments tracked with blockchain explorer links (Basescan for Base, Solscan for Solana)\n');

        const loopEnabled = opts.loop || false;
        const loopDelaySeconds = parseInt(opts.loopDelay || '60', 10);
        let iteration = 0;

        // Handle graceful shutdown
        let shouldStop = false;
        const stopHandler = () => {
          logger.log('\n\n🛑 Stopping loop... (Press Ctrl+C again to force exit)');
          shouldStop = true;
        };
        process.on('SIGINT', stopHandler);
        process.on('SIGTERM', stopHandler);

        do {
          iteration++;
          if (loopEnabled && iteration > 1) {
            logger.log(`\n\n${'='.repeat(60)}`);
            logger.log(`🔄 Starting iteration #${iteration}`);
            logger.log(`${'='.repeat(60)}\n`);
          }

          const result = await orchestrator.executeTask({
            task: task,
            budgetUsdc,
            brandProfile,
          });

          if (result.success) {
            logger.log('\n✅ Task completed successfully!');
            logger.log('\n📊 Summary:');
            logger.log(`   Total spent: ${result.totalSpent.toFixed(4)} USDC`);
            logger.log(`   Agents hired: ${result.agentsHired.length}`);
            logger.log(`   Payments made: ${result.payments.length}`);
            
            // Display detailed admin information
            if (result.artifacts) {
              // Trend information
              if (result.artifacts.trends?.selectedTrend) {
                const trend = result.artifacts.trends.selectedTrend;
                logger.log(`\n📈 Selected Trend:`);
                logger.log(`   Title: ${trend.title || 'N/A'}`);
                logger.log(`   Summary: ${trend.summary || 'N/A'}`);
                if (trend.hashtags && trend.hashtags.length > 0) {
                  logger.log(`   Hashtags: ${trend.hashtags.join(', ')}`);
                }
                if (trend.canonicalUrl) {
                  logger.log(`   URL: ${trend.canonicalUrl}`);
                }
              }
              
              // Brief information
              if (result.artifacts.brief) {
                const brief = result.artifacts.brief;
                logger.log(`\n📝 Creative Brief:`);
                logger.log(`   Angle: ${brief.angle || 'N/A'}`);
                logger.log(`   Tone: ${brief.tone || 'N/A'}`);
                if (brief.visualStyle && brief.visualStyle.length > 0) {
                  logger.log(`   Visual Style: ${brief.visualStyle.join(', ')}`);
                }
                logger.log(`   CTA: ${brief.callToAction || 'N/A'}`);
                if (brief.negativeConstraints && brief.negativeConstraints.length > 0) {
                  logger.log(`   Constraints: ${brief.negativeConstraints.join(', ')}`);
                }
              }
              
              // Image generation details
              if (result.artifacts.imageGeneration) {
                const img = result.artifacts.imageGeneration;
                logger.log(`\n🎨 Image Generation:`);
                // Show trend title instead of long prompt
                if (result.artifacts.trends?.selectedTrend?.title) {
                  logger.log(`   Trend: ${result.artifacts.trends.selectedTrend.title}`);
                } else if (result.artifacts.trends?.items?.[0]?.title) {
                  logger.log(`   Trend: ${result.artifacts.trends.items[0].title}`);
                }
                if (img.imageUrl) {
                  logger.log(`   Image URL: ${img.imageUrl}`);
                }
                if (img.imageHash) {
                  logger.log(`   Image Hash: ${img.imageHash}`);
                }
                if (img.seed) {
                  logger.log(`   Seed: ${img.seed}`);
                }
                if (img.guidance) {
                  logger.log(`   Guidance: ${img.guidance}`);
                }
              }
              
            // Image description
            if (result.artifacts.imageDescription) {
              const desc = result.artifacts.imageDescription;
              logger.log(`\n👁️  Image Description:`);
              if (desc.description) {
                const preview = desc.description.substring(0, 200);
                logger.log(`   ${preview}${desc.description.length > 200 ? '...' : ''}`);
              }
            }
              
            // Caption information
            if (result.artifacts.caption) {
              const cap = result.artifacts.caption;
              logger.log(`\n✍️  Caption (used):`);
              logger.log(`   Text: ${cap.text || 'N/A'}`);
              if (cap.hashtags && cap.hashtags.length > 0) {
                logger.log(`   Hashtags: ${cap.hashtags.join(' ')}`);
              }
              if (cap.disclaimer) {
                logger.log(`   Disclaimer: ${cap.disclaimer}`);
              }
              if (cap.length) {
                logger.log(`   Length: ${cap.length}`);
              }
            }
            
            // Caption options
            if (result.artifacts.captionOptions && result.artifacts.captionOptions.length > 1) {
              logger.log(`\n✍️  Caption Options (${result.artifacts.captionOptions.length} total):`);
              result.artifacts.captionOptions.forEach((cap, idx) => {
                logger.log(`   ${idx + 1}. ${cap.text || 'N/A'}`);
                if (cap.hashtags && cap.hashtags.length > 0) {
                  logger.log(`      Hashtags: ${cap.hashtags.join(' ')}`);
                }
              });
            }
              
              // Posted links
              if (result.artifacts.postedLinks) {
                logger.log(`\n📱 Posted Links:`);
                if (result.artifacts.postedLinks.telegram) {
                  logger.log(`   Telegram: ${result.artifacts.postedLinks.telegram}`);
                }
              }
              
              // Brand information
              if (result.artifacts.brandProfile) {
                const brand = result.artifacts.brandProfile;
                logger.log(`\n🎨 Brand Profile:`);
                if (brand.brandAgentId) {
                  logger.log(`   Brand Agent ID: ${brand.brandAgentId}`);
                } else {
                  logger.log(`   Brand Name: ${brand.brandName || 'N/A'}`);
                  logger.log(`   Voice: ${brand.voice || brand.personality || 'N/A'}`);
                }
              }
            }
            
            // Payment details
            if (result.payments.length > 0) {
              logger.log(`\n💸 Payment Details:`);
              result.payments.forEach((payment, idx) => {
                logger.log(`   ${idx + 1}. ${payment.agentId} (${payment.command}): ${payment.amount.toFixed(4)} USDC`);
                logger.log(`      TX: ${payment.txId}`);
              });
            }
            
            if (result.result) {
              logger.log(`\n📄 Result:`);
              logger.log(result.result);
            }
          } else {
            logger.logError(`\n❌ Task failed: ${result.error}`);
            if (!loopEnabled) {
              process.exit(1);
            }
          }

          // If looping, wait before next iteration
          if (loopEnabled && !shouldStop) {
            logger.log(`\n⏳ Waiting ${loopDelaySeconds} seconds before next iteration...`);
            await new Promise(resolve => setTimeout(resolve, loopDelaySeconds * 1000));
          }
        } while (loopEnabled && !shouldStop);

        if (loopEnabled) {
          logger.log('\n✅ Loop stopped gracefully');
        }
      } catch (error) {
        logger.logError('❌ Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

