import { PublicKey } from '@solana/web3.js';

/**
 * Public Memeputer protocol constants used by the SDK.
 *
 * Phase 1 seeded the MEMEPUTER root room with this mint via the
 * ExternalPoolAdapter (FND-09 spike). It is a Bags.fm-controlled DAMM v2 pool,
 * NOT a Meteora DBC pool — the platform has no on-chain authority over its
 * metadata, so it bypasses the entire DBC launch saga (CONTEXT D-02,
 * project_memeputer_root_coin memory lock).
 *
 * Do NOT inline the literal elsewhere; keeping this centralized avoids drift.
 *
 * Rotation: if the operator ever swaps the seeded root coin, edit this file
 * AND the corresponding row in the rooms table (via a migration). Both must
 * change in the same commit so prod can't observe a window where the constant
 * and the DB disagree.
 */
export const MEMEPUTER_MINT = '5EpbKX221NYVidK6A2nJGhtuLPvrPiQ6shknLbtjBAGS' as const;

/**
 * Phase 6.1 — Memeputer creator-fee vault Anchor program ID (post-deploy literal).
 *
 * Single source of truth. SDK (`packages/sdk/src/rooms.ts`), saga
 * (`coin-launch-saga.ts`), sweep service (`apps/admin-api/src/services/fee-vault-sweep.ts`),
 * admin dashboard, and PDA-derive helpers ALL import from here. Do not
 * inline this literal elsewhere — Phase 3 cleanup proved drift between
 * inlined constants creates an "if the export does not exist, fall back to
 * inline" anti-pattern.
 *
 * Rotation: deploy a new program version → update this value AND the
 * Anchor.toml [programs.mainnet] entry in the same commit. The vault
 * upgrade authority controls program upgrades; rotating program IDs is a
 * full redeploy (rare).
 */
// Devnet program ID (Plan 06.1-03 deploy). Phase 06.3 (mainnet on-chain
// security) will deploy a SEPARATE keypair to mainnet and flip this literal
// to the mainnet program ID in a single commit alongside Anchor.toml
// [programs.mainnet]. Devnet ID stays in git history for ops debugging.
export const MEMEPUTER_VAULT_PROGRAM_ID = new PublicKey(
  'HBpnezcpn854wGbUCDdUNj6xG83rngyQrA4Pj9FH1UX9',
);
