#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { MemeputerClient } from './sdk/memeputer';
import { Orchestrator } from './orchestrator';
import { BrandProfile, BrandProfileSchema } from './types';

const program = new Command();

program
  .name('marketputer')
  .description('Autonomous trend→create→broadcast pipeline powered by Memeputer Agents + X402 pay-per-use on Solana')
  .version('0.1.0');

program
  .command('run')
  .description('Run a marketing campaign')
  .requiredOption('--brand <path>', 'Path to brand config JSON')
  .requiredOption('--budget <sol>', 'Budget in SOL')
  .option('--channels <list>', 'Comma-separated channels, e.g. tg,fc', 'tg')
  .option('--sources <list>', 'Comma-separated sources, e.g. x,rss', 'x')
  .option('--max-items <n>', 'Maximum number of trends to fetch', '20')
  .option('--seed <n>', 'Deterministic seed for image generation', '42')
  .option('--mock', 'Use mock mode (no API calls)', false)
  .option('--approve', 'Auto-approve without prompt', false)
  .option('--loop', 'Run campaigns in a loop', false)
  .option('--delay <ms>', 'Delay between loop iterations in milliseconds', '30000')
  .option('--max <n>', 'Maximum number of campaigns to run (0 = unlimited)', '0')
  .action(async (opts) => {
    try {
      // Load brand profile
      const brandPath = opts.brand;
      const brandContent = readFileSync(brandPath, 'utf-8');
      const brandData = JSON.parse(brandContent);
      const brandProfile = BrandProfileSchema.parse(brandData);
      
      // Resolve absolute path for reference image loading
      const brandConfigPath = join(process.cwd(), brandPath);

      // Parse options
      const budgetSol = parseFloat(opts.budget);
      const budgetLamports = Math.floor(budgetSol * 1e9); // Convert SOL to lamports
      const channels = opts.channels.split(',').map((c: string) => c.trim()) as ('tg' | 'fc')[];
      const sources = opts.sources.split(',').map((s: string) => s.trim().toUpperCase()) as ('DEXSCREENER' | 'BIRDEYE' | 'RSS' | 'X')[];
      const maxItems = parseInt(opts.maxItems, 10);
      const seed = opts.seed ? parseInt(opts.seed, 10) : undefined;
      const mockMode = opts.mock || process.env.MOCK_MODE === 'true';
      const loopMode = opts.loop || false;
      const loopDelay = parseInt(opts.delay || '30000', 10);
      const maxIterations = parseInt(opts.max || '0', 10);

      // Load wallet path - try multiple sources
      function loadWalletPath(): string | null {
        // 1. Check .env variables first (for explicit override)
        if (process.env.MEMEPUTER_WALLET || process.env.WALLET_SECRET_KEY) {
          return process.env.MEMEPUTER_WALLET || process.env.WALLET_SECRET_KEY || null;
        }

        // 2. Check memeputer RC file (~/.memeputerrc)
        const rcPath = join(homedir(), '.memeputerrc');
        if (existsSync(rcPath)) {
          try {
            const rcContent = readFileSync(rcPath, 'utf-8');
            const rcConfig = JSON.parse(rcContent);
            if (rcConfig.wallet) {
              return rcConfig.wallet;
            }
          } catch {
            // Silently fail, try next option
          }
        }

        // 3. Check default Solana wallet location
        const defaultWalletPath = join(homedir(), '.config', 'solana', 'id.json');
        if (existsSync(defaultWalletPath)) {
          return defaultWalletPath;
        }

        return null;
      }

      // Load config - check RC file and env
      let apiBase = process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL;
      let rpcUrl = process.env.SOLANA_RPC_URL;
      const rcPath = join(homedir(), '.memeputerrc');
      if (existsSync(rcPath)) {
        try {
          const rcContent = readFileSync(rcPath, 'utf-8');
          const rcConfig = JSON.parse(rcContent);
          if (!apiBase && rcConfig.apiUrl) apiBase = rcConfig.apiUrl;
          if (!rpcUrl && rcConfig.rpcUrl) rpcUrl = rcConfig.rpcUrl;
        } catch {
          // Silently fail
        }
      }
      // Support localhost for local testing
      if (!apiBase) {
        if (process.env.NODE_ENV === 'development' || process.env.USE_LOCALHOST === 'true') {
          apiBase = 'http://localhost:3006'; // Agents API
          console.log('🔧 Using localhost agents API (port 3006)');
        } else {
          apiBase = 'https://agents.api.memeputer.com';
        }
      }
      
      if (apiBase.includes('localhost')) {
        console.log('🏠 Using LOCALHOST API');
      }
      
      rpcUrl = rpcUrl || 'https://api.mainnet-beta.solana.com';

      const walletPath = loadWalletPath();
      let wallet: Keypair | null = null;
      let connection: Connection | null = null;

      if (!mockMode) {
        if (!walletPath) {
          console.error('❌ Error: Could not find wallet configuration');
          console.error('\nPlease set up your wallet using one of these methods:');
          console.error('  1. Set MEMEPUTER_WALLET or WALLET_SECRET_KEY in .env file');
          console.error('  2. Create ~/.memeputerrc with: {"wallet": "/path/to/wallet.json"}');
          console.error('  3. Use default Solana wallet at ~/.config/solana/id.json');
          console.error('\nOr use --mock flag for testing without a wallet');
          console.error('Or run: memeputer balance (to set up memeputer config)');
          process.exit(1);
        }

        try {
          // Load wallet - can be either a JSON file path or a base58 encoded secret key
          let walletData: number[] | Uint8Array;
          try {
            // Try as file path first
            const walletContent = readFileSync(walletPath, 'utf-8');
            walletData = JSON.parse(walletContent);
          } catch {
            // If not a file, try as base58 encoded string
            walletData = bs58.decode(walletPath);
          }
          wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
          connection = new Connection(rpcUrl, 'confirmed');
        } catch (error) {
          console.error('❌ Error loading wallet:', error instanceof Error ? error.message : error);
          console.error('   Wallet should be a path to a JSON keypair file or base58 encoded secret key');
          process.exit(1);
        }
      }

      // Initialize client
      const client = new MemeputerClient({
        apiBase,
        wallet: wallet || Keypair.generate(), // Generate dummy wallet for mock mode
        connection: connection || new Connection(rpcUrl, 'confirmed'),
        mockMode,
      });

      // Initialize orchestrator
      const orchestrator = new Orchestrator(client);

      console.log('\n🚀 Starting Marketputer Campaign\n');
      if (brandProfile.brandAgentId) {
        console.log(`Brand Agent ID: ${brandProfile.brandAgentId}`);
      } else {
        console.log(`Brand: ${brandProfile.brandName || 'Unknown'}`);
      }
      console.log(`Budget: ${budgetSol} SOL (${budgetLamports} lamports)`);
      console.log(`Channels: ${channels.join(', ')}`);
      console.log(`Sources: ${sources.join(', ')}`);
      console.log(`Mode: ${mockMode ? 'MOCK' : 'LIVE'}`);
      if (loopMode) {
        console.log(`🔄 Loop Mode: ON`);
        console.log(`   Delay: ${loopDelay}ms`);
        if (maxIterations > 0) {
          console.log(`   Max campaigns: ${maxIterations}`);
        } else {
          console.log(`   Max campaigns: unlimited (Ctrl+C to stop)`);
        }
      }
      console.log('');

      // Helper function to sleep
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Helper function to run a single campaign
      const runSingleCampaign = async (iteration?: number) => {
        if (iteration !== undefined) {
          console.log(`\n${'='.repeat(60)}`);
          console.log(`🔄 CAMPAIGN ${iteration + 1}`);
          console.log('='.repeat(60));
        }

        const result = await orchestrator.runCampaign({
          brandProfile,
          budgetLamports,
          channels,
          sources,
          maxItems,
          seed,
          mockMode,
          brandConfigPath,
        });

        // Save campaign result
        const runsDir = join(process.cwd(), 'runs');
        mkdirSync(runsDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const runFile = join(runsDir, `${timestamp}.json`);
        writeFileSync(runFile, JSON.stringify(result.campaign, null, 2));

        if (iteration === undefined) {
          console.log(`\n📄 Campaign saved to: ${runFile}`);
        } else {
          console.log(`📄 Campaign ${iteration + 1} saved to: ${runFile}`);
        }

        if (result.success) {
          if (iteration === undefined) {
            console.log('\n✅ Campaign completed successfully!');
          } else {
            console.log(`✅ Campaign ${iteration + 1} completed!`);
          }
          console.log(`📊 Summary:`);
          console.log(`   Total receipts: ${result.campaign.x402Receipts.length}`);
          const totalSpent = result.campaign.x402Receipts.reduce((sum, r) => sum + r.lamports, 0);
          console.log(`   Total spent: ${totalSpent} lamports (${(totalSpent / 1e9).toFixed(4)} SOL)`);
          if (result.campaign.posts.telegramLink) {
            console.log(`   Telegram: ${result.campaign.posts.telegramLink}`);
          }
          if (result.campaign.posts.farcasterLink) {
            console.log(`   Farcaster: ${result.campaign.posts.farcasterLink}`);
          }
          return true;
        } else {
          console.error(`\n❌ Campaign ${iteration !== undefined ? iteration + 1 : ''} failed: ${result.error}`);
          return false;
        }
      };

      // Run campaign(s)
      if (loopMode) {
        let iteration = 0;
        let shouldStop = false;

        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
          console.log('\n\n🛑 Stopping loop...');
          shouldStop = true;
        });

        while (!shouldStop) {
          try {
            const success = await runSingleCampaign(iteration);
            
            iteration++;
            
            if (maxIterations > 0 && iteration >= maxIterations) {
              console.log(`\n✅ Completed ${maxIterations} campaigns`);
              break;
            }

            if (!shouldStop) {
              console.log(`\n⏳ Waiting ${loopDelay}ms before next campaign...`);
              await sleep(loopDelay);
            }
          } catch (error) {
            console.error('\n❌ Error in campaign:', error instanceof Error ? error.message : error);
            if (!shouldStop) {
              console.log(`⏳ Waiting ${loopDelay}ms before retrying...`);
              await sleep(loopDelay);
            }
          }
        }
      } else {
        const success = await runSingleCampaign();
        if (!success) {
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('mint-receipt')
  .description('Mint a receipt NFT for a completed campaign')
  .requiredOption('--run <path>', 'Path to campaign JSON file')
  .action(async (opts) => {
    try {
      const runContent = readFileSync(opts.run, 'utf-8');
      const campaign = JSON.parse(runContent);

      const rpcUrl = process.env.SOLANA_RPC_URL;
      const walletSecret = process.env.WALLET_SECRET_KEY;

      if (!rpcUrl || !walletSecret) {
        console.error('❌ Error: SOLANA_RPC_URL and WALLET_SECRET_KEY must be set in .env');
        process.exit(1);
      }

      const apiBase = process.env.MEMEPUTER_API_BASE;
      const apiKey = process.env.MEMEPUTER_API_KEY;

      if (!apiBase || !apiKey) {
        console.error('❌ Error: MEMEPUTER_API_BASE and MEMEPUTER_API_KEY must be set in .env');
        process.exit(1);
      }

      const client = new MemeputerClient({
        apiBase,
        apiKey,
        mockMode: false,
      });

      console.log('🎫 Minting receipt NFT...');
      const response = await client.mintReceiptNft({
        rpcUrl,
        payerSecret: walletSecret,
        campaign,
      });

      console.log(`✅ Receipt NFT minted!`);
      console.log(`   Mint: ${response.mint}`);
      console.log(`   Explorer: ${response.explorerUrl}`);
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();

