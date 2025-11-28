import axios from "axios";
import { Connection, Keypair } from "@solana/web3.js";
import { createPaymentTransaction } from "./x402Client";
import { autoDetectBaseWallet, BaseWallet } from "./utils";

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  examplePrompts: string[];
  payTo: string;
}

export interface X402Receipt {
  amountPaidUsdc: number;
  amountPaidMicroUsdc: number;
  payTo: string;
  transactionSignature: string;
  payer: string;
  merchant: string;
  timestamp: string;
}

export interface InteractionResult {
  success: boolean;
  response: string;
  format: "text" | "json" | "markdown"; // Standardized format field
  mediaUrl?: string;
  statusUrl?: string; // For async operations (HTTP 202)
  imageUrl?: string; // Async image result
  etaSeconds?: number; // Estimated time for async operations
  retryAfterSeconds?: number; // Polling interval in seconds (default: 2)
  transactionSignature?: string;
  agentId?: string; // Logical agent name (e.g., "pfpputer", "trendputer")
  agentUuid?: string; // Internal UUID (optional, for debugging/tracking)
  timestamp?: string; // ISO 8601 timestamp - server response time
  x402Version?: number; // Always 1 for standardized responses
  error?: string;
  code?: string; // Machine-readable error code
  receipt?: X402Receipt; // Standardized receipt field (preferred)
  x402Receipt?: X402Receipt; // Legacy field name (for backward compatibility)
  x402Quote?: {
    amountQuotedUsdc: number; // Amount quoted in 402 response (what we paid)
    amountQuotedMicroUsdc: number;
    maxAmountRequired: number;
  }; // Quote details from 402 response
  jobId?: string; // For async operations (HTTP 202)
}

export interface StatusCheckResult {
  status: "pending" | "processing" | "completed" | "failed"; // Legacy field
  state?: "processing" | "succeeded" | "failed"; // Standardized state field
  message?: string;
  response?: string; // Final result content
  artifactUrl?: string; // URL to final artifact
  imageUrl?: string;
  mediaUrl?: string;
  error?: string;
  code?: string; // Machine-readable error code (e.g., "generation_timeout", "generation_failed")
}

export class AgentsApiClient {
  private verbose: boolean = false;
  private chain: string;
  
  constructor(private baseUrl: string, chain: string = 'solana') {
    this.chain = chain;
  }
  
  /**
   * Enable verbose logging to show x402 protocol details
   */
  enableVerbose() {
    this.verbose = true;
  }
  
  /**
   * Disable verbose logging
   */
  disableVerbose() {
    this.verbose = false;
  }

  /**
   * List all available agents from the x402 resources endpoint
   */
  async listAgents(): Promise<AgentInfo[]> {
    const response = await axios.get(`${this.baseUrl}/${this.chain}/resources`);
    const data = response.data;

    // Parse new x402 format: { x402Version: 1, accepts: [...] }
    const acceptsList = data.accepts || [];

    const agents: AgentInfo[] = acceptsList.map((accept: any) => ({
      id: accept.extra?.agentId || accept.agentId || "unknown",
      name: accept.extra?.agentName || accept.name || "Unknown Agent",
      description: accept.description || "AI agent",
      price:
        accept.extra?.pricing?.amount ||
        parseFloat(accept.maxAmountRequired || "10000") / 1_000_000,
      category: accept.extra?.category || "General AI",
      examplePrompts: accept.extra?.examplePrompts || [],
      payTo: accept.payTo || "",
    }));

    return agents;
  }

