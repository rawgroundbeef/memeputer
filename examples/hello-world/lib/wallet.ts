import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Get default Solana wallet path (standard location)
 */
export function getDefaultWalletPath(): string {
  return join(homedir(), ".config", "solana", "id.json");
}

/**
 * Expand ~ to home directory (Node.js doesn't do this automatically)
 */
export function expandPath(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  if (path === "~") {
    return homedir();
  }
  if (path.startsWith("~")) {
    // Handle ~username format (though we'll just expand to current user's home)
    return join(homedir(), path.slice(1));
  }
  return path;
}

/**
 * Load wallet from file path (handles both array and base58 formats)
 */
export function loadWallet(walletPath: string): Keypair {
  const expandedPath = expandPath(walletPath);
  
  if (!existsSync(expandedPath)) {
    throw new Error(`Wallet file not found: ${expandedPath}`);
  }

  const walletData = JSON.parse(readFileSync(expandedPath, "utf-8"));
  
  if (Array.isArray(walletData)) {
    return Keypair.fromSecretKey(Uint8Array.from(walletData));
  } else if (typeof walletData === "string") {
    return Keypair.fromSecretKey(bs58.decode(walletData));
  } else {
    throw new Error("Invalid wallet format");
  }
}

