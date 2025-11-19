import { Connection, Keypair } from "@solana/web3.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import bs58 from "bs58";
import { Wallet } from "ethers";

/**
 * Auto-detect wallet from common locations
 */
export function autoDetectWallet(): Keypair {
  // Check environment variables first
  const envWallet = process.env.MEMEPUTER_WALLET || 
                     process.env.ORCHESTRATOR_WALLET ||
                     process.env.WALLET_SECRET_KEY;

  if (envWallet) {
    // Expand tilde if present
    const walletPath = envWallet.startsWith('~/') 
      ? envWallet.replace('~', homedir())
      : envWallet;

    if (existsSync(walletPath)) {
      return loadWalletFromFile(walletPath);
    }

    // Try as base58 encoded secret key
    try {
      return Keypair.fromSecretKey(bs58.decode(envWallet));
    } catch {
      // Not base58, try JSON string
      try {
        const walletData = JSON.parse(envWallet);
        return Keypair.fromSecretKey(new Uint8Array(walletData));
      } catch {
        throw new Error(`Invalid wallet format: ${envWallet}`);
      }
    }
  }

  // Check config file
  const configPath = join(homedir(), ".memeputerrc");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      if (config.wallet) {
        const walletPath = config.wallet.startsWith('~/')
          ? config.wallet.replace('~', homedir())
          : config.wallet;
        if (existsSync(walletPath)) {
          return loadWalletFromFile(walletPath);
        }
      }
    } catch {
      // Ignore config errors
    }
  }

  // Default Solana CLI wallet location
  const defaultWalletPath = join(homedir(), ".config", "solana", "id.json");
  if (existsSync(defaultWalletPath)) {
    return loadWalletFromFile(defaultWalletPath);
  }

  throw new Error(
    "No wallet found. Set MEMEPUTER_WALLET environment variable or create ~/.config/solana/id.json"
  );
}

function loadWalletFromFile(walletPath: string): Keypair {
  if (!existsSync(walletPath)) {
    throw new Error(`Wallet file not found: ${walletPath}`);
  }

  try {
    const walletData = readFileSync(walletPath, "utf-8");
    const secretKey = JSON.parse(walletData);

    // Handle both array format and base58 string format
    if (Array.isArray(secretKey)) {
      return Keypair.fromSecretKey(Uint8Array.from(secretKey));
    } else if (typeof secretKey === "string") {
      return Keypair.fromSecretKey(bs58.decode(secretKey));
    } else {
      throw new Error("Invalid wallet format");
    }
  } catch (error: any) {
    throw new Error(`Failed to load wallet: ${error.message}`);
  }
}

/**
 * Auto-detect RPC URL from environment or config
 */
export function autoDetectRpcUrl(): string {
  // Check environment variable
  if (process.env.SOLANA_RPC_URL) {
    return process.env.SOLANA_RPC_URL;
  }

  // Check config file
  const configPath = join(homedir(), ".memeputerrc");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      if (config.rpcUrl) {
        return config.rpcUrl;
      }
    } catch {
      // Ignore config errors
    }
  }

  // Default to mainnet public RPC
  return "https://api.mainnet-beta.solana.com";
}

/**
 * Auto-detect API URL from environment or config
 */
export function autoDetectApiUrl(): string {
  // Check environment variable
  if (process.env.MEMEPUTER_API_URL || process.env.MEMEPUTER_API_BASE) {
    return process.env.MEMEPUTER_API_URL || process.env.MEMEPUTER_API_BASE!;
  }

  // Check config file
  const configPath = join(homedir(), ".memeputerrc");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      if (config.apiUrl) {
        return config.apiUrl;
      }
    } catch {
      // Ignore config errors
    }
  }

  // Default to production
  return "https://agents.memeputer.com/x402";
}

/**
 * Auto-detect blockchain chain from environment or config
 */
export function autoDetectChain(): string {
  // Check environment variable
  if (process.env.MEMEPUTER_CHAIN) {
    return process.env.MEMEPUTER_CHAIN;
  }

  // Check config file
  const configPath = join(homedir(), ".memeputerrc");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      if (config.chain) {
        return config.chain;
      }
    } catch {
      // Ignore config errors
    }
  }

  // Default to Solana for backward compatibility
  return "solana";
}

/**
 * Base/EVM wallet interface
 */
export interface BaseWallet {
  address: string;
  privateKey: string;
}

/**
 * Auto-detect Base/EVM wallet from common locations
 */
export function autoDetectBaseWallet(): BaseWallet {
  // Check environment variable for private key
  const envPrivateKey = process.env.MEMEPUTER_BASE_WALLET_PRIVATE_KEY || 
                        process.env.BASE_WALLET_PRIVATE_KEY ||
                        process.env.EVM_WALLET_PRIVATE_KEY;

  if (envPrivateKey) {
    try {
      const wallet = new Wallet(envPrivateKey);
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
      };
    } catch (error: any) {
      throw new Error(`Invalid Base wallet private key: ${error.message}`);
    }
  }

  // Check config file
  const configPath = join(homedir(), ".memeputerrc");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      if (config.baseWallet?.privateKey) {
        const wallet = new Wallet(config.baseWallet.privateKey);
        return {
          address: wallet.address,
          privateKey: wallet.privateKey,
        };
      }
    } catch {
      // Ignore config errors
    }
  }

  // Default Base wallet location
  const defaultBaseWalletPath = join(homedir(), ".memeputer", "base-wallet.json");
  if (existsSync(defaultBaseWalletPath)) {
    try {
      const walletData = JSON.parse(readFileSync(defaultBaseWalletPath, "utf-8"));
      if (walletData.privateKey) {
        const wallet = new Wallet(walletData.privateKey);
        return {
          address: wallet.address,
          privateKey: wallet.privateKey,
        };
      }
    } catch (error: any) {
      throw new Error(`Failed to load Base wallet from ${defaultBaseWalletPath}: ${error.message}`);
    }
  }

  throw new Error(
    "No Base wallet found. Set MEMEPUTER_BASE_WALLET_PRIVATE_KEY environment variable or create ~/.memeputer/base-wallet.json"
  );
}

