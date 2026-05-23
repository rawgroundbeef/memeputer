/**
 * Stable, machine-readable error codes used in the API error envelope.
 *
 * Wire shape:
 *   { "error": { "code": "<CODE>", "message": "<human-readable>", "details"?: {...} } }
 *
 * Once shipped to npm SDK (Phase 6), these codes are part of the public contract.
 * Adding new codes is fine. Renaming or repurposing is a breaking change.
 *
 * Phase 1 declared most codes up front so downstream phases never need to edit
 * packages/shared to add a code — they use what already exists. Phase 2 adds
 * the codes flagged "Phase 2 additions" below; these were not anticipated at
 * Phase 1 design time because the manual verify+settle pattern requires
 * distinct retry-semantic branches (RESEARCH §"Final Error-Code Taxonomy").
 */
export type ErrorCode =
  // Auth / signature — Phase 1
  | 'MISSING_AUTH_HEADERS'
  | 'STALE_REQUEST'
  | 'SIGNATURE_WRONG_LENGTH'
  | 'WALLET_WRONG_LENGTH'
  | 'SIGNATURE_DECODE_FAILED'
  | 'INVALID_SIGNATURE'
  | 'REPLAY_DETECTED'
  | 'BODY_PARSE_FAILED'
  // Validation — Phase 1
  | 'VALIDATION_FAILED'
  | 'RESERVED_SLUG'
  | 'DISPLAY_NAME_NON_ASCII'
  // Authorization — codes ship in Phase 1, used in Phase 4+
  | 'BELOW_THRESHOLD'
  | 'BANNED'
  | 'NOT_OWNER'
  | 'NOT_MODERATOR'
  | 'RATE_LIMITED'
  | 'MESSAGE_TOO_LONG'
  | 'BAD_PARENT'
  // Payment — codes ship in Phase 1, used in Phase 2
  | 'PAYMENT_UNSUPPORTED_NETWORK'
  | 'PAYMENT_INVALID'
  | 'REGISTRATION_RATE_LIMITED'
  // Phase 2 additions — x402 manual verify+settle + on-chain self-verify path
  | 'USERNAME_TAKEN'              // 409 — username_reservation or agents.username unique-violation (D-11)
  | 'PAYMENT_VERIFY_FAILED'       // 402 — facilitator.verify() returns isValid=false (bad sig / expired auth / insufficient balance)
  | 'PAYMENT_SETTLE_FAILED'       // 502 or 503 — facilitator.settle() returns success=false OR throws NetworkError
  | 'PAYMENT_ON_CHAIN_MISMATCH'   // 502 — selfVerifyOnChain saw the tx but it doesn't match (wrong amount/from/to/mint)
  | 'REGISTRATION_PENDING_ON_CHAIN' // 202 — settle returned but getTransaction returns null after retry budget; client retries same payload
  // Launch — codes ship in Phase 1, used in Phase 3
  | 'INSUFFICIENT_SOL_FOR_LAUNCH'
  | 'COIN_LAUNCH_FAILED'
  // Phase 3 additions — DBC saga + room ownership envelope
  | 'STUCK_LAUNCH_RETRY' // 202 — saga partially landed; reconciler will retry; client can poll
  | 'ROOM_NOT_FOUND' // 404 — GET/PATCH /v1/rooms/:mint where mint has no row
  | 'NOT_ROOM_OWNER' // 403 — signed-PATCH attempted by a wallet that is not rooms.creator_wallet
  // Phase 5 additions — reads, WS, search.
  | 'AGENT_NOT_FOUND' // 404 — GET /v1/agents/:wallet where wallet has no agents row
  | 'INVALID_CURSOR' // 400 — opaque base64 cursor decode failed (READ-02)
  | 'ROOM_AT_CAPACITY' // emitted via WS subscribe_rejected event payload (D-22); NOT an HTTP error
  // Phase 5.1 additions — human onboarding (Supabase + Turnkey)
  | 'HUMANS_NOT_ALLOWED'      // 403 — humans posting in agents-only room (D-16)
  | 'AGENTS_NOT_ALLOWED'      // 403 — agents posting in humans-only room (D-16)
  | 'OWNER_CANNOT_BE_BANNED'  // 403 — mod tried to ban the room creator (D-14)
  | 'SESSION_EXPIRED'         // 401 — Supabase JWT invalid / expired (D-22)
  // Phase 5.2 additions — admin portal + auto-mod
  | 'NOT_ADMIN' // 401 — JWT valid but supabase_user_id not in ADMIN_ALLOWLIST (D-06)
  | 'ADMIN_RULE_INVALID' // 400 — admin posted unsafe regex / oversize / malformed rule (D-10)
  | 'RULE_VIOLATED' // 403 — post body fails an auto-mod rule (D-09)
  // Phase 6.1 additions — creator-fee claim path
  | 'CLAIM_BELOW_MINIMUM'    // 400 — claimable < MIN_CLAIM_LAMPORTS (~0.0001 SOL / rent-exempt floor)
  | 'LEDGER_NOT_INITIALIZED' // 404 — claim attempted before saga's creator_ledger_initialized step ran
  | 'WRONG_SIGNER'           // 403 — signer.publicKey !== FeeLedger.creator_wallet
  | 'SWEEP_FAILED'           // 500 — internal sweep service threw (admin-api logs the root cause)
  | 'RPC_FAILED'             // 502 — Helius / Solana RPC returned a non-recoverable error during claim build/send
  // Generic — every phase
  | 'INTERNAL_ERROR'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED';

export type ErrorEnvelope = {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function errorEnvelope(
  code: ErrorCode,
  message?: string,
  details?: Record<string, unknown>,
): ErrorEnvelope {
  return { error: { code, message: message ?? code, details } };
}
