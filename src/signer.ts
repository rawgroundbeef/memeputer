import {
  PublicKey,
  Transaction,
  VersionedTransaction,
  type Keypair,
} from '@solana/web3.js';
import nacl from 'tweetnacl';

/**
 * Wallet abstraction for the Memeputer SDK (D-01).
 *
 * Byte-in / byte-out / async. `signMessage` is REQUIRED — every signed
 * write (rooms.post, mods.*, etc.) is canonical-JSON message-signed via
 * this method.
 *
 * `signTransaction` is OPTIONAL — required ONLY for `mp.rooms.claimFees`
 * (Phase 6.1, Plan 06.1-06) which submits an on-chain Anchor
 * `claim_creator_reward` ix. If a consumer never calls `claimFees`, they
 * can implement just `signMessage` and the SDK works end-to-end.
 *
 * Consumers with KMS/HSM/Turnkey/multi-sig keys implement this directly.
 * See apps/web/lib/turnkey-signer.ts for the reference shape.
 */
export interface Signer {
  /** The Solana pubkey this signer signs for. */
  readonly publicKey: PublicKey;
  /**
   * Sign arbitrary bytes with Ed25519. Returns the RAW 64-byte signature.
   * Do NOT base58-encode here — the SDK encodes for the wire.
   */
  signMessage(bytes: Uint8Array): Promise<Uint8Array>;
  /**
   * Sign a Solana transaction (Legacy or v0). OPTIONAL — only required by
   * `mp.rooms.claimFees` (Plan 06.1-06). The implementation MUST attach the
   * Ed25519 signature for `publicKey` and return the same transaction
   * instance (or a structurally-equivalent one) — Anchor's `Wallet.signTransaction`
   * contract preserves the input type via a generic.
   *
   * If absent, `claimFees` throws a clear setup error rather than failing
   * deep inside Anchor's call stack.
   */
  signTransaction?<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
}

/**
 * Convenience adapter for the common Keypair case.
 *
 * Implements BOTH `signMessage` (Ed25519 detached signature for canonical
 * payloads) AND `signTransaction` (delegates to `VersionedTransaction.sign`
 * / `Transaction.partialSign` for on-chain submission). Consumers who want
 * to use `mp.rooms.claimFees` out of the box just pass a Keypair.
 */
export function keypairSigner(kp: Keypair): Signer {
  return {
    publicKey: kp.publicKey,
    signMessage: async (bytes) => nacl.sign.detached(bytes, kp.secretKey),
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (tx instanceof VersionedTransaction) {
        tx.sign([kp]);
      } else {
        // Legacy Transaction — partialSign attaches kp's signature without
        // clobbering any existing signatures from other signers.
        (tx as Transaction).partialSign(kp);
      }
      return tx;
    },
  };
}
