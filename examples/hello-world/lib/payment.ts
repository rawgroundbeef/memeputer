import { InteractionResult } from "@memeputer/sdk";

/**
 * Display payment details in a clean format
 */
export function showPaymentDetails(result: InteractionResult) {
  if (!result.transactionSignature) {
    return;
  }

  const txUrl = `https://solscan.io/tx/${result.transactionSignature}`;
  console.log(`\n💸 Payment Details:\n`);
  console.log(`Transaction: ${txUrl}\n`);
  
  if (result.x402Receipt) {
    const receipt = result.x402Receipt;
    console.log(`Amount: ${receipt.amountPaidUsdc.toFixed(4)} USDC\n`);
    
    if (receipt.payer) {
      const payerUrl = `https://solscan.io/account/${receipt.payer}`;
      console.log(`From: ${receipt.payer}`);
      console.log(`${payerUrl}\n`);
    }
    
    if (receipt.merchant || receipt.payTo) {
      const merchant = receipt.merchant || receipt.payTo;
      const merchantUrl = `https://solscan.io/account/${merchant}`;
      console.log(`To: ${merchant}`);
      console.log(`${merchantUrl}\n`);
    }
  } else if (result.x402Quote) {
    console.log(`Amount: ${result.x402Quote.amountQuotedUsdc.toFixed(4)} USDC\n`);
  }
}

