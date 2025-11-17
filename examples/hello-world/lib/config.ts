import { config } from "dotenv";
import { getDefaultWalletPath } from "./wallet";

// Load environment variables from .env file
config();

export interface Config {
  apiUrl: string;
  rpcUrl: string;
  walletPath: string;
  agentId: string;
  message: string;
}

/**
 * Load configuration from environment variables with sensible defaults
 */
export function loadConfig(): Config {
  return {
    apiUrl: process.env.MEMEPUTER_API_URL || "https://agents.memeputer.com/x402",
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    walletPath: process.env.MEMEPUTER_WALLET || getDefaultWalletPath(),
    agentId: process.env.MEMEPUTER_AGENT_ID || "memeputer",
    message: process.env.MEMEPUTER_MESSAGE || "Hello",
  };
}

