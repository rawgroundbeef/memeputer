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
import { ethers } from "ethers";

// USDC mint on Solana mainnet
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// USDC contract on Base mainnet
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// ERC20 ABI (just the transfer function we need)
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
];

/**
 * Create an EVM USDC payment transaction (for Base and other EVM chains)
 */
async function createEvmPaymentTransaction(
  wallet: any, // ethers Wallet or object with privateKey
  recipient: string,
  amountUsdc: number,
  scheme: string = "exact",
  network: string = "base",
  amountMicroUsdc?: number,
  rpcUrl?: string,
): Promise<{ transaction: any; signature: string }> {
  try {
    // Get private key from wallet
    const privateKey = typeof wallet === 'string' 
      ? wallet 
      : wallet.privateKey || wallet._signingKey?.privateKey;
    
    if (!privateKey) {
      throw new Error('No private key found in wallet');
    }

    // Create ethers wallet
    const evmWallet = new ethers.Wallet(privateKey);
    
    // Connect to Base RPC
    const provider = new ethers.JsonRpcProvider(
      rpcUrl || 'https://mainnet.base.org'
    );
    const connectedWallet = evmWallet.connect(provider);

    // Use atomic units directly if provided
    const amount = amountMicroUsdc !== undefined 
      ? BigInt(Math.floor(amountMicroUsdc))
      : BigInt(Math.floor(amountUsdc * 1_000_000));
    
    if (amount <= 0n) {
      throw new Error(`Invalid payment amount: ${amount} atomic units`);
    }

    // Create USDC contract instance
    const usdcContract = new ethers.Contract(
      BASE_USDC_ADDRESS,
      ERC20_ABI,
      connectedWallet
    );

    // Check USDC balance before creating transaction
    const balance = await usdcContract.balanceOf(evmWallet.address);
    console.log(`      🔍 Debug: USDC Balance: ${ethers.formatUnits(balance, 6)} USDC (${balance.toString()} atomic units)`);
    console.log(`      🔍 Debug: Transfer Amount: ${ethers.formatUnits(amount, 6)} USDC (${amount.toString()} atomic units)`);
    console.log(`      🔍 Debug: Has enough? ${balance >= amount}`);

    // Create transfer transaction
    const tx = await usdcContract.transfer.populateTransaction(
      recipient,
      amount
    );

    // Get gas estimate and current gas price
    const gasLimit = await provider.estimateGas({
      ...tx,
      from: evmWallet.address
    });
    
    const feeData = await provider.getFeeData();
    
    // Build complete transaction
    const fullTx = {
      ...tx,
      from: evmWallet.address,
      gasLimit: gasLimit,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      chainId: 8453, // Base mainnet
      nonce: await provider.getTransactionCount(evmWallet.address),
    };

    // Sign transaction
    const signedTx = await connectedWallet.signTransaction(fullTx);

    // Create X-PAYMENT header in x402 format
    const paymentPayload = {
      x402Version: 1,
      scheme: scheme,
      network: network,
      payload: {
        transaction: signedTx,
        from: evmWallet.address,
      },
    };

    // Encode as base64
    const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

    return { transaction: signedTx, signature: paymentHeader };
  } catch (error) {
    throw new Error(
      `Failed to create EVM payment: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create a simple USDC payment transaction (for SDK use)
 * This creates a signed transaction that can be sent in the X-PAYMENT header
 * Supports both Solana and EVM chains (Base, Ethereum, etc.)
 */
export async function createPaymentTransaction(
  connection: Connection | any,
  payer: Keypair | any,
  recipient: string,
  amountUsdc: number,
  scheme: string = "exact",
  network: string = "solana",
  amountMicroUsdc?: number, // Optional: pass atomic units directly to avoid floating point precision issues
  rpcUrl?: string, // Optional: RPC URL for EVM chains
): Promise<{ transaction: VersionedTransaction | any; signature: string; txSignature?: string }> {
  // Route to appropriate payment method based on network
  if (network === 'base' || network === 'ethereum' || network === 'polygon' || network === 'arbitrum') {
    return createEvmPaymentTransaction(
      payer,
      recipient,
      amountUsdc,
      scheme,
      network,
      amountMicroUsdc,
      rpcUrl
    );
  }
  
  // Default: Solana payment
  try {
    const recipientPubkey = new PublicKey(recipient);

    // Use atomic units directly if provided, otherwise convert from decimal USDC
    // Prefer atomic units to avoid floating point precision issues
    const amount = amountMicroUsdc !== undefined 
      ? Math.floor(amountMicroUsdc)
      : Math.floor(amountUsdc * 1_000_000);
    
    // Validate: amount must be positive
    if (amount <= 0) {
      throw new Error(`Invalid payment amount: ${amount} atomic units (from ${amountUsdc} USDC, ${amountMicroUsdc} micro-USDC)`);
    }

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

