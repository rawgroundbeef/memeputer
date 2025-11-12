#!/usr/bin/env node
/**
 * Step-by-Step Agent Economy Testing
 * 
 * This CLI allows you to test each step of the agent economy flow individually
 * with extensive logging of all inputs and outputs.
 * 
 * Usage:
 *   pnpm exec tsx src/step-by-step.ts step0
 *   pnpm exec tsx src/step-by-step.ts step1
 *   etc.
 * 
 * Note: Task is fixed to "Find relevant topics and create a meme about them"
 */

import 'dotenv/config';
import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { AgentsApiClient, InteractionResult } from 'memeputer/dist/lib/api.js';
import { BrandProfile, BrandProfileSchema } from './types';

// Extend InteractionResult to include x402Receipt and x402Quote
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

// Helper to generate Solscan URLs
function getSolscanTxUrl(signature: string, network: 'mainnet' | 'devnet' = 'mainnet'): string {
  const baseUrl = network === 'mainnet' ? 'https://solscan.io/tx' : 'https://solscan.io/tx';
  return `${baseUrl}/${signature}`;
}

function getSolscanAccountUrl(address: string, network: 'mainnet' | 'devnet' = 'mainnet'): string {
  const baseUrl = network === 'mainnet' ? 'https://solscan.io/account' : 'https://solscan.io/account';
  return `${baseUrl}/${address}`;
}

// Helper to detect network from RPC URL
function detectNetwork(rpcUrl: string): 'mainnet' | 'devnet' {
  if (rpcUrl.includes('devnet')) return 'devnet';
  return 'mainnet';
}

// Logger utility for consistent formatting
class StepLogger {
  private stepName: string;
  private network: 'mainnet' | 'devnet';
  
  constructor(stepName: string, network: 'mainnet' | 'devnet' = 'mainnet') {
    this.stepName = stepName;
    this.network = network;
  }
  
  setNetwork(network: 'mainnet' | 'devnet') {
    this.network = network;
  }
  
