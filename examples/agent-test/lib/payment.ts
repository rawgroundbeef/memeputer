import { InteractionResult } from "@memeputer/sdk";

/**
 * Detect if a transaction signature is Base/EVM (hex starting with 0x) or Solana (base58)
 */
function isBaseTransaction(signature: string): boolean {
  if (!signature) return false;
  // Base transaction hashes are hex strings starting with 0x and exactly 66 chars (0x + 64 hex chars)
  return signature.startsWith('0x') && 
         signature.length === 66 &&
         /^0x[a-fA-F0-9]{64}$/.test(signature);
}

/**
 * Get transaction URL - automatically detects Base vs Solana
 */
function getTxUrl(signature: string): string {
  if (isBaseTransaction(signature)) {
    return `https://basescan.org/tx/${signature}`;
  }
  return `https://solscan.io/tx/${signature}`;
}

/**
 * Get account URL - automatically detects Base (0x...) vs Solana (base58)
 */
function getAccountUrl(address: string): string {
  if (address.startsWith('0x') && address.length === 42) {
    // Base/EVM address
    return `https://basescan.org/address/${address}`;
  }
  // Solana address
  return `https://solscan.io/account/${address}`;
}

/**
 * Display payment details in a clean format
 */
export function showPaymentDetails(result: InteractionResult) {
  if (!result.transactionSignature) {
    return;
  }

  const txUrl = getTxUrl(result.transactionSignature);
  console.log(`\n💸 Payment Details:\n`);
  console.log(`Transaction: ${txUrl}\n`);
  
  if (result.x402Receipt) {
    const receipt = result.x402Receipt;
    console.log(`Amount: ${receipt.amountPaidUsdc.toFixed(4)} USDC\n`);
    
    if (receipt.payer && receipt.payer !== 'unknown') {
      const payerUrl = getAccountUrl(receipt.payer);
      console.log(`From: ${receipt.payer}`);
      console.log(`${payerUrl}\n`);
    }
    
    if (receipt.merchant || receipt.payTo) {
      const merchant = receipt.merchant || receipt.payTo;
      const merchantUrl = getAccountUrl(merchant);
      console.log(`To: ${merchant}`);
      console.log(`${merchantUrl}\n`);
    }
  } else if (result.x402Quote) {
    console.log(`Amount: ${result.x402Quote.amountQuotedUsdc.toFixed(4)} USDC\n`);
  }
}