  /**
   * Interact with an agent using x402 payment
   * Manual x402 flow: 402 → create payment → retry with X-PAYMENT header
   * 
   * @param agentId - The agent ID to interact with
   * @param message - The message or command to send. Can be:
   *   - Natural language prompt (e.g., "Hello, how are you?")
   *   - CLI format command (e.g., "/ping" or "/ping --arg value")
   *   - JSON string with command (e.g., '{"command":"ping"}')
   * @param wallet - Wallet for payment (Solana Keypair or EVM wallet)
   * @param connection - Connection/provider (Solana Connection or EVM provider)
   * @param command - Optional: Command name for command-specific endpoint (e.g., "discover_trends")
   * @param params - Optional: Structured parameters for command-specific endpoint
   */
  async interact(
    agentId: string,
    message: string,
    wallet: Keypair | any, // Support both Solana Keypair and EVM wallets
    connection: Connection | any, // Support both Solana Connection and EVM providers
    command?: string, // Optional: Command name for command-specific endpoint
    params?: Record<string, any>, // Optional: Structured parameters for command-specific endpoint
  ): Promise<InteractionResult> {
    // Determine endpoint type early so it's accessible in error handler
    const useCommandEndpoint = command && params && Object.keys(params).length > 0;
    
    try {
      // Variables to track payment quote and details
      let amountUsdc: number | undefined;
      let amountMicroUsdc: number | undefined;
      let paymentHeader: string | undefined;
      let recipient: string | undefined;
      let acceptDetails: any | undefined;
      let paymentWallet: any = wallet; // Will be set based on network from 402 response
      let computedTxHash: string | undefined; // Computed transaction hash for Base transactions
      let normalizedNetwork: string = 'solana'; // Network from 402 response
      
      // Step 1: Make request without payment (will get 402)
      // Construct URL: Use command-specific endpoint if command and params provided
      // Base endpoint: baseUrl/chain/agentId (e.g., /x402/solana/trendputer)
      // Command endpoint: baseUrl/chain/agentId/command (e.g., /x402/solana/trendputer/discover_trends)
      let requestUrl: string;
      
      if (useCommandEndpoint) {
        // Use command-specific endpoint for structured commands
        requestUrl = `${this.baseUrl}/${this.chain}/${agentId}/${command}`;
      } else {
        // Use base endpoint for chat/CLI format
        requestUrl = `${this.baseUrl}/${this.chain}/${agentId}`;
      }
      
      // Build request body based on endpoint type
      let requestBody: Record<string, any> = {};
      
      if (useCommandEndpoint) {
        // Command-specific endpoint: Don't include 'command' field, only params
        requestBody = { ...params };
        // Include message if provided (for backward compatibility)
        if (message && message.trim() !== '') {
          requestBody.message = message;
        }
      } else {
        // Base endpoint: Use existing logic for chat/CLI format
        // Detect if message is a command without parameters
        // Backend expects: { command: "ping" } for commands without params
        // Backend expects: { message: "..." } for prompts or commands with params
        
        // Handle empty string - treat as no message
        if (!message || message.trim() === '') {
          requestBody = {}; // Send empty body (backend should handle this)
        } else {
          const isCliCommand = message.startsWith('/');
          let commandName: string | undefined;
          
          // Try to parse as JSON to check if it's a JSON command
          try {
            const parsed = JSON.parse(message);
            if (parsed.command) {
              commandName = parsed.command;
              // If JSON command has no params (only command field), send as { command: "ping" }
              const hasParams = Object.keys(parsed).filter(k => k !== 'command').length > 0;
              if (!hasParams) {
                requestBody = { command: commandName };
              } else {
                // JSON command with params - send as message (backend will parse it)
                requestBody = { message };
              }
            } else {
              // JSON but not a command - send as message
              requestBody = { message };
            }
          } catch {
            // Not JSON - check if it's a CLI command
            if (isCliCommand) {
              // Extract command name (e.g., "/ping" -> "ping", "/ping arg" -> "ping")
              commandName = message.substring(1).trim().split(/\s+/)[0];
              // If CLI command has no params (just "/ping"), send as { command: "ping" }
              const parts = message.substring(1).trim().split(/\s+/);
              const hasParams = parts.length > 1;
              if (!hasParams && commandName) {
                requestBody = { command: commandName };
              } else {
                // CLI command with params - send as message
                requestBody = { message };
              }
            } else {
              // Natural language prompt - send as message
              requestBody = { message };
            }
          }
        }
      }
      
      // Always log URL construction and request body for debugging
      console.log(`\n   🔍 URL Construction Debug:`);
      console.log(`   📋 Base URL: ${this.baseUrl}`);
      console.log(`   🔗 Chain: ${this.chain}`);
      console.log(`   👤 Agent ID: ${agentId}`);
      if (useCommandEndpoint) {
        console.log(`   🎯 Command: ${command}`);
        console.log(`   🔗 Endpoint Type: Command-specific`);
        console.log(`   🔗 Final Request URL: ${requestUrl}`);
      } else {
        console.log(`   🔗 Endpoint Type: Base (chat)`);
        console.log(`   🔗 Final Request URL: ${requestUrl}`);
      }
      console.log(`\n   📦 Request Payload:`);
      console.log(`   ${JSON.stringify(requestBody, null, 2).split('\n').join('\n   ')}`);
      if (useCommandEndpoint) {
        console.log(`   ✅ Using command-specific endpoint (no 'command' field in body)`);
      } else if (requestBody.command) {
        console.log(`   ✅ Using 'command' field (no 'message' field)`);
      } else if (requestBody.message) {
        console.log(`   ✅ Using 'message' field`);
        if (requestBody.message.length > 200) {
          console.log(`   📝 Message preview: ${requestBody.message.substring(0, 200)}...`);
        }
      } else {
        console.log(`   ⚠️  Empty request body (no 'message' or 'command' field)`);
      }
      console.log('');
      
      let response;
      try {
        response = await axios.post(
          requestUrl,
          requestBody,
          {
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "@memeputer/sdk",
            },
            validateStatus: (status) => status < 500, // Don't throw on 402, but throw on 5xx
          },
        );
        
        // Log response status
        if (this.verbose) {
          console.log(`   📡 HTTP Response Status: ${response.status}`);
          console.log(`   📦 Request Payload Sent: ${JSON.stringify(requestBody)}`);
          if (response.status === 200) {
            console.log(`   ⚠️  WARNING: Got 200 response instead of 402. Backend may not be following x402 spec.`);
            console.log(`   💡 Expected: 402 Payment Required → Create Payment → Retry with X-PAYMENT header → 200 OK`);
            console.log(`   🔍 Actual: 200 OK (payment may have been processed automatically)`);
          }
          if (response.status === 404) {
            console.log(`   ❌ ERROR: 404 Not Found`);
            console.log(`   💡 Check: Agent ID "${agentId}" might not exist or endpoint structure is incorrect`);
            console.log(`   💡 Expected endpoint: ${this.baseUrl}/${this.chain}/${agentId}`);
            if (response.data) {
              console.log(`   📄 Response body: ${JSON.stringify(response.data).substring(0, 200)}`);
            }
          }
        }
      } catch (error: any) {
        if (error.response?.status === 402) {
          // Got 402 - payment required
          response = error.response;
        } else {
          throw error;
        }
      }
      
      // Check if we got a 402 response
      if (response.status === 402) {
        // Step 2: Get QUOTE from 402 response (before payment)
        // This is the estimated cost - use as budget limit
        const paymentReq = response.data;

        // x402 format has payment details in accepts array
        acceptDetails = paymentReq.accepts?.[0];

        if (!acceptDetails) {
          throw new Error(
            `No payment details in 402 response. Response: ${JSON.stringify(paymentReq)}`,
          );
        }

        recipient = acceptDetails.payTo;
        // Per x402 spec: maxAmountRequired should be in atomic units (micro-USDC)
        // However, backend may send decimal format (e.g., "0.03") or atomic units (e.g., "30000")
        // We need to detect and handle both formats
        const maxAmountRequired = acceptDetails.maxAmountRequired;
        let atomicUnits: number;
        
        if (maxAmountRequired === undefined || maxAmountRequired === null) {
          // Default to 0.01 USDC if missing
          atomicUnits = 10000;
        } else if (typeof maxAmountRequired === 'number') {
          // If number is < 1, assume it's decimal USDC (e.g., 0.03)
          // If number is >= 1, assume it's atomic units (e.g., 30000)
          if (maxAmountRequired < 1) {
            atomicUnits = Math.floor(maxAmountRequired * 1_000_000);
          } else {
            atomicUnits = Math.floor(maxAmountRequired);
          }
        } else if (typeof maxAmountRequired === 'string') {
          // Check if string contains a decimal point (decimal format)
          if (maxAmountRequired.includes('.')) {
            // Decimal format (e.g., "0.03") - parse as float and convert to atomic units
            const decimalUsdc = parseFloat(maxAmountRequired);
            if (isNaN(decimalUsdc)) {
              atomicUnits = 10000; // Fallback
            } else {
              atomicUnits = Math.floor(decimalUsdc * 1_000_000);
            }
          } else {
            // Integer format (e.g., "30000") - parse as atomic units directly
            atomicUnits = parseInt(maxAmountRequired, 10);
            if (isNaN(atomicUnits)) {
              atomicUnits = 10000; // Fallback
            }
          }
        } else {
          // Fallback for any other type
          atomicUnits = 10000;
        }
        
        amountUsdc = atomicUnits / 1_000_000; // Convert to USDC (6 decimals) for display
        amountMicroUsdc = atomicUnits; // Keep atomic units for payment
        const feePayer = acceptDetails.extra?.feePayer;
        const scheme = acceptDetails.scheme || "exact";
        // IMPORTANT: Use network from 402 response, not this.chain
        // The agent requests a specific network (e.g., "base"), not the client's default chain
        const network = acceptDetails.network || "solana-mainnet";
        
        // Normalize network name (handle variations like "base", "base-mainnet", "solana", "solana-mainnet")
        normalizedNetwork = network.toLowerCase().includes('base') || network.toLowerCase().includes('ethereum') || network.toLowerCase().includes('polygon') || network.toLowerCase().includes('arbitrum')
          ? (network.toLowerCase().includes('base') ? 'base' : network.split('-')[0])
          : 'solana';

        if (!recipient) {
          throw new Error(`No recipient wallet (payTo) found in 402 response.`);
        }

        // Log payment quote if verbose logging is enabled
        if (this.verbose) {
          console.log('   📋 Step 1: Received 402 Payment Required');
          console.log(`      💰 Cost: ${amountUsdc.toFixed(4)} USDC (${amountMicroUsdc} micro-USDC)`);
          console.log(`      🏪 Pay To: ${recipient}`);
          console.log(`      📝 Scheme: ${scheme}, Network: ${network} (normalized: ${normalizedNetwork})`);
        }

        // Step 3: Determine which wallet to use based on network from 402 response
        let paymentConnection = connection;
        
        // If network is Base/EVM, ensure we have a Base wallet
        if (normalizedNetwork === 'base' || normalizedNetwork === 'ethereum' || normalizedNetwork === 'polygon' || normalizedNetwork === 'arbitrum') {
          // Check if wallet is already a Base wallet
          // Solana Keypair has: publicKey (PublicKey object), secretKey (Uint8Array)
          // Base wallet can have: 
          //   - privateKey (string starting with 0x) - required
          //   - address (string starting with 0x) - optional (can be derived from privateKey)
          const isSolanaWallet = wallet?.publicKey && typeof wallet.publicKey.toString === 'function';
          const hasBasePrivateKey = wallet?.privateKey && 
                                    typeof wallet.privateKey === 'string' && 
                                    (wallet.privateKey.startsWith('0x') || wallet.privateKey.length === 64);
          const isBaseWallet = hasBasePrivateKey; // If it has privateKey, it's a Base wallet (address optional)
          
          if (this.verbose) {
            console.log(`   🔍 Wallet detection: isSolanaWallet=${isSolanaWallet}, isBaseWallet=${isBaseWallet}, hasPrivateKey=${!!wallet?.privateKey}`);
          }
          
          if (isSolanaWallet && !isBaseWallet) {
            // Wallet is Solana Keypair, need to load Base wallet
            try {
              paymentWallet = autoDetectBaseWallet();
              if (this.verbose) {
                console.log(`   🔄 Switched to Base wallet: ${paymentWallet.address}`);
              }
            } catch (error: any) {
              throw new Error(
                `Agent requires ${normalizedNetwork} payment but no Base wallet found. ` +
                `Set MEMEPUTER_BASE_WALLET_PRIVATE_KEY environment variable or create ~/.memeputer/base-wallet.json. ` +
                `Error: ${error.message}`
              );
            }
          } else if (!isBaseWallet && !isSolanaWallet) {
            // Wallet format is unclear, try to load Base wallet
            try {
              paymentWallet = autoDetectBaseWallet();
              if (this.verbose) {
                console.log(`   🔄 Loaded Base wallet: ${paymentWallet.address}`);
              }
            } catch (error: any) {
              throw new Error(
                `Agent requires ${normalizedNetwork} payment but wallet format is unclear and no Base wallet found. ` +
                `Set MEMEPUTER_BASE_WALLET_PRIVATE_KEY environment variable or create ~/.memeputer/base-wallet.json. ` +
                `Error: ${error.message}`
              );
            }
          }
          // If wallet already has privateKey in Base format, use it as-is (address optional)
          // But ensure paymentWallet is set (it's already initialized to wallet, so this is fine)
          
          // Final check: ensure paymentWallet has privateKey for Base payments
          if (!paymentWallet?.privateKey || (typeof paymentWallet.privateKey !== 'string')) {
            // This shouldn't happen, but add defensive check
            try {
              paymentWallet = autoDetectBaseWallet();
              if (this.verbose) {
                console.log(`   🔄 Fallback: Loaded Base wallet: ${paymentWallet.address}`);
              }
            } catch (error: any) {
              throw new Error(
                `Agent requires ${normalizedNetwork} payment but wallet does not have a valid privateKey. ` +
                `Set MEMEPUTER_BASE_WALLET_PRIVATE_KEY environment variable or create ~/.memeputer/base-wallet.json. ` +
                `Error: ${error.message}`
              );
            }
          }
        }

        // Step 4: Create and sign payment transaction (pay the quoted amount)
        // Pass atomic units directly to avoid floating point precision issues
        // Use normalizedNetwork from 402 response, not this.chain
        const { signature, transaction, txHash } = await createPaymentTransaction(
          paymentConnection,
          paymentWallet,
          recipient,
          amountUsdc, // For display/logging
          scheme,
          normalizedNetwork, // Use network from 402 response, not this.chain
          amountMicroUsdc, // Pass atomic units directly for accurate payment
          undefined, // RPC URL (optional, will use defaults)
        );
        paymentHeader = signature; // Store the payment signature
        // Store computed transaction hash for Base transactions (backend should return actual hash)
        const computedTxHash = txHash;

        // Log payment transaction if verbose logging is enabled
        if (this.verbose) {
          console.log('   💸 Step 2: Creating Payment Transaction');
          console.log(`      Amount: ${amountUsdc.toFixed(4)} USDC (${amountMicroUsdc} atomic units)`);
          // Handle both Solana (publicKey) and EVM (address or privateKey) wallets
          const from = paymentWallet.publicKey?.toString() || paymentWallet.address || 'EVM wallet';
          console.log(`      From: ${from}`);
          console.log(`      To: ${recipient}`);
        }

        // Step 5: Retry request with X-PAYMENT header using resource URL from 402 response
        // Per x402 spec: "Use the resource URL from the 402 response for the paid request"
        // However, if we used a command-specific endpoint, preserve it (backend may return base endpoint)
        let resourceUrl: string;
        if (acceptDetails.resource) {
          let resource = acceptDetails.resource;
          
          // Fix double /x402 prefix in absolute URLs (e.g., http://localhost:3007/x402/x402/...)
          if (resource.includes('/x402/x402/')) {
            resource = resource.replace('/x402/x402/', '/x402/');
            if (this.verbose) {
              console.log(`   🔧 Fixed double /x402 prefix in resource URL`);
            }
          }
          
          // If we used a command-specific endpoint, preserve it even if backend returns base endpoint
          // This ensures we retry to the correct command-specific endpoint
          if (useCommandEndpoint && command) {
            // Extract the command-specific path - include /x402 prefix
            const commandPath = `/x402/${this.chain}/${agentId}/${command}`;
            
            // If resource is absolute URL, replace the path with command-specific path
            if (resource.startsWith('http://') || resource.startsWith('https://')) {
              const url = new URL(resource);
              // Preserve protocol and host, use command-specific path
              resourceUrl = `${url.protocol}//${url.host}${commandPath}`;
              // Always log endpoint preservation (critical for debugging)
              console.log(`   🔧 Preserving command-specific endpoint: ${resourceUrl}`);
            } else {
              // Relative path - construct command-specific endpoint using baseUrl
              resourceUrl = `${this.baseUrl}/${this.chain}/${agentId}/${command}`;
              // Always log endpoint preservation (critical for debugging)
              console.log(`   🔧 Preserving command-specific endpoint: ${resourceUrl}`);
            }
          } else {
            // Not using command-specific endpoint - use resource as-is
            if (resource.startsWith('http://') || resource.startsWith('https://')) {
              resourceUrl = resource;
            } else {
              // Relative path - handle /x402 prefix if present
              let resourcePath = resource;
              // If resource path starts with /x402, remove it since baseUrl already includes /x402
              if (resourcePath.startsWith('/x402/')) {
                resourcePath = resourcePath.substring(6); // Remove '/x402'
              } else if (resourcePath.startsWith('/x402')) {
                resourcePath = resourcePath.substring(5); // Remove '/x402'
              }
              // Ensure path starts with /
              if (!resourcePath.startsWith('/')) {
                resourcePath = '/' + resourcePath;
              }
              resourceUrl = `${this.baseUrl}${resourcePath}`;
            }
          }
        } else {
          // Fallback: use the same URL we used for the initial request
          // This preserves command-specific endpoint if we used one
          resourceUrl = requestUrl;
        }
        
        // Always log retry URL (critical for debugging endpoint issues)
        console.log('   🔄 Step 3: Retrying request with payment');
        console.log(`      Resource URL: ${resourceUrl}`);
        if (acceptDetails.resource && this.verbose) {
          console.log(`      Original resource from 402: ${acceptDetails.resource}`);
        }
        
        // Build retry request body - use same format as initial request
        // IMPORTANT: Use the exact same construction as the initial request to ensure consistency
        let retryBody: Record<string, any>;
        if (useCommandEndpoint && params) {
          // Command-specific endpoint: Use params (no command field)
          // Use the same construction as initial request to ensure arrays are preserved
          retryBody = { ...params };
          // Include message if provided (for backward compatibility) - same as initial request
          if (message && message.trim() !== '') {
            retryBody.message = message;
          }
        } else {
          // Base endpoint: Use message
          retryBody = { message };
        }
        
        // Log retry body for debugging (always log to help diagnose webhook issues)
        console.log(`   📦 Retry Request Payload:`);
        console.log(`   ${JSON.stringify(retryBody, null, 2).split('\n').join('\n   ')}`);
        // Also log array types to verify they're preserved correctly
        if (retryBody.qualityModifiers !== undefined) {
          const isArray = Array.isArray(retryBody.qualityModifiers);
          const allStrings = isArray && retryBody.qualityModifiers.every((item: any) => typeof item === 'string');
          console.log(`   🔍 qualityModifiers validation: Array.isArray=${isArray}, allStrings=${allStrings}, value=${JSON.stringify(retryBody.qualityModifiers)}`);
          if (!isArray || !allStrings) {
            console.error(`   ⚠️  WARNING: qualityModifiers is not an array of strings! This may cause webhook validation errors.`);
          }
        }
        
        response = await axios.post(
          resourceUrl,
          retryBody,
          {
            headers: {
              "Content-Type": "application/json",
              "X-PAYMENT": paymentHeader,
              "User-Agent": "@memeputer/sdk",
            },
          },
        );

        // Log payment confirmation if verbose logging is enabled
        if (this.verbose && response.status === 200) {
          console.log('   ✅ Step 3: Payment Confirmed');
          console.log(`      Status: ${response.status} OK`);
        }
      }

      // Parse successful response (after payment)
      // Handle empty or invalid responses
      if (!response.data) {
        throw new Error(
          `Empty response from backend. Status: ${response.status}, URL: ${this.baseUrl}/${this.chain}/${agentId}. ` +
          `Check that the backend is running and the endpoint exists.`
        );
      }
      
      const data = response.data;

      // Log raw JSON response from API (standardized format)
      if (this.verbose) {
        console.log('\n   📦 Raw API Response (JSON):');
        console.log(`   ${JSON.stringify(data, null, 2).split('\n').join('\n   ')}`);
        console.log('');
      }

      // Handle HTTP 202 (async job started)
      if (response.status === 202) {
        // Async response - return job details
        const receipt = data.receipt || data.x402Receipt;
        const parsedReceipt = receipt ? await this.parseReceipt(receipt, paymentWallet || wallet, recipient, amountUsdc, amountMicroUsdc, paymentHeader, normalizedNetwork, computedTxHash) : undefined;
        
        const asyncResponse = {
          success: data.success !== false, // Default to true for 202
          response: data.response || "Job started",
          format: (data.format || "text") as "text" | "json" | "markdown",
          statusUrl: data.statusUrl,
          jobId: data.jobId,
          etaSeconds: data.etaSeconds,
          retryAfterSeconds: data.retryAfterSeconds, // Polling interval (default: 2s)
          agentId: data.agentId || agentId,
          agentUuid: data.agentUuid, // Internal UUID (optional)
          timestamp: data.timestamp, // Server response time
          x402Version: data.x402Version,
          receipt: parsedReceipt,
          x402Receipt: parsedReceipt, // Backward compatibility
        };
        
        // Log async response structure
        if (this.verbose) {
          console.log('   📤 SDK Transformed Response (HTTP 202 Async):');
          console.log(`   ${JSON.stringify(asyncResponse, null, 2).split('\n').join('\n   ')}`);
          console.log('');
        }
        
        return asyncResponse;
      }

      // Step 6: Parse RECEIPT from success response (after payment)
      // This is the actual amount paid - use for cost tracking
      // Support both new 'receipt' field and legacy 'x402Receipt' field
      let receiptData = data.receipt || data.x402Receipt;
      let x402Receipt: X402Receipt | undefined;
      if (receiptData) {
        // RECEIPT: Backend provided actual payment receipt
        // Use this for accurate cost tracking (actual amount paid)
        x402Receipt = await this.parseReceipt(receiptData, paymentWallet || wallet, recipient, amountUsdc, amountMicroUsdc, paymentHeader, normalizedNetwork, computedTxHash);
      } else if (paymentHeader && recipient && amountUsdc !== undefined && amountMicroUsdc !== undefined) {
        // Fallback: Construct receipt from quote (until backend adds actual receipt)
        // Note: This uses the quoted amount, not actual amount paid
        const payerWallet = paymentWallet || wallet;
        let payerAddress = payerWallet.publicKey?.toString() || payerWallet.address;
        
        // If Base wallet doesn't have address, derive it from private key
        if (!payerAddress && payerWallet.privateKey && typeof payerWallet.privateKey === 'string') {
          try {
            const { ethers } = await import('ethers');
            const tempWallet = new ethers.Wallet(payerWallet.privateKey);
            payerAddress = tempWallet.address;
          } catch {
            payerAddress = 'unknown';
          }
        }
        
        payerAddress = payerAddress || 'unknown';
        
        // For Base transactions, use computed hash if available
        const txSignature = (normalizedNetwork === 'base' && computedTxHash) 
          ? computedTxHash 
          : paymentHeader;
        
        x402Receipt = {
          amountPaidUsdc: amountUsdc, // Quote amount (not actual)
          amountPaidMicroUsdc: amountMicroUsdc,
          payTo: recipient,
          transactionSignature: txSignature,
          payer: payerAddress,
          merchant: recipient,
          timestamp: new Date().toISOString(),
        };
      }

      // Normalize format field to standardized values
      let normalizedFormat: "text" | "json" | "markdown" = "text";
      if (data.format) {
        const formatLower = data.format.toLowerCase();
        if (formatLower === "json") {
          normalizedFormat = "json";
        } else if (formatLower === "markdown") {
          normalizedFormat = "markdown";
        } else {
          normalizedFormat = "text";
        }
      }

      // Log final transformed response structure
      if (this.verbose) {
        const transformedResponse = {
          success: data.success !== false,
          response: data.response || data.message || "",
          format: normalizedFormat,
          mediaUrl: data.mediaUrl || data.media_url,
          statusUrl: data.statusUrl || data.status_url,
          imageUrl: data.imageUrl || data.image_url,
          etaSeconds: data.etaSeconds || data.eta_seconds,
          retryAfterSeconds: data.retryAfterSeconds,
          transactionSignature: data.transactionSignature || paymentHeader,
          agentId: data.agentId || agentId,
          agentUuid: data.agentUuid,
          timestamp: data.timestamp,
          x402Version: data.x402Version,
          receipt: x402Receipt,
          x402Receipt,
        };
        console.log('   📤 SDK Transformed Response:');
        console.log(`   ${JSON.stringify(transformedResponse, null, 2).split('\n').join('\n   ')}`);
        console.log('');
      }

      return {
        success: data.success !== false, // Default to true, but respect explicit false
        response: data.response || data.message || "",
        format: normalizedFormat,
        mediaUrl: data.mediaUrl || data.media_url,
        statusUrl: data.statusUrl || data.status_url,
        imageUrl: data.imageUrl || data.image_url,
        etaSeconds: data.etaSeconds || data.eta_seconds,
        retryAfterSeconds: data.retryAfterSeconds, // Polling interval (for async operations)
        transactionSignature: data.transactionSignature || paymentHeader,
        agentId: data.agentId || agentId,
        agentUuid: data.agentUuid, // Internal UUID (optional)
        timestamp: data.timestamp, // Server response time
        x402Version: data.x402Version,
        receipt: x402Receipt, // Standardized field name
        x402Receipt, // Legacy field name (for backward compatibility)
        x402Quote: paymentHeader && amountUsdc !== undefined && amountMicroUsdc !== undefined ? {
          amountQuotedUsdc: amountUsdc, // Amount we paid (from quote)
          amountQuotedMicroUsdc: amountMicroUsdc,
          maxAmountRequired: acceptDetails?.maxAmountRequired || amountUsdc,
        } : undefined, // Include quote details if payment was made
      };
    } catch (error: any) {
      // Better error messages
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        // Log raw error response JSON
        if (this.verbose) {
          console.error(`\n   ❌ Error Response (HTTP ${status}):`);
          console.error(`   ${JSON.stringify(data, null, 2).split('\n').join('\n   ')}`);
          if (status === 500) {
            const failedRequest = useCommandEndpoint && params ? { ...params } : { message };
            console.error(`\n   📦 Request that failed:`);
            console.error(`   ${JSON.stringify(failedRequest, null, 2).split('\n').join('\n   ')}`);
          }
          console.log('');
        }

        // Handle standardized error responses
        if (status === 402) {
          // HTTP 402 Payment Required - unchanged format
          const errorMsg =
            data?.error ||
            data?.message ||
            "Payment required but payment was rejected";
          throw new Error(
            `${errorMsg}. Check your USDC balance. If this is a new agent, ensure its USDC token account has been initialized (agent needs ~0.002 SOL for initial setup).`,
          );
        }

        if (status === 404) {
          const errorMsg = data?.error || data?.message || `Agent endpoint not found`;
          const errorCode = data?.code || 'agent_not_found';
          throw new Error(
            `${errorMsg} (${errorCode}). Agent ID: "${agentId}", URL: ${this.baseUrl}/${this.chain}/${agentId}. ` +
            `Check that the agent exists and the API URL is correct.`
          );
        }

        if (data?.error || data?.success === false) {
          // Standardized error format: { success: false, error: "...", code: "..." }
          const errorMsg = data?.error || data?.message || "Unknown error";
          const errorCode = data?.code;
          
          // Include more context for 500 errors to help debug backend issues
          if (status === 500) {
            throw new Error(`Internal server error${errorCode ? ` (${errorCode})` : ''}: ${errorMsg}`);
          }
          
          // Include error code if available
          throw new Error(errorCode ? `${errorMsg} (${errorCode})` : errorMsg);
        }

        // Log full response for debugging
        const errorDetails = typeof data === 'string' 
          ? data 
          : JSON.stringify(data, null, 2);
        
        throw new Error(`API error (${status}): ${errorDetails}`);
      }

