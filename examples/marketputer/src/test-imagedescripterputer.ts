#!/usr/bin/env node
/**
 * Test ImageDescripterPuter in isolation
 * 
 * This script tests ImageDescripterPuter's describe_image command
 * without running the full orchestrator workflow.
 */

import 'dotenv/config';
import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join, homedir } from 'path';
import { Keypair, Connection } from '@solana/web3.js';
import { AgentsApiClient, InteractionResult } from '@memeputer/sdk';
import axios from 'axios';

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
  .name('test-imagedescripterputer')
  .description('Test ImageDescripterPuter describe_image command in isolation')
  .option('-w, --wallet <path>', 'Path to wallet keypair JSON file', join(process.cwd(), 'wallet.json'))
  .option('--api-base <url>', 'API base URL', process.env.MEMEPUTER_API_BASE || process.env.MEMEPUTER_API_URL || 'https://agents.api.memeputer.com')
  .option('--rpc-url <url>', 'Solana RPC URL', process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com')
  .option('--image-url <url>', 'Image URL to describe', 'https://auth.memeputer.com/storage/v1/object/public/pfp_uploads/cdb2eb7f-3805-43c1-94bc-ba7d4fd768db/7e63f8d1-0bff-41bc-a0cd-f169a6441a41/1761146631963.jpg')
  .option('--detail-level <level>', 'Detail level: brief, detailed, or comprehensive', 'detailed')
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

      console.log('\n🧪 Testing ImageDescripterPuter');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`API Base: ${opts.apiBase}`);
      console.log(`RPC URL: ${opts.rpcUrl}`);
      console.log(`Wallet: ${walletKeypair.publicKey.toString()}`);
      console.log(`Image URL: ${opts.imageUrl}`);
      console.log(`Detail Level: ${opts.detailLevel}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('📤 Calling ImageDescripterPuter with describe_image command...');
      
      const message = JSON.stringify({
        command: 'describe_image',
        imageUrl: opts.imageUrl,
        detailLevel: opts.detailLevel,
      });

      console.log(`\nRequest payload:`);
      console.log(JSON.stringify(JSON.parse(message), null, 2));

      const result = await apiClient.interact(
        'imagedescripterputer',
        message,
        walletKeypair,
        connection
      ) as InteractionResultWithReceipt;

      console.log('\n✅ Initial response received!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Debug: Log the full result object structure
      console.log('\n🔍 Debugging response structure:');
      console.log(`   result.statusUrl: ${(result as any).statusUrl || 'undefined'}`);
      console.log(`   result.response type: ${typeof result.response}`);
      console.log(`   result.response length: ${result.response.length}`);
      console.log(`   result.response preview: ${result.response.substring(0, 200)}`);
      console.log(`   result keys: ${Object.keys(result).join(', ')}`);
      
      // Check if this is an async job (like PFPputer)
      // statusUrl can be on the result object itself OR in the response JSON
      let statusUrl: string | null = null;
      let descriptionResult = result;
      
      // First check: statusUrl on result object (like PFPputer)
      if ((result as any).statusUrl) {
        statusUrl = (result as any).statusUrl;
        console.log(`\n✅ Found statusUrl on result object: ${statusUrl}`);
      }
      
      // Second check: statusUrl in response JSON
      if (!statusUrl) {
        try {
          const parsed = JSON.parse(result.response);
          console.log(`   Parsed JSON keys: ${Object.keys(parsed).join(', ')}`);
          if (parsed.statusUrl || parsed.data?.statusUrl) {
            statusUrl = parsed.statusUrl || parsed.data.statusUrl;
            console.log(`\n✅ Found statusUrl in response JSON: ${statusUrl}`);
          } else {
            console.log(`   No statusUrl in parsed JSON`);
            console.log(`   Full parsed response: ${JSON.stringify(parsed, null, 2).substring(0, 500)}`);
          }
        } catch (parseError) {
          console.log(`   Response is not valid JSON: ${parseError instanceof Error ? parseError.message : parseError}`);
        }
      }
      
      // If we have a statusUrl, we need to poll until completion
      if (statusUrl) {
        // Replace localhost URLs with actual API base, but preserve port if different
        // Only replace if API base is NOT localhost (production), or if ports match
        let pollingUrl = statusUrl;
        const statusUrlMatch = statusUrl.match(/http:\/\/localhost:(\d+)/);
        const apiBaseMatch = opts.apiBase.match(/http:\/\/localhost:(\d+)/);
        
        if (statusUrlMatch && apiBaseMatch) {
          // Both are localhost - only replace if ports match, otherwise keep original
          if (statusUrlMatch[1] === apiBaseMatch[1]) {
            pollingUrl = statusUrl.replace(/http:\/\/localhost:\d+/, opts.apiBase);
          }
          // If ports differ, keep the original URL (status endpoint might be on different port)
        } else if (!statusUrlMatch && opts.apiBase.includes('localhost')) {
          // Status URL is not localhost but API base is - don't replace
          pollingUrl = statusUrl;
        } else if (statusUrlMatch && !opts.apiBase.includes('localhost')) {
          // Status URL is localhost but API base is production - replace hostname only
          pollingUrl = statusUrl.replace(/http:\/\/localhost:\d+/, opts.apiBase);
        }
        
        console.log(`\n⏳ Image description is processing asynchronously...`);
        console.log(`🔄 Polling status URL: ${pollingUrl}`);
        
        // Poll for completion
        let attempts = 0;
        const maxAttempts = 120; // 2 minutes max
        const delayMs = 1000; // 1 second
        let pollingCompleted = false;
        
        while (attempts < maxAttempts && !pollingCompleted) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          attempts++;
          
          try {
            const response = await axios.get(pollingUrl);
            const data = response.data;
            
            // Log polling response for debugging
            if (attempts === 1 || attempts % 5 === 0) {
              console.log(`\n📊 Poll attempt ${attempts}:`);
              console.log(`   Status code: ${response.status}`);
              console.log(`   Data keys: ${Object.keys(data).join(', ')}`);
              console.log(`   Response data: ${JSON.stringify(data).substring(0, 400)}`);
            }
            
            // Check completion conditions - handle nested response structure
            // Response is nested: { data: { status, description, ... }, meta: {...} }
            const actualData = data.data || data; // Support both nested and flat structures
            const hasCompletedStatus = actualData.status === 'completed' || actualData.status === 'success';
            const hasDescription = !!actualData.description;
            const hasFailedStatus = actualData.status === 'failed';
            const hasError = !!actualData.error;
            
            if (hasCompletedStatus || hasDescription) {
              console.log(`\n✅ Image description completed successfully after ${attempts} seconds`);
              console.log(`   Status: ${actualData.status}, Has Description: ${hasDescription}`);
              // Update descriptionResult with the completed response (use actualData)
              descriptionResult = {
                ...result,
                response: JSON.stringify(actualData),
              };
              
              // Display the description immediately
              if (actualData.description) {
                console.log(`\n📝 Description:`);
                console.log(`   ${actualData.description.substring(0, 200)}${actualData.description.length > 200 ? '...' : ''}`);
              }
              pollingCompleted = true;
              break;
            } else if (hasFailedStatus || hasError) {
              console.log(`\n❌ Image description failed: ${actualData.error || 'Unknown error'}`);
              console.log(`   Failure check: status='${actualData.status}', hasError=${hasError}`);
              console.log(`   Full response: ${JSON.stringify(data)}`);
              pollingCompleted = true;
              break;
            } else {
              // Still processing - show what we're seeing
              if (attempts % 10 === 0) {
                console.log(`\n   ⏳ Still processing... (${attempts}s) - status='${actualData.status || 'undefined'}', hasDescription=${hasDescription}`);
              } else {
                process.stdout.write(`\r   ⏳ Still processing... (${attempts}s)`);
              }
            }
          } catch (pollError) {
            console.log(`\n⚠️  Polling error (attempt ${attempts}): ${pollError instanceof Error ? pollError.message : pollError}`);
            if (axios.isAxiosError(pollError) && pollError.response) {
              console.log(`   Response status: ${pollError.response.status}`);
              console.log(`   Response data: ${JSON.stringify(pollError.response.data).substring(0, 300)}`);
            }
            pollingCompleted = true; // Stop polling on error
            break;
          }
        }
        
        if (attempts >= maxAttempts && !pollingCompleted) {
          console.log(`\n⚠️  Polling timeout after ${maxAttempts} seconds`);
          console.log(`   The image description may still be processing. Check the status URL manually.`);
        }
      } else {
        // No statusUrl - check if response indicates async processing
        try {
          const parsed = JSON.parse(result.response);
          if (parsed.status === 'pending' || parsed.status === 'processing') {
            console.log('\n⚠️  Response indicates async processing but no statusUrl found');
            console.log('   Checked:');
            console.log('   - result.statusUrl (on result object)');
            console.log('   - response JSON (parsed)');
            console.log('\n   This indicates the backend needs to implement status URL support');
            console.log('   See IMAGEDESCRIPTERPUTER_ASYNC_POLLING_BRIEF.md for details');
          }
        } catch {
          // Response is not JSON, ignore
        }
      }
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
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

      // Response content - use descriptionResult if polling completed, otherwise use initial result
      const finalResult = descriptionResult || result;
      
      // Check if we have a completed result
      let isCompleted = false;
      try {
        const parsed = JSON.parse(finalResult.response);
        const status = parsed.status || parsed.data?.status;
        isCompleted = status === 'completed' || status === 'success' || !!parsed.description || !!parsed.data?.description;
      } catch {
        // If not JSON, check if it's a plain description
        isCompleted = !!finalResult.response && finalResult.response.length > 50 && !finalResult.response.includes('pending');
      }
      
      console.log('\n📄 Final Response:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      try {
        const parsed = JSON.parse(finalResult.response);
        console.log(JSON.stringify(parsed, null, 2));
        
        // Pretty print description if available
        if (parsed.description || parsed.data?.description) {
          const description = parsed.description || parsed.data.description;
          console.log('\n📝 Image Description:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(description);
        }
        
        // Pretty print style if available
        if (parsed.style || parsed.data?.style) {
          const style = parsed.style || parsed.data.style;
          console.log('\n🎨 Style:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(JSON.stringify(style, null, 2));
        }
        
        // Pretty print composition if available
        if (parsed.composition || parsed.data?.composition) {
          const composition = parsed.composition || parsed.data.composition;
          console.log('\n🖼️  Composition:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(JSON.stringify(composition, null, 2));
        }
        
        // Pretty print details if available
        if (parsed.details || parsed.data?.details) {
          const details = parsed.details || parsed.data.details;
          console.log('\n🔍 Details:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(JSON.stringify(details, null, 2));
        }
      } catch (parseError) {
        console.log('⚠️  Response is not JSON, showing raw:');
        console.log(finalResult.response);
      }

      // Only show success if we actually completed
      if (isCompleted) {
        console.log('\n✅ Test completed successfully!\n');
      } else {
        console.log('\n⚠️  Test completed but status is not "completed" or "success"\n');
      }
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

