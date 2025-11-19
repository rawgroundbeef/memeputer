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
  format: "text" | "image" | "video" | "audio";
  mediaUrl?: string;
  statusUrl?: string; // For async operations
  imageUrl?: string; // Async image result
  etaSeconds?: number; // Estimated time for async operations
  transactionSignature?: string;
  agentId?: string;
  error?: string;
  x402Receipt?: X402Receipt; // Actual payment details from x402 response
  x402Quote?: {
    amountQuotedUsdc: number; // Amount quoted in 402 response (what we paid)
    amountQuotedMicroUsdc: number;
    maxAmountRequired: number;
  }; // Quote details from 402 response
}

export interface StatusCheckResult {
  status: "pending" | "processing" | "completed" | "failed";
  message?: string;
  imageUrl?: string;
  mediaUrl?: string;
  error?: string;
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
   */
  async interact(
    agentId: string,
    message: string,
    wallet: Keypair | any, // Support both Solana Keypair and EVM wallets
    connection: Connection | any, // Support both Solana Connection and EVM providers
  ): Promise<InteractionResult> {
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
      let response;
      try {
        response = await axios.post(
          `${this.baseUrl}/${this.chain}/${agentId}`,
          { message },
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
          if (response.status === 200) {
            console.log(`   ⚠️  WARNING: Got 200 response instead of 402. Backend may not be following x402 spec.`);
            console.log(`   💡 Expected: 402 Payment Required → Create Payment → Retry with X-PAYMENT header → 200 OK`);
            console.log(`   🔍 Actual: 200 OK (payment may have been processed automatically)`);
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
        const resourceUrl = acceptDetails.resource || `${this.baseUrl}/${this.chain}/${agentId}`;
        
        if (this.verbose) {
          console.log('   🔄 Step 3: Retrying request with payment');
          console.log(`      Resource URL: ${resourceUrl}`);
        }
        
        response = await axios.post(
          resourceUrl,
          { message },
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
      const data = response.data;

      // Step 6: Parse RECEIPT from success response (after payment)
      // This is the actual amount paid - use for cost tracking
      let x402Receipt: X402Receipt | undefined;
      if (data.x402Receipt) {
        // RECEIPT: Backend provided actual payment receipt
        // Use this for accurate cost tracking (actual amount paid)
        // Get payer address (Solana or EVM wallet) - use paymentWallet if it was switched
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
        // For Base transactions, prefer the actual transaction hash from backend
        // If backend doesn't provide a valid hash (returns payment header instead), use computed hash
        let txSignature = data.x402Receipt.transactionSignature;
        
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
        
        x402Receipt = {
          amountPaidUsdc: data.x402Receipt.amountPaidUsdc || amountUsdc || 0,
          amountPaidMicroUsdc: data.x402Receipt.amountPaidMicroUsdc || amountMicroUsdc || 0,
          payTo: data.x402Receipt.payTo || recipient || '',
          transactionSignature: txSignature || paymentHeader || '',
          payer: data.x402Receipt.payer || payerAddress,
          merchant: data.x402Receipt.merchant || recipient || '',
          timestamp: data.x402Receipt.timestamp || new Date().toISOString(),
        };
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

      return {
        success: data.success || true,
        response: data.response || data.message || "",
        format: data.format || "text",
        mediaUrl: data.mediaUrl || data.media_url,
        statusUrl: data.statusUrl || data.status_url,
        imageUrl: data.imageUrl || data.image_url,
        etaSeconds: data.etaSeconds || data.eta_seconds,
        transactionSignature: data.transactionSignature || paymentHeader,
        agentId: data.agentId || agentId,
        x402Receipt, // Include receipt if available
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

        if (status === 402) {
          const errorMsg =
            data?.error ||
            data?.message ||
            "Payment required but payment was rejected";
          throw new Error(
            `${errorMsg}. Check your USDC balance. If this is a new agent, ensure its USDC token account has been initialized (agent needs ~0.002 SOL for initial setup).`,
          );
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        throw new Error(`API error (${status}): ${JSON.stringify(data)}`);
      }

      throw error;
    }
  }

  /**
   * Check status of async operation
   * Status URLs point to agents-api proxy (no auth required)
   */
  async checkStatus(statusUrl: string): Promise<StatusCheckResult> {
    try {
      const response = await axios.get(statusUrl);
      // Handle both wrapped (ok()) and unwrapped responses
      const data = response.data.data || response.data;

      return {
        status: data.status || "pending",
        message: data.message,
        imageUrl: data.imageUrl || data.image_url,
        mediaUrl: data.mediaUrl || data.media_url,
        error: data.error,
      };
    } catch (error: any) {
      if (error.response?.data) {
        return {
          status: "failed",
          error: error.response.data.error || "Status check failed",
        };
      }
      throw error;
    }
  }

  /**
   * Poll status URL until completion or timeout
   */
  async pollStatus(
    statusUrl: string,
    options: {
      maxAttempts?: number;
      intervalMs?: number;
      onProgress?: (attempt: number, status: StatusCheckResult) => void;
    } = {},
  ): Promise<StatusCheckResult> {
    const maxAttempts = options.maxAttempts || 60; // 5 minutes at 5s intervals
    const intervalMs = options.intervalMs || 5000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.checkStatus(statusUrl);

      if (options.onProgress) {
        options.onProgress(attempt, result);
      }

      if (result.status === "completed" || result.status === "failed") {
        return result;
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return {
      status: "failed",
      error: "Timeout waiting for completion",
    };
  }
}