      throw error;
    }
  }

  /**
   * Helper method to parse receipt from response data
   * Supports both new standardized format and legacy format
   */
  private async parseReceipt(
    receiptData: any,
    wallet: any,
    recipient: string | undefined,
    amountUsdc: number | undefined,
    amountMicroUsdc: number | undefined,
    paymentHeader: string | undefined,
    normalizedNetwork: string,
    computedTxHash: string | undefined
  ): Promise<X402Receipt> {
    // Get payer address (Solana or EVM wallet)
    let payerAddress = wallet.publicKey?.toString() || wallet.address;
    
    // If Base wallet doesn't have address, derive it from private key
    if (!payerAddress && wallet.privateKey && typeof wallet.privateKey === 'string') {
      try {
        const { ethers } = await import('ethers');
        const tempWallet = new ethers.Wallet(wallet.privateKey);
        payerAddress = tempWallet.address;
      } catch {
        payerAddress = 'unknown';
      }
    }
    
    payerAddress = payerAddress || 'unknown';
    
    // For Base transactions, prefer the actual transaction hash from backend
    // If backend doesn't provide a valid hash (returns payment header instead), use computed hash
    let txSignature = receiptData.transactionSignature;
    
    // Check if backend returned a valid Base transaction hash (0x + 64 hex chars = 66 chars)
    const isValidBaseHash = txSignature && 
                            txSignature.startsWith('0x') && 
                            txSignature.length === 66 &&
                            /^0x[a-fA-F0-9]{64}$/.test(txSignature);
    
    // If backend didn't return a valid hash, use computed hash for Base transactions
    if (normalizedNetwork === 'base' && computedTxHash && !isValidBaseHash) {
      // Backend returned payment header or invalid hash, use computed hash instead
      txSignature = computedTxHash;
    }
    
    return {
      amountPaidUsdc: receiptData.amountPaidUsdc || amountUsdc || 0,
      amountPaidMicroUsdc: receiptData.amountPaidMicroUsdc || amountMicroUsdc || 0,
      payTo: receiptData.payTo || recipient || '',
      transactionSignature: txSignature || paymentHeader || '',
      payer: receiptData.payer || payerAddress,
      merchant: receiptData.merchant || recipient || '',
      timestamp: receiptData.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Check status of async operation
   * Status URLs point to agents-api proxy (no auth required)
   * Supports both legacy status field and new state field
   */
  async checkStatus(statusUrl: string): Promise<StatusCheckResult> {
    try {
      const response = await axios.get(statusUrl);
      // Handle both wrapped (ok()) and unwrapped responses
      const data = response.data.data || response.data;

      // Log raw status response JSON
      if (this.verbose) {
        console.log(`\n   📦 Status Check Response (${statusUrl}):`);
        console.log(`   ${JSON.stringify(data, null, 2).split('\n').join('\n   ')}`);
        console.log('');
      }

      // Map standardized state field to legacy status field for backward compatibility
      let status: "pending" | "processing" | "completed" | "failed" = "pending";
      const state = data.state || data.status;
      
      if (state === "succeeded" || state === "completed") {
        status = "completed";
      } else if (state === "failed") {
        status = "failed";
      } else if (state === "processing") {
        status = "processing";
      } else {
        status = "pending";
      }

      const statusResult = {
        status, // Legacy field
        state: data.state || (state === "completed" ? "succeeded" : state), // Standardized field
        message: data.message || data.response,
        response: data.response, // Final result content
        artifactUrl: data.artifactUrl,
        imageUrl: data.imageUrl || data.image_url,
        mediaUrl: data.mediaUrl || data.media_url,
        error: data.error,
        code: data.code, // Machine-readable error code (e.g., "generation_timeout", "generation_failed")
      };

      // Log transformed status result
      if (this.verbose) {
        console.log('   📤 SDK Transformed Status Result:');
        console.log(`   ${JSON.stringify(statusResult, null, 2).split('\n').join('\n   ')}`);
        console.log('');
      }

      return statusResult;
    } catch (error: any) {
      if (error.response?.data) {
        // Log error response
        if (this.verbose) {
          console.error(`\n   ❌ Status Check Error Response:`);
          console.error(`   ${JSON.stringify(error.response.data, null, 2).split('\n').join('\n   ')}`);
          console.log('');
        }
        return {
          status: "failed",
          state: "failed",
          error: error.response.data.error || "Status check failed",
        };
      }
      throw error;
    }
  }

  /**
   * Poll status URL until completion or timeout
   * Uses retryAfterSeconds from initial HTTP 202 response if available, otherwise uses intervalMs
   */
  async pollStatus(
    statusUrl: string,
    options: {
      maxAttempts?: number;
      intervalMs?: number;
      retryAfterSeconds?: number; // Polling interval from HTTP 202 response (default: 2s)
      onProgress?: (attempt: number, status: StatusCheckResult) => void;
    } = {},
  ): Promise<StatusCheckResult> {
    const maxAttempts = options.maxAttempts || 60; // 5 minutes at default intervals
    // Use retryAfterSeconds from HTTP 202 response if provided, otherwise use intervalMs or default to 2s
    const retryAfterSeconds = options.retryAfterSeconds ?? (options.intervalMs ? options.intervalMs / 1000 : 2);
    const intervalMs = retryAfterSeconds * 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.checkStatus(statusUrl);

      if (options.onProgress) {
        options.onProgress(attempt, result);
      }

      // Check both legacy status and new state field
      const isComplete = result.status === "completed" || result.state === "succeeded";
      const isFailed = result.status === "failed" || result.state === "failed";
      
      if (isComplete || isFailed) {
        return result;
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return {
      status: "failed",
      state: "failed",
      error: "Timeout waiting for completion",
      code: "timeout",
    };
  }
}

