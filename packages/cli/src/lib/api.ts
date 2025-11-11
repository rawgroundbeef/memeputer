import axios from "axios";
import { Connection, Keypair } from "@solana/web3.js";
import { createPaymentTransaction } from "./x402Client.js";

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  examplePrompts: string[];
  payTo: string;
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
}

export interface StatusCheckResult {
  status: "pending" | "processing" | "completed" | "failed";
  message?: string;
  imageUrl?: string;
  mediaUrl?: string;
  error?: string;
}

export class AgentsApiClient {
  constructor(private baseUrl: string) {}

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
      // Step 1: Make request without payment (will get 402)
      let response;
      try {
        response = await axios.post(
          `${this.baseUrl}/x402/interact`,
          { agentId, message },
          {
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "memeputer-cli",
            },
          },
        );
      } catch (error: any) {
        if (error.response?.status !== 402) {
          throw error;
        }
        // Got 402 - payment required
        response = error.response;
      }

      if (response.status === 402) {
        // Step 2: Get payment requirements from 402 response
        const paymentReq = response.data;

        // x402 format has payment details in accepts array
        const acceptDetails = paymentReq.accepts?.[0];

        if (!acceptDetails) {
          throw new Error(
            `No payment details in 402 response. Response: ${JSON.stringify(paymentReq)}`,
          );
        }

        const recipient = acceptDetails.payTo;
        const amountMicroUsdc = parseInt(
          acceptDetails.maxAmountRequired || "10000",
        );
        const amountUsdc = amountMicroUsdc / 1_000_000;
        const feePayer = acceptDetails.extra?.feePayer;
        const scheme = acceptDetails.scheme || "exact";
        const network = acceptDetails.network || "solana";

        if (!recipient) {
          throw new Error(`No recipient wallet (payTo) found in 402 response.`);
        }

        // Step 3: Create and sign payment transaction
        const { signature: paymentHeader } = await createPaymentTransaction(
          connection,
          wallet,
          recipient,
          amountUsdc,
          scheme,
          network,
        );

        // Step 4: Retry request with X-PAYMENT header
        response = await axios.post(
          `${this.baseUrl}/x402/interact`,
          { agentId, message },
          {
            headers: {
              "Content-Type": "application/json",
              "X-PAYMENT": paymentHeader,
              "User-Agent": "memeputer-cli",
            },
          },
        );
      }

      // Parse successful response
      const data = response.data;

      return {
        success: data.success || true,
        response: data.response || data.message || "",
        format: data.format || "text",
        mediaUrl: data.mediaUrl || data.media_url,
        statusUrl: data.statusUrl || data.status_url,
        imageUrl: data.imageUrl || data.image_url,
        etaSeconds: data.etaSeconds || data.eta_seconds,
        transactionSignature: data.transactionSignature,
        agentId: data.agentId || agentId,
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
