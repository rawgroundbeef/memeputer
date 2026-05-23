import { PublicKey } from '@solana/web3.js';
import { MEMEPUTER_VAULT_PROGRAM_ID } from './constants.js';

/**
 * Phase 6.1 — vault program PDA derivation helpers.
 *
 * Seeds match hey_curve verbatim (no semantic reason to deviate; different
 * program IDs mean no collision). The seed strings are also defined as
 * Rust constants in programs/memeputer_vault/src/constants.rs — if you
 * change one, change the other (the IDL has them embedded too, so the
 * generated TS types in target/types/memeputer_vault.ts will start diverging
 * on `anchor build`).
 *
 * Bump caching: callers that derive PDAs once per request should NOT cache
 * the bump beyond that request — Anchor 0.32 stores the bump inside the
 * account state, and the program's claim instructions read it from there
 * for `invoke_signed`. The off-chain bump returned here is only used for
 * `connection.getAccountInfo(pda)` and `anchor.Program.account.X.fetch(pda)`,
 * both of which don't need the bump explicitly.
 */
export function deriveFeeLedgerPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('fee_ledger'), mint.toBuffer()],
    MEMEPUTER_VAULT_PROGRAM_ID,
  );
}

export function deriveFeeVaultPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('fee_vault'), mint.toBuffer()],
    MEMEPUTER_VAULT_PROGRAM_ID,
  );
}

export function derivePlatformConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('platform_config')],
    MEMEPUTER_VAULT_PROGRAM_ID,
  );
}
