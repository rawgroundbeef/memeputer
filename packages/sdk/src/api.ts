import axios from "axios";
import { Connection, Keypair } from "@solana/web3.js";
import { createPaymentTransaction } from "./x402Client";

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
  
  constructor(private baseUrl: string) {}
  
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
    const response = await axios.get(`${this.baseUrl}/x402/resources`);
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
    wallet: Keypair,
    connection: Connection,
  ): Promise<InteractionResult> {
    try {
      // Variables to track payment quote and details
      let amountUsdc: number | undefined;
      let amountMicroUsdc: number | undefined;
      let paymentHeader: string | undefined;
      let recipient: string | undefined;
      let acceptDetails: any | undefined;
      
      // Step 1: Make request without payment (will get 402)
      let response;
      try {
        response = await axios.post(
          `${this.baseUrl}/x402/interact`,
          { agentId, message },
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
        // Per official x402 spec: maxAmountRequired is decimal USDC string (e.g., "0.01")
        // Parse as float - already in USDC format
        amountUsdc = parseFloat(acceptDetails.maxAmountRequired || "0.01");
        amountMicroUsdc = Math.floor(amountUsdc * 1_000_000); // Convert to atomic units for tracking
        const feePayer = acceptDetails.extra?.feePayer;
        const scheme = acceptDetails.scheme || "exact";
        const network = acceptDetails.network || "solana-mainnet";

        if (!recipient) {
          throw new Error(`No recipient wallet (payTo) found in 402 response.`);
        }

        // Log payment quote if verbose logging is enabled
        if (this.verbose) {
          console.log('   📋 Step 1: Received 402 Payment Required');
          console.log(`      💰 Cost: ${amountUsdc.toFixed(4)} USDC (${amountMicroUsdc} micro-USDC)`);
          console.log(`      🏪 Pay To: ${recipient}`);
          console.log(`      📝 Scheme: ${scheme}, Network: ${network}`);
        }

        // Step 3: Create and sign payment transaction (pay the quoted amount)
        const { signature, transaction } = await createPaymentTransaction(
          connection,
          wallet,
          recipient,
          amountUsdc, // Pay the quoted amount
          scheme,
          network,
        );
        paymentHeader = signature; // Store the payment signature

        // Log payment transaction if verbose logging is enabled
        if (this.verbose) {
          console.log('   💸 Step 2: Creating Payment Transaction');
          console.log(`      Amount: ${amountUsdc.toFixed(4)} USDC`);
          console.log(`      From: ${wallet.publicKey.toString()}`);
          console.log(`      To: ${recipient}`);
        }

        // Step 4: Retry request with X-PAYMENT header using resource URL from 402 response
        // Per x402 spec: "Use the resource URL from the 402 response for the paid request"
        const resourceUrl = acceptDetails.resource || `${this.baseUrl}/x402/interact`;
        
        if (this.verbose) {
          console.log('   🔄 Step 3: Retrying request with payment');
          console.log(`      Resource URL: ${resourceUrl}`);
        }
        
        response = await axios.post(
          resourceUrl,
          { agentId, message },
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
          console.log('   ✅ Step 4: Payment Confirmed');
          console.log(`      Status: ${response.status} OK`);
        }
      }

      // Parse successful response (after payment)
      const data = response.data;

      // Step 5: Parse RECEIPT from success response (after payment)
      // This is the actual amount paid - use for cost tracking
      let x402Receipt: X402Receipt | undefined;
      if (data.x402Receipt) {
        // RECEIPT: Backend provided actual payment receipt
        // Use this for accurate cost tracking (actual amount paid)
        x402Receipt = {
          amountPaidUsdc: data.x402Receipt.amountPaidUsdc || amountUsdc || 0,
          amountPaidMicroUsdc: data.x402Receipt.amountPaidMicroUsdc || amountMicroUsdc || 0,
          payTo: data.x402Receipt.payTo || recipient || '',
          transactionSignature: data.x402Receipt.transactionSignature || paymentHeader || '',
          payer: data.x402Receipt.payer || wallet.publicKey.toString(),
          merchant: data.x402Receipt.merchant || recipient || '',
          timestamp: data.x402Receipt.timestamp || new Date().toISOString(),
        };
      } else if (paymentHeader && recipient && amountUsdc !== undefined && amountMicroUsdc !== undefined) {
        // Fallback: Construct receipt from quote (until backend adds actual receipt)
        // Note: This uses the quoted amount, not actual amount paid
        x402Receipt = {
          amountPaidUsdc: amountUsdc, // Quote amount (not actual)
          amountPaidMicroUsdc: amountMicroUsdc,
          payTo: recipient,
          transactionSignature: paymentHeader,
          payer: wallet.publicKey.toString(),
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

