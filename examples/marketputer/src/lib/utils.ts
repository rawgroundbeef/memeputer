// Helper functions for Solscan URLs and network detection

export function getSolscanTxUrl(signature: string, _network: 'mainnet' | 'devnet' = 'mainnet'): string {
  return `https://solscan.io/tx/${signature}`;
}

export function getSolscanAccountUrl(address: string, _network: 'mainnet' | 'devnet' = 'mainnet'): string {
  return `https://solscan.io/account/${address}`;
}

export function detectNetwork(rpcUrl: string): 'mainnet' | 'devnet' {
  if (rpcUrl.includes('devnet')) return 'devnet';
  return 'mainnet';
}

