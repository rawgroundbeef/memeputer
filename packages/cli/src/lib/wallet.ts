import { Keypair } from "@solana/web3.js";
import { readFileSync, existsSync } from "fs";
import bs58 from "bs58";

export function loadWallet(walletPath: string): Keypair {
  if (!existsSync(walletPath)) {
    throw new Error(
      `Wallet file not found: ${walletPath}\n\n` +
        `Create a wallet with: solana-keygen new --outfile ${walletPath}`,
    );
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

export function formatPublicKey(publicKey: string): string {
  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}
