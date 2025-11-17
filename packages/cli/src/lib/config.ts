import { homedir } from "os";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

export interface Config {
  wallet?: string;
  network?: string;
  apiUrl?: string;
  rpcUrl?: string;
}

const CONFIG_PATH = join(homedir(), ".memeputerrc");

export function loadConfig(): Config {
  const config: Config = {
    network: "mainnet-beta",
    apiUrl:
      process.env.NODE_ENV === "development"
        ? "http://localhost:3006/x402"
        : "https://agents.memeputer.com/x402", // Default to production
  };

  // Load from config file
  if (existsSync(CONFIG_PATH)) {
    try {
      const fileConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      Object.assign(config, fileConfig);
    } catch (error) {
      // Ignore config file errors
    }
  }

  // Override with environment variables
  if (process.env.MEMEPUTER_WALLET) {
    config.wallet = process.env.MEMEPUTER_WALLET;
  }
  if (process.env.MEMEPUTER_API_URL) {
    config.apiUrl = process.env.MEMEPUTER_API_URL;
  }
  if (process.env.SOLANA_RPC_URL) {
    config.rpcUrl = process.env.SOLANA_RPC_URL;
  }

  // Set default RPC URL if not specified
  if (!config.rpcUrl) {
    // Use Helius for better reliability (requires HELIUS_API_KEY env var)
    // Or fallback to public RPC endpoints
    const heliusKey = process.env.HELIUS_API_KEY;
    if (heliusKey) {
      config.rpcUrl =
        config.network === "mainnet-beta"
          ? `https://rpc.helius.xyz/?api-key=${heliusKey}`
          : "https://api.devnet.solana.com";
    } else {
      // Fallback to public RPC endpoints
      config.rpcUrl =
        config.network === "mainnet-beta"
          ? "https://api.mainnet-beta.solana.com"
          : "https://api.devnet.solana.com";
    }
  }

  return config;
}

export function getDefaultWalletPath(): string {
  return join(homedir(), ".config", "solana", "id.json");
}
