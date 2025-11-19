// Helper functions for blockchain explorer URLs and network detection

/**
 * Detect if a transaction signature is Base/EVM (hex starting with 0x) or Solana (base58)
 */
function isBaseTransaction(signature: string): boolean {
  // Base transaction hashes are hex strings starting with 0x and exactly 66 chars (0x + 64 hex chars)
  // Solana signatures are base58 strings, typically 87-88 chars
  // Payment headers (base64) are longer and don't start with 0x
  if (!signature) return false;
  
  // Must start with 0x and be exactly 66 characters (0x + 64 hex digits)
  if (!signature.startsWith('0x') || signature.length !== 66) {
    return false;
  }
  
  // Must be valid hex (only 0-9, a-f, A-F after 0x)
  return /^0x[a-fA-F0-9]{64}$/.test(signature);
}

/**
 * Get transaction URL - automatically detects Base vs Solana
 */
export function getTxUrl(signature: string, _network: 'mainnet' | 'devnet' = 'mainnet'): string {
  if (isBaseTransaction(signature)) {
    return `https://basescan.org/tx/${signature}`;
  }
  return `https://solscan.io/tx/${signature}`;
}

/**
 * Get account URL - automatically detects Base (0x...) vs Solana (base58)
 */
export function getAccountUrl(address: string, _network: 'mainnet' | 'devnet' = 'mainnet'): string {
  if (address.startsWith('0x') && address.length === 42) {
    // Base/EVM address
    return `https://basescan.org/address/${address}`;
  }
  // Solana address
  return `https://solscan.io/account/${address}`;
}

/**
 * Legacy function for Solana transactions - use getTxUrl instead
 */
export function getSolscanTxUrl(signature: string, _network: 'mainnet' | 'devnet' = 'mainnet'): string {
  return getTxUrl(signature, _network);
}

/**
 * Legacy function for Solana accounts - use getAccountUrl instead
 */
export function getSolscanAccountUrl(address: string, _network: 'mainnet' | 'devnet' = 'mainnet'): string {
  return getAccountUrl(address, _network);
}

export function detectNetwork(rpcUrl: string): 'mainnet' | 'devnet' {
  if (rpcUrl.includes('devnet')) return 'devnet';
  return 'mainnet';
}