  logInput(label: string, value: any) {
    console.log(`\n📥 INPUT [${this.stepName}]: ${label}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (typeof value === 'object') {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(value);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
  
  logOutput(label: string, value: any) {
    console.log(`\n📤 OUTPUT [${this.stepName}]: ${label}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (typeof value === 'object') {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(value);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
  
  logInfo(message: string) {
    console.log(`\nℹ️  [${this.stepName}]: ${message}`);
  }
  
  logSuccess(message: string) {
    console.log(`\n✅ [${this.stepName}]: ${message}`);
  }
  
  logError(message: string, error?: any) {
    console.error(`\n❌ [${this.stepName}]: ${message}`);
    if (error) {
      console.error('Error details:', error instanceof Error ? error.stack : error);
    }
  }
  
  logPayment(agentId: string, amount: number, txId: string, payer?: string, merchant?: string) {
    console.log(`\n💸 PAYMENT [${this.stepName}]:`);
    console.log(`   Agent: ${agentId}`);
    console.log(`   Amount: ${amount.toFixed(4)} USDC`);
    console.log(`   Transaction: ${txId}`);
    console.log(`   🔗 View on Solscan: ${getSolscanTxUrl(txId, this.network)}`);
    
    if (payer) {
      console.log(`   💰 Payer Wallet: ${payer}`);
      console.log(`      🔗 View on Solscan: ${getSolscanAccountUrl(payer, this.network)}`);
    }
    
    if (merchant) {
      console.log(`   🏪 Merchant Wallet: ${merchant}`);
      console.log(`      🔗 View on Solscan: ${getSolscanAccountUrl(merchant, this.network)}`);
    }
  }
}

// Helper to load wallet
function loadWallet(walletPath: string): Keypair {
  // Expand tilde (~) in path
  if (walletPath.startsWith('~/')) {
    walletPath = walletPath.replace('~', homedir());
  }
  
  try {
    if (existsSync(walletPath)) {
      const walletContent = readFileSync(walletPath, 'utf-8');
      const walletData = JSON.parse(walletContent);
      return Keypair.fromSecretKey(new Uint8Array(walletData));
    } else {
      // Try as base58 encoded string or JSON string
      try {
        const walletData = JSON.parse(walletPath);
        return Keypair.fromSecretKey(new Uint8Array(walletData));
      } catch {
        return Keypair.fromSecretKey(bs58.decode(walletPath));
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to load wallet. ` +
      `Path "${walletPath}" is neither a valid file path nor a base58-encoded secret key. ` +
      `Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Helper to get wallet path from various sources
function getWalletPath(opts: any): string {
  let walletPath = opts.orchestratorWallet;
  
  if (!walletPath) {
    walletPath = process.env.ORCHESTRATOR_WALLET || 
                 process.env.MEMEPUTER_WALLET || 
                 process.env.WALLET_SECRET_KEY;
  }
  
  if (!walletPath) {
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
    throw new Error(
      'Could not find orchestrator agent wallet. ' +
      'Please provide using --orchestrator-wallet or set MEMEPUTER_WALLET in .env'
    );
  }
  
  return walletPath;
}

// Helper to save step result to file
function saveStepResult(stepName: string, result: any) {
  const resultDir = join(process.cwd(), 'step-results');
  if (!existsSync(resultDir)) {
    require('fs').mkdirSync(resultDir, { recursive: true });
  }
  const resultPath = join(resultDir, `${stepName}-${Date.now()}.json`);
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 Saved result to: ${resultPath}`);
}

const program = new Command();

program
  .name('step-by-step')
  .description('Test agent economy steps individually with extensive logging')
  .version('0.1.0')
  .addHelpCommand('help', 'Show help for a command');

// List all available steps
program
  .command('list')
  .description('List all available steps')
  .action(() => {
    console.log('\n📋 Available Steps:\n');
    console.log('  step1   - Ask BriefPuter what to focus on');
    console.log('  step2   - Ask BriefPuter whether to get trends');
    console.log('  step1-2  - Run step 1 then step 2 together');
    console.log('  step3   - Get trends from TrendPuter');
    console.log('  step4   - Select best trend from list');
    console.log('  step5   - Ask BriefPuter whether to generate a brief');
    console.log('  step6   - Generate creative brief');
    console.log('\n💡 Usage: pnpm step <step-name> [options]');
    console.log('   Example: pnpm step step1');
    console.log('\n📝 Note: Task is fixed to "Find relevant topics and create a meme about them"');
    console.log('\n📖 For detailed documentation, see STEP_BY_STEP_TESTING.md\n');
  });

// Common options for all steps
function addCommonOptions(cmd: Command) {
  return cmd
    .option('--task <description>', 'DEPRECATED: Task is fixed to "Find relevant topics and create a meme about them"')
    .option('--budget <usdc>', 'Budget in USDC', '1.0')
    .option('--brand <path>', 'Path to brand config JSON file')
    .option('--orchestrator-wallet <path>', 'Path to orchestrator wallet')
    .option('--api-base <url>', 'Memeputer API base URL')
    .option('--rpc-url <url>', 'Solana RPC URL')
    .option('--save-result', 'Save result to file');
}

// Step 1: Ask BriefPuter what to focus on
program
  .command('step1')
  .description('Step 1: Ask BriefPuter what to focus on before getting trends')
  .option('--task <description>', 'DEPRECATED: Task is fixed', 'Find relevant topics and create a meme about them')
  .option('--orchestrator-wallet <path>', 'Path to orchestrator wallet')
  .option('--api-base <url>', 'Memeputer API base URL')
  .option('--rpc-url <url>', 'Solana RPC URL')
  .option('--save-result', 'Save result to file')
  .action(async (opts) => {
    const logger = new StepLogger('STEP1');
    
    try {
      // Load configuration
      const apiBase = opts.apiBase || process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL || 'https://agents.api.memeputer.com';
      const rpcUrl = opts.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const walletPath = getWalletPath(opts);
      const wallet = loadWallet(walletPath);
      const connection = new Connection(rpcUrl, 'confirmed');
      // Fixed task
      const task = 'Find relevant topics and create a meme about them';
      
      if (opts.task && opts.task !== task) {
        logger.logInfo(`⚠️  Note: --task option is deprecated. Using fixed task: "${task}"`);
      }
      const network = detectNetwork(rpcUrl);
      
      logger.setNetwork(network);
      logger.logInfo('Step 1: Ask BriefPuter what to focus on');
      
      // Build the prompt
      const prompt = `I'm an orchestrator agent with a task: "${task}"

Before I start looking for trends, help me think about what I should focus on. Consider:
- What topics would be most relevant to this task?
- What keywords or themes should I investigate?
- What's the goal of this content?

Respond in this exact JSON format:
{
  "focusArea": "1-2 sentence description of primary focus",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "topics": ["crypto", "tech", "culture"],
  "reasoning": "Why these topics/keywords are relevant"
}`;
      
      logger.logInput('Prompt to BriefPuter', prompt);
      
      // Log the HTTP request details
      logger.logInfo('📤 HTTP Request #1 (Initial - No Payment):');
      logger.logInfo(`   Method: POST`);
      logger.logInfo(`   URL: ${apiBase}/x402/interact`);
      logger.logInfo(`   Headers:`);
      logger.logInfo(`     Content-Type: application/json`);
      logger.logInfo(`     User-Agent: memeputer-cli`);
      logger.logInfo(`   Body:`);
      logger.logOutput('Request Body', {
        agentId: 'briefputer',
        message: prompt,
      });
      
      // Call BriefPuter
      const apiClient = new AgentsApiClient(apiBase);
      
      logger.logInfo('Calling BriefPuter via API...');
      
      const result = await apiClient.interact(
        'briefputer',
        prompt,
        wallet,
        connection
      ) as InteractionResultWithReceipt;
      
      // Log payment flow details
      logger.logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.logInfo('💳 Payment Flow:');
      
      if (result.x402Quote) {
        logger.logInfo(`   📋 Step 1: Received 402 Payment Required`);
        logger.logInfo(`      💰 Cost: ${result.x402Quote.amountQuotedUsdc.toFixed(4)} USDC`);
        logger.logInfo(`      💡 This is the quoted amount from the 402 response`);
        logger.logInfo(`   💸 Step 2: Payment Transaction Created`);
        logger.logInfo(`      Amount: ${result.x402Quote.amountQuotedUsdc.toFixed(4)} USDC`);
        logger.logInfo(`      From: ${wallet.publicKey.toString()}`);
        if (result.x402Receipt?.merchant || result.x402Receipt?.payTo) {
          logger.logInfo(`      To: ${result.x402Receipt.merchant || result.x402Receipt.payTo}`);
        }
        logger.logInfo(`   ✅ Step 3: Payment Confirmed`);
        logger.logInfo(`      Request retried with X-PAYMENT header`);
        logger.logInfo(`      Status: 200 OK`);
      } else {
        logger.logInfo(`   ⚠️  Payment flow details not available (x402Quote missing)`);
      }
      
      logger.logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      logger.logOutput('Raw API Response', {
        format: result.format,
        response: result.response,
        transactionSignature: result.transactionSignature,
        x402Receipt: result.x402Receipt,
        imageUrl: result.imageUrl,
        statusUrl: result.statusUrl,
      });
      
      // Log payment amount details
      // The client pays the QUOTE amount (maxAmountRequired from 402 response)
      // The RECEIPT (x402Receipt) should confirm what was actually paid (should match quote)
      if (result.transactionSignature) {
        // Show quote amount (what we paid)
        if (result.x402Quote) {
          logger.logInfo('💰 Payment Amount (from Quote):');
          logger.logInfo(`   Quoted Amount: ${result.x402Quote.amountQuotedUsdc.toFixed(4)} USDC`);
          logger.logInfo(`   Quote Source: 402 response maxAmountRequired`);
          logger.logInfo(`   ✅ Client paid this amount`);
        }
        
        // Show receipt amount (what backend says was paid)
        if (result.x402Receipt) {
          logger.logInfo('📋 Payment Receipt (from Backend):');
          logger.logInfo(`   Receipt Amount: ${result.x402Receipt.amountPaidUsdc.toFixed(4)} USDC`);
          
          // Compare quote vs receipt
          if (result.x402Quote) {
            const quoteAmount = result.x402Quote.amountQuotedUsdc;
            const receiptAmount = result.x402Receipt.amountPaidUsdc;
            
            if (Math.abs(quoteAmount - receiptAmount) < 0.0001) {
              logger.logInfo(`   ✅ Receipt matches quote (${quoteAmount.toFixed(4)} USDC)`);
            } else {
              logger.logInfo(`   ⚠️  MISMATCH: Quote was ${quoteAmount.toFixed(4)} USDC but receipt shows ${receiptAmount.toFixed(4)} USDC`);
              logger.logInfo(`      This suggests the backend is not returning the correct amount in x402Receipt`);
              logger.logInfo(`      Backend should parse actual transaction amount, not use cached value`);
            }
          }
        } else {
          logger.logInfo('📋 Payment Receipt:');
          logger.logInfo('   ⚠️  WARNING: x402Receipt is missing from response');
          logger.logInfo('      The backend should return x402Receipt with amountPaidUsdc after payment');
          if (result.x402Quote) {
            logger.logInfo(`   💡 We paid ${result.x402Quote.amountQuotedUsdc.toFixed(4)} USDC (from quote)`);
            logger.logInfo(`      Backend should confirm this amount in x402Receipt`);
          }
        }
      }
      
      // Parse response
      let parsedResult: any = null;
      try {
        parsedResult = JSON.parse(result.response);
        logger.logOutput('Parsed JSON Response', parsedResult);
      } catch {
        logger.logInfo('Response is not JSON, extracting keywords from text...');
        const response = result.response.trim();
        const keywordMatches = response.match(/(?:keywords?|focus|topics?):\s*([^\n]+)/i);
        const keywords = keywordMatches 
          ? keywordMatches[1].split(',').map(k => k.trim()).filter(k => k.length > 0)
          : [];
        parsedResult = {
          focusArea: response.substring(0, 200),
          keywords: keywords.length > 0 ? keywords : [],
          topics: ['crypto', 'tech', 'culture'],
          reasoning: response,
        };
        logger.logOutput('Extracted Result', parsedResult);
      }
      
      // Log payment info
      if (result.transactionSignature) {
        let actualAmount: number;
        let amountSource: string;
        
        if (result.x402Receipt?.amountPaidUsdc !== undefined) {
          // Use actual amount from receipt
          actualAmount = result.x402Receipt.amountPaidUsdc;
          amountSource = 'actual (from x402Receipt)';
        } else {
          // No receipt - this shouldn't happen but log a warning
          logger.logInfo('⚠️  WARNING: x402Receipt not found in response. Cannot determine actual payment amount.');
          logger.logInfo('   The backend should return x402Receipt with amountPaidUsdc after payment.');
          actualAmount = 0.01; // Fallback (should not be used)
          amountSource = 'fallback (receipt missing - backend should return x402Receipt)';
        }
        
        // Get payer and merchant from receipt or wallet
        const payer = result.x402Receipt?.payer || wallet.publicKey.toString();
        const merchant = result.x402Receipt?.merchant || result.x402Receipt?.payTo;
        
        // Use quote amount if available (what we actually paid), otherwise use receipt amount
        const paymentAmount = result.x402Quote?.amountQuotedUsdc || actualAmount;
        
        logger.logPayment('briefputer', paymentAmount, result.transactionSignature, payer, merchant);
        
        if (result.x402Quote) {
          logger.logInfo(`Payment amount: ${paymentAmount.toFixed(4)} USDC (from 402 quote)`);
        } else {
          logger.logInfo(`Payment amount source: ${amountSource}`);
        }
        
        // Log receipt details if available
        if (result.x402Receipt) {
          logger.logOutput('x402Receipt Details', {
            amountPaidUsdc: result.x402Receipt.amountPaidUsdc,
            amountPaidMicroUsdc: result.x402Receipt.amountPaidMicroUsdc,
            payTo: result.x402Receipt.payTo,
            payer: result.x402Receipt.payer,
            merchant: result.x402Receipt.merchant,
            timestamp: result.x402Receipt.timestamp,
            transactionSignature: result.x402Receipt.transactionSignature,
            solscanTxUrl: getSolscanTxUrl(result.x402Receipt.transactionSignature || result.transactionSignature, network),
            solscanPayerUrl: getSolscanAccountUrl(result.x402Receipt.payer || payer, network),
            solscanMerchantUrl: getSolscanAccountUrl(result.x402Receipt.merchant || result.x402Receipt.payTo || merchant || '', network),
          });
        } else {
          logger.logInfo('⚠️  x402Receipt is missing from API response');
        }
      }
      
      // Save result if requested
      if (opts.saveResult) {
        saveStepResult('step1', {
          task,
          prompt,
          result: parsedResult,
          payment: result.x402Receipt,
          transactionSignature: result.transactionSignature,
        });
      }
      
      logger.logSuccess('Step 1 completed successfully!');
      console.log('\n📋 Focus Plan:');
      console.log(`   Focus Area: ${parsedResult.focusArea || 'N/A'}`);
      console.log(`   Keywords: ${parsedResult.keywords?.join(', ') || 'none'}`);
      console.log(`   Topics: ${parsedResult.topics?.join(', ') || 'none'}`);
      console.log(`   Reasoning: ${parsedResult.reasoning?.substring(0, 200) || 'N/A'}...`);
      
    } catch (error) {
      logger.logError('Step 1 failed', error);
      process.exit(1);
    }
  });

// Step 2: Decide whether to get trends
program
  .command('step2')
  .description('Step 2: Decide whether to get trends')
  .option('--task <description>', 'DEPRECATED: Task is fixed', 'Find relevant topics and create a meme about them')
  .option('--orchestrator-wallet <path>', 'Path to orchestrator wallet')
  .option('--api-base <url>', 'Memeputer API base URL')
  .option('--rpc-url <url>', 'Solana RPC URL')
  .option('--save-result', 'Save result to file')
  .action(async (opts) => {
    const logger = new StepLogger('STEP2');
    
    try {
      const apiBase = opts.apiBase || process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL || 'https://agents.api.memeputer.com';
      const rpcUrl = opts.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const walletPath = getWalletPath(opts);
      const wallet = loadWallet(walletPath);
      const connection = new Connection(rpcUrl, 'confirmed');
      // Fixed task
      const task = 'Find relevant topics and create a meme about them';
      
      if (opts.task && opts.task !== task) {
        logger.logInfo(`⚠️  Note: --task option is deprecated. Using fixed task: "${task}"`);
      }
      const network = detectNetwork(rpcUrl);
      
      logger.setNetwork(network);
      logger.logInfo('Step 2: Ask BriefPuter whether to get trends');
      logger.logInput('Task', task);
      
      const prompt = `I have a task: "${task}"

Should I get trending topics to help me complete this task? Consider:
- Does the task benefit from current trends?
- Would trending content make this more engaging?
- Is the task too specific to need trends?

Respond in this exact JSON format:
{
  "decision": "yes" or "no",
  "reasoning": "Brief explanation of your decision"
}`;
      
      logger.logInput('Prompt to BriefPuter', prompt);
      
      const apiClient = new AgentsApiClient(apiBase);
      logger.logInfo('Calling BriefPuter via API...');
      
      const result = await apiClient.interact(
        'briefputer',
        prompt,
        wallet,
        connection
      ) as InteractionResultWithReceipt;
      
      logger.logOutput('Raw API Response', {
        format: result.format,
        response: result.response,
        transactionSignature: result.transactionSignature,
        x402Receipt: result.x402Receipt,
      });
      
      // Parse JSON response
      let parsedResponse: { decision?: string; reasoning?: string } | null = null;
      let decision: boolean;
      
      try {
        parsedResponse = JSON.parse(result.response);
        const decisionStr = parsedResponse.decision?.toLowerCase() || '';
        decision = decisionStr === 'yes' || decisionStr.startsWith('y');
      } catch {
        // Fallback to text parsing if JSON parsing fails
        const response = result.response.trim().toLowerCase();
        decision = response.includes('yes') || response.startsWith('y');
        parsedResponse = {
          decision: decision ? 'yes' : 'no',
          reasoning: result.response,
        };
      }
      
      logger.logOutput('Decision', {
        rawResponse: result.response,
        parsedResponse: parsedResponse,
        decision: decision ? 'YES - Get trends' : 'NO - Skip trends',
        reasoning: parsedResponse?.reasoning || 'N/A',
      });
      
      if (result.transactionSignature) {
        let actualAmount: number;
        let amountSource: string;
        
        if (result.x402Receipt?.amountPaidUsdc !== undefined) {
          actualAmount = result.x402Receipt.amountPaidUsdc;
          amountSource = 'actual (from x402Receipt)';
        } else {
          logger.logInfo('⚠️  WARNING: x402Receipt not found in response.');
          actualAmount = 0.01;
          amountSource = 'fallback (receipt missing)';
        }
        
        const payer = result.x402Receipt?.payer || wallet.publicKey.toString();
        const merchant = result.x402Receipt?.merchant || result.x402Receipt?.payTo;
        
        // Use quote amount if available (what we actually paid), otherwise use receipt amount
        const paymentAmount = result.x402Quote?.amountQuotedUsdc || actualAmount;
        
        logger.logPayment('briefputer', paymentAmount, result.transactionSignature, payer, merchant);
        
        if (result.x402Quote) {
          logger.logInfo(`Payment amount: ${paymentAmount.toFixed(4)} USDC (from 402 quote)`);
        } else {
          logger.logInfo(`Payment amount source: ${amountSource}`);
        }
        
        if (result.x402Receipt) {
          logger.logOutput('x402Receipt Details', {
            ...result.x402Receipt,
            solscanTxUrl: getSolscanTxUrl(result.x402Receipt.transactionSignature || result.transactionSignature, network),
            solscanPayerUrl: getSolscanAccountUrl(result.x402Receipt.payer || payer, network),
            solscanMerchantUrl: getSolscanAccountUrl(result.x402Receipt.merchant || result.x402Receipt.payTo || merchant || '', network),
          });
        }
      }
      
      if (opts.saveResult) {
        saveStepResult('step1', {
          task,
          prompt,
          decision,
          response: result.response,
          payment: result.x402Receipt,
          transactionSignature: result.transactionSignature,
        });
      }
      
      logger.logSuccess(`Step 2 completed! Decision: ${decision ? 'YES - Get trends' : 'NO - Skip trends'}`);
      
    } catch (error) {
      logger.logError('Step 2 failed', error);
      process.exit(1);
    }
  });

// Combined Step 1-2: Run step 1 then step 2 together
program
  .command('step1-2')
  .description('Step 1-2: Ask BriefPuter what to focus on, then ask whether to get trends')
  .option('--task <description>', 'DEPRECATED: Task is fixed', 'Find relevant topics and create a meme about them')
  .option('--orchestrator-wallet <path>', 'Path to orchestrator wallet')
  .option('--api-base <url>', 'Memeputer API base URL')
  .option('--rpc-url <url>', 'Solana RPC URL')
  .option('--save-result', 'Save result to file')
  .action(async (opts) => {
    const logger = new StepLogger('STEP1-2');
    
    try {
      // Load configuration
      const apiBase = opts.apiBase || process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL || 'https://agents.api.memeputer.com';
      const rpcUrl = opts.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const walletPath = getWalletPath(opts);
      const wallet = loadWallet(walletPath);
      const connection = new Connection(rpcUrl, 'confirmed');
      // Fixed task
      const task = 'Find relevant topics and create a meme about them';
      
      if (opts.task && opts.task !== task) {
        logger.logInfo(`⚠️  Note: --task option is deprecated. Using fixed task: "${task}"`);
      }
      const network = detectNetwork(rpcUrl);
      
      logger.setNetwork(network);
      logger.logInfo('Running Step 1-2: Focus planning then trend decision');
      logger.logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.logInfo('STEP 1: Ask BriefPuter what to focus on');
      logger.logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Step 1: Ask what to focus on
      const step1Logger = new StepLogger('STEP1');
      step1Logger.setNetwork(network);
      
      const step1Prompt = `I'm an orchestrator agent with a task: "${task}"

Before I start looking for trends, help me think about what I should focus on. Consider:
- What topics would be most relevant to this task?
- What keywords or themes should I investigate?
- What's the goal of this content?

Respond in this exact JSON format:
{
  "focusArea": "1-2 sentence description of primary focus",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "topics": ["crypto", "tech", "culture"],
  "reasoning": "Why these topics/keywords are relevant"
}`;
      
      step1Logger.logInput('Prompt to BriefPuter', step1Prompt);
      
      const apiClient = new AgentsApiClient(apiBase);
      step1Logger.logInfo('Calling BriefPuter via API...');
      
      const step1Result = await apiClient.interact(
        'briefputer',
        step1Prompt,
        wallet,
        connection
      ) as InteractionResultWithReceipt;
      
      // Parse step 1 response
      let focusPlan: any = null;
      try {
        focusPlan = JSON.parse(step1Result.response);
        step1Logger.logOutput('Parsed JSON Response', focusPlan);
      } catch {
        step1Logger.logInfo('Response is not JSON, extracting keywords from text...');
        const response = step1Result.response.trim();
        const keywordMatches = response.match(/(?:keywords?|focus|topics?):\s*([^\n]+)/i);
        const keywords = keywordMatches 
          ? keywordMatches[1].split(',').map(k => k.trim()).filter(k => k.length > 0)
          : [];
        focusPlan = {
          focusArea: response.substring(0, 200),
          keywords: keywords.length > 0 ? keywords : [],
          topics: ['crypto', 'tech', 'culture'],
          reasoning: response,
        };
        step1Logger.logOutput('Extracted Result', focusPlan);
      }
      
      // Log step 1 payment
      if (step1Result.transactionSignature) {
        const step1PaymentAmount = step1Result.x402Quote?.amountQuotedUsdc || step1Result.x402Receipt?.amountPaidUsdc || 0.02;
        const step1Payer = step1Result.x402Receipt?.payer || wallet.publicKey.toString();
        const step1Merchant = step1Result.x402Receipt?.merchant || step1Result.x402Receipt?.payTo;
        step1Logger.logPayment('briefputer', step1PaymentAmount, step1Result.transactionSignature, step1Payer, step1Merchant);
      }
      
      step1Logger.logSuccess('Step 1 completed!');
      console.log('\n📋 Focus Plan:');
      console.log(`   Focus Area: ${focusPlan.focusArea || 'N/A'}`);
      console.log(`   Keywords: ${focusPlan.keywords?.join(', ') || 'none'}`);
      console.log(`   Topics: ${focusPlan.topics?.join(', ') || 'none'}`);
      
      // Step 2: Ask whether to get trends (using focus plan from step 1)
      logger.logInfo('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.logInfo('STEP 2: Ask BriefPuter whether to get trends');
      logger.logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const step2Logger = new StepLogger('STEP2');
      step2Logger.setNetwork(network);
      
      // Build context from step 1's focus plan
      const focusContext = focusPlan ? `
Based on my focus planning, I've identified:
- Focus Area: ${focusPlan.focusArea || 'N/A'}
- Keywords to investigate: ${focusPlan.keywords?.join(', ') || 'none'}
- Topics of interest: ${focusPlan.topics?.join(', ') || 'none'}
- Reasoning: ${focusPlan.reasoning?.substring(0, 200) || 'N/A'}${focusPlan.reasoning && focusPlan.reasoning.length > 200 ? '...' : ''}
` : '';
      
      const step2Prompt = `I have a task: "${task}"${focusContext}
Should I get trending topics to help me complete this task? Consider:
- Does the task benefit from current trends?
- Would trending content make this more engaging?
- Is the task too specific to need trends?
- How do the focus keywords and topics I identified relate to current trends?

Respond in this exact JSON format:
{
  "decision": "yes" or "no",
  "reasoning": "Brief explanation of your decision"
}`;
      
      step2Logger.logInput('Prompt to BriefPuter', step2Prompt);
      step2Logger.logInfo('Calling BriefPuter via API...');
      
      const step2Result = await apiClient.interact(
        'briefputer',
        step2Prompt,
        wallet,
        connection
      ) as InteractionResultWithReceipt;
      
      step2Logger.logOutput('Raw API Response', {
        format: step2Result.format,
        response: step2Result.response,
        transactionSignature: step2Result.transactionSignature,
        x402Receipt: step2Result.x402Receipt,
      });
      
      // Parse step 2 response
      let parsedResponse: { decision?: string; reasoning?: string } | null = null;
      let decision: boolean;
      
      try {
        parsedResponse = JSON.parse(step2Result.response);
        const decisionStr = parsedResponse.decision?.toLowerCase() || '';
        decision = decisionStr === 'yes' || decisionStr.startsWith('y');
      } catch {
        // Fallback to text parsing if JSON parsing fails
        const response = step2Result.response.trim().toLowerCase();
        decision = response.includes('yes') || response.startsWith('y');
        parsedResponse = {
          decision: decision ? 'yes' : 'no',
          reasoning: step2Result.response,
        };
      }
      
      step2Logger.logOutput('Decision', {
        rawResponse: step2Result.response,
        parsedResponse: parsedResponse,
        decision: decision ? 'YES - Get trends' : 'NO - Skip trends',
        reasoning: parsedResponse?.reasoning || 'N/A',
      });
      
      // Log step 2 payment
      if (step2Result.transactionSignature) {
        const step2PaymentAmount = step2Result.x402Quote?.amountQuotedUsdc || step2Result.x402Receipt?.amountPaidUsdc || 0.02;
        const step2Payer = step2Result.x402Receipt?.payer || wallet.publicKey.toString();
        const step2Merchant = step2Result.x402Receipt?.merchant || step2Result.x402Receipt?.payTo;
        step2Logger.logPayment('briefputer', step2PaymentAmount, step2Result.transactionSignature, step2Payer, step2Merchant);
      }
      
      step2Logger.logSuccess(`Step 2 completed! Decision: ${decision ? 'YES - Get trends' : 'NO - Skip trends'}`);
      
      // Summary
      logger.logInfo('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.logInfo('📊 STEP 1-2 SUMMARY');
      logger.logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.logInfo(`✅ Step 1: Focus plan created`);
      logger.logInfo(`   Focus Area: ${focusPlan.focusArea || 'N/A'}`);
      logger.logInfo(`   Keywords: ${focusPlan.keywords?.join(', ') || 'none'}`);
      logger.logInfo(`✅ Step 2: Decision made`);
      logger.logInfo(`   Decision: ${decision ? 'YES - Get trends' : 'NO - Skip trends'}`);
      if (parsedResponse?.reasoning) {
        logger.logInfo(`   Reasoning: ${parsedResponse.reasoning.substring(0, 150)}${parsedResponse.reasoning.length > 150 ? '...' : ''}`);
      }
      
      // Calculate total payments
      const step1Amount = step1Result.x402Quote?.amountQuotedUsdc || step1Result.x402Receipt?.amountPaidUsdc || 0;
      const step2Amount = step2Result.x402Quote?.amountQuotedUsdc || step2Result.x402Receipt?.amountPaidUsdc || 0;
      const totalAmount = step1Amount + step2Amount;
      
      logger.logInfo(`\n💰 Total Payments:`);
      logger.logInfo(`   Step 1: ${step1Amount.toFixed(4)} USDC`);
      logger.logInfo(`   Step 2: ${step2Amount.toFixed(4)} USDC`);
      logger.logInfo(`   Total: ${totalAmount.toFixed(4)} USDC`);
      
      // Save result if requested
      if (opts.saveResult) {
        saveStepResult('step1-2', {
          task,
          step1: {
            focusPlan,
            payment: step1Result.x402Receipt,
            transactionSignature: step1Result.transactionSignature,
          },
          step2: {
            decision,
            parsedResponse,
            payment: step2Result.x402Receipt,
            transactionSignature: step2Result.transactionSignature,
          },
          totalAmount,
        });
      }
      
      logger.logSuccess('Step 1-2 completed successfully!');
      
    } catch (error) {
      logger.logError('Step 1-2 failed', error);
      process.exit(1);
    }
  });

// Step 3: Get trends from TrendPuter
program
  .command('step3')
  .description('Step 3: Get trends from TrendPuter')
  .option('--task <description>', 'DEPRECATED: Task is fixed', 'Find relevant topics and create a meme about them')
  .option('--keywords <keywords>', 'Comma-separated keywords to focus on')
  .option('--orchestrator-wallet <path>', 'Path to orchestrator wallet')
  .option('--api-base <url>', 'Memeputer API base URL')
  .option('--rpc-url <url>', 'Solana RPC URL')
  .option('--save-result', 'Save result to file')
  .action(async (opts) => {
    const logger = new StepLogger('STEP3');
    
    try {
      const apiBase = opts.apiBase || process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL || 'https://agents.api.memeputer.com';
      const rpcUrl = opts.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const walletPath = getWalletPath(opts);
      const wallet = loadWallet(walletPath);
      const connection = new Connection(rpcUrl, 'confirmed');
      // Fixed task
      const task = 'Find relevant topics and create a meme about them';
      
      if (opts.task && opts.task !== task) {
        logger.logInfo(`⚠️  Note: --task option is deprecated. Using fixed task: "${task}"`);
      }
      const keywords = opts.keywords ? opts.keywords.split(',').map(k => k.trim()) : [];
      const network = detectNetwork(rpcUrl);
      
      logger.setNetwork(network);
      logger.logInfo('Starting Step 1a: Get trends from TrendPuter');
      logger.logInput('Task', task);
      logger.logInput('Keywords', keywords);
      
      const keywordsContext = keywords.length > 0
        ? ` Focus on: ${keywords.join(', ')}.`
        : '';
      
      const trendPrompt = `Investigate the most compelling news stories of the day.${keywordsContext} Context: ${task}. Return exactly 10 trends as JSON: {"items": [{"title": "...", "summary": "..."}]}`;
      
      logger.logInput('Prompt to TrendPuter', trendPrompt);
      
      const apiClient = new AgentsApiClient(apiBase);
      logger.logInfo('Calling TrendPuter via API...');
      
      const result = await apiClient.interact(
        'trendputer',
        trendPrompt,
        wallet,
        connection
      ) as InteractionResultWithReceipt;
      
      logger.logOutput('Raw API Response', {
        format: result.format,
        responseLength: result.response.length,
        responsePreview: result.response.substring(0, 500),
        transactionSignature: result.transactionSignature,
        x402Receipt: result.x402Receipt,
      });
      
      // Try to parse JSON
      let trends: any = null;
      try {
        trends = JSON.parse(result.response);
        logger.logOutput('Parsed Trends JSON', trends);
        logger.logInfo(`Successfully parsed ${trends?.items?.length || 0} trends`);
      } catch (parseError) {
        logger.logInfo('Failed to parse JSON, attempting to extract from markdown...');
        const jsonMatch = result.response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                         result.response.match(/(\{[\s\S]*"items"[\s\S]*\})/);
        if (jsonMatch) {
          try {
            trends = JSON.parse(jsonMatch[1]);
            logger.logOutput('Extracted Trends JSON', trends);
            logger.logInfo(`Successfully extracted ${trends?.items?.length || 0} trends`);
          } catch {
            logger.logError('Failed to parse extracted JSON');
            trends = { items: [] };
          }
        } else {
          logger.logError('No JSON found in response');
          trends = { items: [] };
        }
      }
      
      if (result.transactionSignature) {
        let actualAmount: number;
        let amountSource: string;
        
        if (result.x402Receipt?.amountPaidUsdc !== undefined) {
          actualAmount = result.x402Receipt.amountPaidUsdc;
          amountSource = 'actual (from x402Receipt)';
        } else {
          logger.logInfo('⚠️  WARNING: x402Receipt not found in response.');
          actualAmount = 0.01;
          amountSource = 'fallback (receipt missing)';
        }
        
        const payer = result.x402Receipt?.payer || wallet.publicKey.toString();
        const merchant = result.x402Receipt?.merchant || result.x402Receipt?.payTo;
        
        // Use quote amount if available (what we actually paid), otherwise use receipt amount
        const paymentAmount = result.x402Quote?.amountQuotedUsdc || actualAmount;
        
        logger.logPayment('trendputer', paymentAmount, result.transactionSignature, payer, merchant);
        
        if (result.x402Quote) {
          logger.logInfo(`Payment amount: ${paymentAmount.toFixed(4)} USDC (from 402 quote)`);
        } else {
          logger.logInfo(`Payment amount source: ${amountSource}`);
        }
        
        if (result.x402Receipt) {
          logger.logOutput('x402Receipt Details', {
            ...result.x402Receipt,
            solscanTxUrl: getSolscanTxUrl(result.x402Receipt.transactionSignature || result.transactionSignature, network),
            solscanPayerUrl: getSolscanAccountUrl(result.x402Receipt.payer || payer, network),
            solscanMerchantUrl: getSolscanAccountUrl(result.x402Receipt.merchant || result.x402Receipt.payTo || merchant || '', network),
          });
        }
      }
      
      // Always save trends result so step 4 can use it
      const trendsResult = {
        task,
        keywords,
        prompt: trendPrompt,
        trends,
        rawResponse: result.response,
        payment: result.x402Receipt,
        transactionSignature: result.transactionSignature,
      };
      
      // Save with predictable filename for step 4
      const resultDir = join(process.cwd(), 'step-results');
      if (!existsSync(resultDir)) {
        require('fs').mkdirSync(resultDir, { recursive: true });
      }
      const latestPath = join(resultDir, 'step3-latest.json');
      writeFileSync(latestPath, JSON.stringify(trendsResult, null, 2));
      logger.logInfo(`\n💾 Saved trends to: ${latestPath} (for use in step 4)`);
      
      // Also save timestamped version if --save-result is passed
      if (opts.saveResult) {
        saveStepResult('step3', trendsResult);
      }
      
      logger.logSuccess(`Step 3 completed! Found ${trends?.items?.length || 0} trends`);
      
      if (trends?.items && trends.items.length > 0) {
        console.log('\n📊 Trends:');
        trends.items.slice(0, 5).forEach((trend: any, idx: number) => {
          console.log(`\n   ${idx + 1}. ${trend.title || 'Untitled'}`);
          console.log(`      Summary: ${(trend.summary || '').substring(0, 100)}...`);
        });
        if (trends.items.length > 5) {
          console.log(`\n   ... and ${trends.items.length - 5} more`);
        }
      }
      
    } catch (error) {
      logger.logError('Step 3 failed', error);
      process.exit(1);
    }
  });

// Step 4: Select best trend
program
  .command('step4')
  .description('Step 4: Select best trend from list')
  .option('--task <description>', 'DEPRECATED: Task is fixed', 'Find relevant topics and create a meme about them')
  .option('--trends-file <path>', 'Path to JSON file with trends (from step3)')
  .option('--trends-json <json>', 'JSON string with trends')
  .option('--orchestrator-wallet <path>', 'Path to orchestrator wallet')
  .option('--api-base <url>', 'Memeputer API base URL')
  .option('--rpc-url <url>', 'Solana RPC URL')
  .option('--save-result', 'Save result to file')
  .action(async (opts) => {
    const logger = new StepLogger('STEP4');
    
    try {
      const apiBase = opts.apiBase || process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL || 'https://agents.api.memeputer.com';
      const rpcUrl = opts.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const walletPath = getWalletPath(opts);
      const wallet = loadWallet(walletPath);
      const connection = new Connection(rpcUrl, 'confirmed');
      // Fixed task
      const task = 'Find relevant topics and create a meme about them';
      
      if (opts.task && opts.task !== task) {
        logger.logInfo(`⚠️  Note: --task option is deprecated. Using fixed task: "${task}"`);
      }
      const network = detectNetwork(rpcUrl);
      
      logger.setNetwork(network);
      
      // Load trends from file, JSON string, or latest step3 result
      let trends: any[] = [];
      if (opts.trendsFile) {
        const trendsContent = readFileSync(opts.trendsFile, 'utf-8');
        const trendsData = JSON.parse(trendsContent);
        trends = trendsData.trends?.items || trendsData.items || trendsData.trends || [];
      } else if (opts.trendsJson) {
        const trendsData = JSON.parse(opts.trendsJson);
        trends = trendsData.items || trendsData.trends?.items || trendsData.trends || [];
      } else {
        // Try to load from latest step3 result
        const latestPath = join(process.cwd(), 'step-results', 'step3-latest.json');
        if (existsSync(latestPath)) {
          logger.logInfo(`📂 Loading trends from latest step3 result: ${latestPath}`);
          const trendsData = JSON.parse(readFileSync(latestPath, 'utf-8'));
          trends = trendsData.trends?.items || trendsData.trends || [];
          if (!trends || trends.length === 0) {
            throw new Error('No trends found in step3-latest.json. Please run step3 first.');
          }
        } else {
          throw new Error('Must provide --trends-file or --trends-json, or run step3 first to generate step-results/step3-latest.json');
        }
      }
      
      logger.logInfo('Step 4: Select best trend from list');
      logger.logInput('Task', task);
      logger.logInput('Number of Trends', trends.length);
      logger.logInput('Trends', trends);
      
      if (trends.length === 0) {
        logger.logError('No trends provided');
        process.exit(1);
      }
      
      const trendsList = trends.map((t, idx) => 
        `${idx + 1}. "${t.title || 'Untitled'}": ${(t.summary || '').substring(0, 100)}${(t.summary || '').length > 100 ? '...' : ''}`
      ).join('\n');
      
      const evaluationPrompt = `I need to evaluate ${trends.length} trending topics and pick the best one for this task: "${task}"

Here are the trends:
${trendsList}

Please evaluate these trends and tell me which ONE is the best fit. Consider:
- Relevance to the task
- Quality and credibility  
- Potential for engaging content

Respond with ONLY the number (1-${trends.length}) of the best trend. If none are suitable, respond with "0".`;
      
      logger.logInput('Evaluation Prompt to BriefPuter', evaluationPrompt);
      
      const apiClient = new AgentsApiClient(apiBase);
      logger.logInfo('Calling BriefPuter to evaluate trends...');
      
      const result = await apiClient.interact(
        'briefputer',
        evaluationPrompt,
        wallet,
        connection
      ) as InteractionResultWithReceipt;
      
      logger.logOutput('Raw API Response', {
        format: result.format,
        response: result.response,
        transactionSignature: result.transactionSignature,
        x402Receipt: result.x402Receipt,
      });
      
      // Parse response
      const response = result.response.trim();
      const selectedNumber = parseInt(response.match(/\d+/)?.[0] || '0');
      
      let selectedTrend: any = null;
      if (selectedNumber > 0 && selectedNumber <= trends.length) {
        selectedTrend = trends[selectedNumber - 1];
        logger.logSuccess(`Selected trend #${selectedNumber}`);
      } else {
        logger.logInfo('No suitable trend found (response: 0)');
      }
      
      logger.logOutput('Selected Trend', selectedTrend);
      
      if (result.transactionSignature) {
        let actualAmount: number;
        let amountSource: string;
        
        if (result.x402Receipt?.amountPaidUsdc !== undefined) {
          actualAmount = result.x402Receipt.amountPaidUsdc;
          amountSource = 'actual (from x402Receipt)';
        } else {
          logger.logInfo('⚠️  WARNING: x402Receipt not found in response.');
          actualAmount = 0.01;
          amountSource = 'fallback (receipt missing)';
        }
        
        const payer = result.x402Receipt?.payer || wallet.publicKey.toString();
        const merchant = result.x402Receipt?.merchant || result.x402Receipt?.payTo;
        
        // Use quote amount if available (what we actually paid), otherwise use receipt amount
        const paymentAmount = result.x402Quote?.amountQuotedUsdc || actualAmount;
        
        logger.logPayment('briefputer', paymentAmount, result.transactionSignature, payer, merchant);
        
        if (result.x402Quote) {
          logger.logInfo(`Payment amount: ${paymentAmount.toFixed(4)} USDC (from 402 quote)`);
        } else {
          logger.logInfo(`Payment amount source: ${amountSource}`);
        }
        
        if (result.x402Receipt) {
          logger.logOutput('x402Receipt Details', {
            ...result.x402Receipt,
            solscanTxUrl: getSolscanTxUrl(result.x402Receipt.transactionSignature || result.transactionSignature, network),
            solscanPayerUrl: getSolscanAccountUrl(result.x402Receipt.payer || payer, network),
            solscanMerchantUrl: getSolscanAccountUrl(result.x402Receipt.merchant || result.x402Receipt.payTo || merchant || '', network),
          });
        }
      }
      
      if (opts.saveResult) {
        saveStepResult('step4', {
          task,
          trends,
          evaluationPrompt,
          selectedNumber,
          selectedTrend,
          response: result.response,
          payment: result.x402Receipt,
          transactionSignature: result.transactionSignature,
        });
      }
      
      logger.logSuccess(`Step 4 completed! ${selectedTrend ? `Selected: "${selectedTrend.title}"` : 'No trend selected'}`);
      
    } catch (error) {
      logger.logError('Step 4 failed', error);
      process.exit(1);
    }
  });

// Step 5: Decide whether to generate brief
program
  .command('step5')
  .description('Step 5: Ask BriefPuter whether to generate a brief')
  .option('--task <description>', 'DEPRECATED: Task is fixed', 'Find relevant topics and create a meme about them')
  .option('--trend-file <path>', 'Path to JSON file with selected trend (from step4)')
  .option('--trend-json <json>', 'JSON string with selected trend')
  .option('--orchestrator-wallet <path>', 'Path to orchestrator wallet')
  .option('--api-base <url>', 'Memeputer API base URL')
  .option('--rpc-url <url>', 'Solana RPC URL')
  .option('--save-result', 'Save result to file')
  .action(async (opts) => {
    const logger = new StepLogger('STEP5');
    
    try {
      const apiBase = opts.apiBase || process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL || 'https://agents.api.memeputer.com';
      const rpcUrl = opts.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const walletPath = getWalletPath(opts);
      const wallet = loadWallet(walletPath);
      const connection = new Connection(rpcUrl, 'confirmed');
      // Fixed task
      const task = 'Find relevant topics and create a meme about them';
      
      if (opts.task && opts.task !== task) {
        logger.logInfo(`⚠️  Note: --task option is deprecated. Using fixed task: "${task}"`);
      }
      const network = detectNetwork(rpcUrl);
      
      logger.setNetwork(network);
      
      // Load trend if provided
      let selectedTrend: any = null;
      if (opts.trendFile) {
        const trendContent = readFileSync(opts.trendFile, 'utf-8');
        const trendData = JSON.parse(trendContent);
        selectedTrend = trendData.selectedTrend || trendData;
      } else if (opts.trendJson) {
        selectedTrend = JSON.parse(opts.trendJson);
      }
      
      logger.logInfo('Step 5: Ask BriefPuter whether to generate a brief');
      logger.logInput('Task', task);
      if (selectedTrend) {
        logger.logInput('Selected Trend', selectedTrend);
      }
      
      const trendInfo = selectedTrend 
        ? `I found a trend: "${selectedTrend.title}" - ${selectedTrend.summary?.substring(0, 100)}`
        : 'I have no trends';
      
      const prompt = `I have a task: "${task}"
${trendInfo}

Should I generate a creative brief before creating content? Consider:
- Would a brief help create better content?
- Is the task simple enough to skip the brief?
- Do I have enough context (trends) to create a useful brief?

Respond with ONLY "yes" or "no".`;
      
      logger.logInput('Prompt to BriefPuter', prompt);
      
      const apiClient = new AgentsApiClient(apiBase);
      logger.logInfo('Calling BriefPuter via API...');
      
      const result = await apiClient.interact(
        'briefputer',
        prompt,
        wallet,
        connection
      ) as InteractionResultWithReceipt;
      
      logger.logOutput('Raw API Response', {
        format: result.format,
        response: result.response,
        transactionSignature: result.transactionSignature,
        x402Receipt: result.x402Receipt,
      });
      
      const response = result.response.trim().toLowerCase();
      const decision = response.includes('yes') || response.startsWith('y');
      
      logger.logOutput('Decision', {
        rawResponse: result.response,
        normalizedResponse: response,
        decision: decision ? 'YES - Generate brief' : 'NO - Skip brief',
      });
      
      if (result.transactionSignature) {
        let actualAmount: number;
        let amountSource: string;
        
        if (result.x402Receipt?.amountPaidUsdc !== undefined) {
          actualAmount = result.x402Receipt.amountPaidUsdc;
          amountSource = 'actual (from x402Receipt)';
        } else {
          logger.logInfo('⚠️  WARNING: x402Receipt not found in response.');
          actualAmount = 0.01;
          amountSource = 'fallback (receipt missing)';
        }
        
        const payer = result.x402Receipt?.payer || wallet.publicKey.toString();
        const merchant = result.x402Receipt?.merchant || result.x402Receipt?.payTo;
        
        // Use quote amount if available (what we actually paid), otherwise use receipt amount
        const paymentAmount = result.x402Quote?.amountQuotedUsdc || actualAmount;
        
        logger.logPayment('briefputer', paymentAmount, result.transactionSignature, payer, merchant);
        
        if (result.x402Quote) {
          logger.logInfo(`Payment amount: ${paymentAmount.toFixed(4)} USDC (from 402 quote)`);
        } else {
          logger.logInfo(`Payment amount source: ${amountSource}`);
        }
        
        if (result.x402Receipt) {
          logger.logOutput('x402Receipt Details', {
            ...result.x402Receipt,
            solscanTxUrl: getSolscanTxUrl(result.x402Receipt.transactionSignature || result.transactionSignature, network),
            solscanPayerUrl: getSolscanAccountUrl(result.x402Receipt.payer || payer, network),
            solscanMerchantUrl: getSolscanAccountUrl(result.x402Receipt.merchant || result.x402Receipt.payTo || merchant || '', network),
          });
        }
      }
      
      if (opts.saveResult) {
        saveStepResult('step5', {
          task,
          selectedTrend,
          prompt,
          decision,
          response: result.response,
          payment: result.x402Receipt,
          transactionSignature: result.transactionSignature,
        });
      }
      
      logger.logSuccess(`Step 5 completed! Decision: ${decision ? 'YES - Generate brief' : 'NO - Skip brief'}`);
      
    } catch (error) {
      logger.logError('Step 5 failed', error);
      process.exit(1);
    }
  });

// Step 6: Generate brief
program
  .command('step6')
  .description('Step 6: Generate creative brief')
  .option('--task <description>', 'DEPRECATED: Task is fixed', 'Find relevant topics and create a meme about them')
  .option('--trend-file <path>', 'Path to JSON file with selected trend')
  .option('--trend-json <json>', 'JSON string with selected trend')
  .option('--brand <path>', 'Path to brand config JSON file')
  .option('--orchestrator-wallet <path>', 'Path to orchestrator wallet')
  .option('--api-base <url>', 'Memeputer API base URL')
  .option('--rpc-url <url>', 'Solana RPC URL')
  .option('--save-result', 'Save result to file')
  .action(async (opts) => {
    const logger = new StepLogger('STEP6');
    
    try {
      const apiBase = opts.apiBase || process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL || 'https://agents.api.memeputer.com';
      const rpcUrl = opts.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const walletPath = getWalletPath(opts);
      const wallet = loadWallet(walletPath);
      const connection = new Connection(rpcUrl, 'confirmed');
      // Fixed task
      const task = 'Find relevant topics and create a meme about them';
      
      if (opts.task && opts.task !== task) {
        logger.logInfo(`⚠️  Note: --task option is deprecated. Using fixed task: "${task}"`);
      }
      const network = detectNetwork(rpcUrl);
      
      logger.setNetwork(network);
      
      // Load trend
      let trendItem: any = null;
      if (opts.trendFile) {
        const trendContent = readFileSync(opts.trendFile, 'utf-8');
        const trendData = JSON.parse(trendContent);
        trendItem = trendData.selectedTrend || trendData;
      } else if (opts.trendJson) {
        trendItem = JSON.parse(opts.trendJson);
      } else {
        trendItem = {
          title: task,
          summary: task,
          source: 'USER',
        };
      }
      
      // Load brand profile if provided
      let brandProfile: BrandProfile | undefined;
      if (opts.brand) {
        const brandPath = opts.brand.startsWith('~/') 
          ? opts.brand.replace('~', homedir())
          : opts.brand;
        
        if (!existsSync(brandPath)) {
          const brandsPath = join(process.cwd(), 'brands', brandPath);
          if (existsSync(brandsPath)) {
            const brandContent = readFileSync(brandsPath, 'utf-8');
            brandProfile = BrandProfileSchema.parse(JSON.parse(brandContent));
          }
        } else {
          const brandContent = readFileSync(brandPath, 'utf-8');
          brandProfile = BrandProfileSchema.parse(JSON.parse(brandContent));
        }
      }
      
      logger.logInfo('Step 6: Generate creative brief');
      logger.logInput('Task', task);
      logger.logInput('Trend Item', trendItem);
      if (brandProfile) {
        logger.logInput('Brand Profile', brandProfile);
      }
      
      const message = JSON.stringify({
        command: 'generate_brief',
        brandAgentId: brandProfile?.brandAgentId,
        brandProfile: brandProfile?.brandAgentId ? undefined : brandProfile,
        trendItem,
        policy: {
          denyTerms: brandProfile?.denyTerms || [],
          requireDisclaimer: false,
        },
      });
      
      logger.logInput('Message to BriefPuter', message);
      
      const apiClient = new AgentsApiClient(apiBase);
      logger.logInfo('Calling BriefPuter via API...');
      
      const result = await apiClient.interact(
        'briefputer',
        message,
        wallet,
        connection
      ) as InteractionResultWithReceipt;
      
      logger.logOutput('Raw API Response', {
        format: result.format,
        responseLength: result.response.length,
        responsePreview: result.response.substring(0, 500),
        transactionSignature: result.transactionSignature,
        x402Receipt: result.x402Receipt,
      });
      
      // Parse brief response
      let brief: any = null;
      try {
        const parsed = JSON.parse(result.response);
        brief = parsed.data || parsed;
        logger.logOutput('Parsed Brief JSON', brief);
      } catch {
        logger.logInfo('Response is not JSON');
        brief = { brief: null };
      }
      
      if (result.transactionSignature) {
        let actualAmount: number;
        let amountSource: string;
        
        if (result.x402Receipt?.amountPaidUsdc !== undefined) {
          actualAmount = result.x402Receipt.amountPaidUsdc;
          amountSource = 'actual (from x402Receipt)';
        } else {
          logger.logInfo('⚠️  WARNING: x402Receipt not found in response.');
          actualAmount = 0.01;
          amountSource = 'fallback (receipt missing)';
        }
        
        const payer = result.x402Receipt?.payer || wallet.publicKey.toString();
        const merchant = result.x402Receipt?.merchant || result.x402Receipt?.payTo;
        
        // Use quote amount if available (what we actually paid), otherwise use receipt amount
        const paymentAmount = result.x402Quote?.amountQuotedUsdc || actualAmount;
        
        logger.logPayment('briefputer', paymentAmount, result.transactionSignature, payer, merchant);
        
        if (result.x402Quote) {
          logger.logInfo(`Payment amount: ${paymentAmount.toFixed(4)} USDC (from 402 quote)`);
        } else {
          logger.logInfo(`Payment amount source: ${amountSource}`);
        }
        
        if (result.x402Receipt) {
          logger.logOutput('x402Receipt Details', {
            ...result.x402Receipt,
            solscanTxUrl: getSolscanTxUrl(result.x402Receipt.transactionSignature || result.transactionSignature, network),
            solscanPayerUrl: getSolscanAccountUrl(result.x402Receipt.payer || payer, network),
            solscanMerchantUrl: getSolscanAccountUrl(result.x402Receipt.merchant || result.x402Receipt.payTo || merchant || '', network),
          });
        }
      }
      
      if (opts.saveResult) {
        saveStepResult('step6', {
          task,
          trendItem,
          brandProfile,
          brief,
          rawResponse: result.response,
          payment: result.x402Receipt,
          transactionSignature: result.transactionSignature,
        });
      }
      
      logger.logSuccess('Step 6 completed!');
      
      if (brief?.brief) {
        console.log('\n📝 Creative Brief:');
        console.log(`   Angle: ${brief.brief.angle || 'N/A'}`);
        console.log(`   Tone: ${brief.brief.tone || 'N/A'}`);
        if (brief.brief.visualStyle && brief.brief.visualStyle.length > 0) {
          console.log(`   Visual Style: ${brief.brief.visualStyle.join(', ')}`);
        }
        console.log(`   CTA: ${brief.brief.callToAction || 'N/A'}`);
      }
      
    } catch (error) {
      logger.logError('Step 6 failed', error);
      process.exit(1);
    }
  });

program.parse();

