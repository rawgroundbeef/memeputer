import {
  Connection,
  Keypair,
  ComputeBudgetProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

// USDC mint on Solana mainnet
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

/**
 * Create a simple USDC payment transaction (for SDK use)
 * This creates a signed transaction that can be sent in the X-PAYMENT header
 */
export async function createPaymentTransaction(
  connection: Connection,
  payer: Keypair,
  recipient: string,
  amountUsdc: number,
  scheme: string = "exact",
  network: string = "solana",
): Promise<{ transaction: VersionedTransaction; signature: string; txSignature?: string }> {
  try {
    const recipientPubkey = new PublicKey(recipient);

    // Convert USDC amount to micro-USDC (6 decimals)
    const amount = Math.floor(amountUsdc * 1_000_000);

    // Get token accounts (allowOwnerOffCurve fixes wallet adapter key issues)
    const payerTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      payer.publicKey,
      true, // allowOwnerOffCurve - critical for wallet adapter keys!
      TOKEN_PROGRAM_ID,
    );

    const recipientTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      recipientPubkey,
      true, // allowOwnerOffCurve - critical for wallet adapter keys!
      TOKEN_PROGRAM_ID,
    );

    // Build instructions array
    const instructions: TransactionInstruction[] = [];

    // Add ComputeBudget instructions FIRST (required by facilitator!)
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 40_000,
      }),
    );

    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1,
      }),
    );

    // Add the transfer instruction (use checked version like agent-to-agent payments)
    instructions.push(
      createTransferCheckedInstruction(
        payerTokenAccount,
        USDC_MINT,
        recipientTokenAccount,
        payer.publicKey,
        amount,
        6, // USDC has 6 decimals
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    // Set facilitator as fee payer for gas-free transactions!
    const facilitatorPublicKey = new PublicKey(
      "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4",
    );

    // Create VersionedTransaction (x402 standard)
    const message = new TransactionMessage({
      payerKey: facilitatorPublicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);

    // Find which signature slot corresponds to the user's public key
    // The facilitator is at index 0 (fee payer), user is at a different index
    const userPubkey = payer.publicKey;
    const staticAccountKeys = transaction.message.staticAccountKeys;
    const userSignatureIndex = staticAccountKeys.findIndex((key) =>
      key.equals(userPubkey),
    );

    // Sign with user's wallet (facilitator will add its signature)
    transaction.sign([payer]);

    // Serialize transaction
    const serialized = transaction.serialize();
    const serializedTx = Buffer.from(serialized).toString("base64");

    // Extract the user's signature from the correct slot (bs58 encoded)
    const bs58 = await import("bs58");
    const userSignature =
      userSignatureIndex >= 0 &&
      transaction.signatures?.[userSignatureIndex] &&
      !transaction.signatures[userSignatureIndex].every((b) => b === 0)
        ? bs58.default.encode(transaction.signatures[userSignatureIndex])
        : undefined;

    // Create X-PAYMENT header in x402 format (minimal format matching agent-to-agent)
    // This matches the exact format from x402-solana
    const paymentPayload = {
      x402Version: 1,
      scheme: scheme,
      network: network,
      payload: {
        transaction: serializedTx,
        signature: userSignature, // Include signature for reference (optional)
      },
    };

    // Encode as base64
    const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString(
      "base64",
    );

    return { transaction, signature: paymentHeader };
  } catch (error) {
    throw new Error(
      `Failed to create payment: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get USDC balance for a wallet
 */
export async function getUsdcBalance(
  connection: Connection,
  keypair: Keypair,
): Promise<number> {
  try {
    const tokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      keypair.publicKey,
      true, // allowOwnerOffCurve - critical for wallet adapter keys!
      TOKEN_PROGRAM_ID,
    );

    const balance = await connection.getTokenAccountBalance(tokenAccount);
    return parseFloat(balance.value.uiAmount?.toString() || "0");
  } catch (error) {
    // Token account doesn't exist or other error
    return 0;
  }
}

