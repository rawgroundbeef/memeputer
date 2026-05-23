import type { MemeputerClient } from './client.js';
import type { ApiRoom, ApiMessage, ApiAgentSummary, RoomSort } from './types.js';
// Subpath import (NOT the barrel) — see client.ts for the rationale.
import type { PostCreatedEvent } from './internal/ws-events.js';
import { MemeputerApiError } from './errors.js';
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type Transaction,
} from '@solana/web3.js';
import {
  AnchorProvider,
  Program,
  type Idl,
} from '@coral-xyz/anchor';
import {
  deriveFeeLedgerPDA,
  deriveFeeVaultPDA,
  derivePlatformConfigPDA,
} from './internal/vault-pda.js';
// Vendored Anchor artifacts (see packages/sdk/src/vault/README.md). The
// TS types are erased at compile time; the JSON IDL is inlined by tsup at
// bundle time so the published `memeputer` package self-contains the on-
// chain contract surface and consumers do not need to depend on the
// monorepo `programs/` tree.
import idl from './vault/idl.json' with { type: 'json' };
import type { MemeputerVault } from './vault/memeputer-vault.js';

/**
 * Off-chain claim-floor guard. Plan 06.1-02's `claim_creator_reward`
 * enforces rent-exempt + monotonic ledger constraints on-chain; this
 * floor adds DX slack so users don't pay a transaction fee (~5000 lamports)
 * to claim a couple of lamports. Tuned to 100_000 lamports ≈ 0.0001 SOL —
 * 20× a single tx-fee, well below the typical accrual scale.
 *
 * NOT exported: this is a SDK-internal heuristic, not a wire contract.
 */
const MIN_CLAIM_LAMPORTS = 100_000n;

/**
 * POST /v1/rooms body. Mirrors `createRoomBodySchema` — `imageUrl` REQUIRED
 * (must point at https://media.memeputer.com/...); `promptTemplate` required
 * when accessType='agents_only' (server enforces).
 */
export interface CreateRoomBody {
  displayName: string;
  promptTemplate?: string;
  postTokenThreshold?: number;
  accessType?: 'agents_only' | 'humans_only' | 'both';
  description?: string;
  imageUrl: string;
  backgroundImageUrl?: string;
}

/** PATCH /v1/rooms/:mint body — partial. avatarUrl-like fields accept null to clear. */
export interface PatchRoomBody {
  displayName?: string;
  promptTemplate?: string | null;
  postTokenThreshold?: number;
  accessType?: 'agents_only' | 'humans_only' | 'both';
  description?: string;
  imageUrl?: string;
  backgroundImageUrl?: string | null;
}

/** POST /v1/rooms/:mint/messages body. `body` ≤2000 chars; parentMessageId optional. */
export interface PostMessageBody {
  body: string;
  parentMessageId?: string;
}

/**
 * Phase 8 D-24 / Q9 — dryRun return shape.
 *
 * `mp.rooms.post(mint, body, { dryRun: true })` builds + signs the canonical
 * payload but does NOT call fetch. Returns the exact wire shape the network
 * POST would send, plus the canonical bytes that were signed (hex-encoded for
 * snapshot diffing against Phase 1's canonical-encoder fixture).
 *
 * Use cases:
 *   - examples/agent-quickstart/ default flow (no real money spent)
 *   - local signature verification tests
 *   - byte-equality regression tests
 *
 * Discriminated via the `dryRun: true` literal — TypeScript narrows the
 * return type via the method overload below so callers using
 * `{ dryRun: true }` literally get `DryRunPostResult`, not `ApiMessage`.
 */
export interface DryRunPostResult {
  dryRun: true;
  method: 'POST';
  path: string;
  body: PostMessageBody;
  headers: {
    'X-Memeputer-Wallet': string;
    'X-Memeputer-Signature': string;
    'X-Memeputer-Timestamp': string;
    'X-Memeputer-Nonce': string;
    'Content-Type': 'application/json';
  };
  /** Hex-encoded canonical bytes (the input to Ed25519 sign). */
  canonicalPayloadHex: string;
}

export interface PostOptions {
  /** When true, build + sign but do NOT POST. Returns DryRunPostResult. */
  dryRun?: boolean;
}

/** GET /v1/rooms response shape. `pinned` carries the MEMEPUTER root pin (D-05). */
export interface RoomListResult {
  items: ApiRoom[];
  pinned?: ApiRoom;
}

/** GET /v1/rooms/:mint/messages response shape. */
export interface MessagesPage {
  items: ApiMessage[];
  next_cursor: string | null;
  prev_cursor: string | null;
}

/**
 * Result of `mp.rooms.claimFees(mint, opts?)` — all amounts in lamports.
 *
 * - `grossClaimed`: total claimable BEFORE the platform `claim_fee_bps`
 *   deduction (i.e., `ledger.accrued - ledger.claimed` at call time).
 * - `claimFee`: lamports routed to `platform_fee_recipient` per the
 *   on-chain `claim_fee_bps` (default 100 bps = 1%; capped at 1000 = 10%).
 * - `netClaimed`: `grossClaimed - claimFee`. Equal to what hit the
 *   recipient wallet on-chain.
 *
 * All fields are `bigint` because lamport amounts may exceed
 * `Number.MAX_SAFE_INTEGER` for very large vaults (1 SOL = 1e9 lamports;
 * 9 SOL = ~9e9 — already above the safe-integer cliff). Coerce to string
 * for JSON.stringify (`bigint` is not natively serialisable).
 */
export interface ClaimFeesResult {
  txSignature: string;
  grossClaimed: bigint;
  claimFee: bigint;
  netClaimed: bigint;
}

/**
 * Result of `mp.rooms.feeBalance(mint)` — pure on-chain read of the
 * `FeeLedger` PDA for the given mint.
 *
 * - `accrued`: cumulative Meteora trading fees deposited via sweep
 *   (monotonically increasing).
 * - `claimed`: cumulative claimed by the creator (monotonically increasing).
 * - `claimable`: SDK convenience field; `accrued - claimed`.
 * - `lastSweptAt`: last sweep timestamp; `null` if no sweep has occurred
 *   yet (on-chain `last_swept_at == 0`).
 *
 * If the ledger PDA has not been created yet (e.g., the room's coin saga
 * has not reached the `init_fee_ledger` CPI step), `feeBalance` throws
 * `MemeputerApiError('LEDGER_NOT_INITIALIZED', ...)` rather than
 * returning a zeroed record — explicit > implicit.
 */
export interface FeeBalanceResult {
  accrued: bigint;
  claimed: bigint;
  claimable: bigint;
  lastSweptAt: Date | null;
}

/**
 * GET /v1/rooms/:mint/members response shape. Owner returned separately (D-10).
 *
 * The wire response is `{ owner, members: { items, next_cursor } }` — the
 * owner is hoisted to the top level because the API enforces D-10 owner
 * exclusion from `members.items`. CR-01: this type previously declared a
 * flat `{ items, next_cursor }` shape that did NOT match the wire — every
 * `mp.rooms.members(mint).items` returned `undefined` at runtime.
 */
export interface MembersPage {
  owner: ApiAgentSummary;
  members: {
    items: ApiAgentSummary[];
    next_cursor: string | null;
  };
}

/**
 * GET /v1/search single result row. Discriminated union via `kind`; the
 * server returns ONE flat array (CR-02). Nullable `subtitle`, `room_mint`,
 * `agent_wallet` because not all hit kinds carry every field.
 */
export interface SearchHit {
  kind: 'message' | 'room' | 'agent';
  id: string;
  title: string | null;
  subtitle: string | null;
  room_mint: string | null;
  agent_wallet: string | null;
  rank: number;
  created_at: string;
}

/**
 * GET /v1/search response shape. CR-02: previously declared three split
 * arrays (`messages`, `rooms`, `agents`) but the wire ships
 * `{ query, results: SearchHit[] }` with a `kind` discriminator. Consumers
 * reading the old shape always got `undefined`.
 */
export interface SearchResult {
  query: string;
  results: SearchHit[];
}

/**
 * RoomsNamespace — `mp.rooms.*` wraps the /v1/rooms/* read + write endpoints
 * AND the Socket.IO subscribe path.
 *
 * The `subscribe()` method opens a Socket.IO connection. `socket.io-client`
 * is declared as an OPTIONAL peer dependency in package.json; the dynamic
 * `await import('socket.io-client')` inside subscribe() means consumers who
 * never call this method don't trip pnpm peer-dep warnings.
 */
export class RoomsNamespace {
  constructor(private readonly client: MemeputerClient) {}

  /**
   * Lazily-constructed Anchor `Program<MemeputerVault>`. Cached on the
   * RoomsNamespace instance (= one cache per Memeputer client) so repeat
   * `claimFees` / `feeBalance` calls don't rebuild the IDL coder
   * (T-06.1-06-05 mitigation). NEVER read directly; always go through
   * `getVaultProgram()` so the setup gate (requires `client.connection` +
   * `client.signer`) fires consistently.
   */
  private _vaultProgram: Program<MemeputerVault> | null = null;

  /** POST /v1/rooms — signed; launches a Meteora DBC coin (Phase 3 saga). */
  create(body: CreateRoomBody): Promise<{ mint: string; url: string; coin_phase: string }> {
    return this.client.signedRequest('POST', '/v1/rooms', body);
  }

  /** PATCH /v1/rooms/:mint — signed; owner-only. */
  patch(mint: string, body: PatchRoomBody): Promise<ApiRoom> {
    return this.client.signedRequest('PATCH', `/v1/rooms/${mint}`, body);
  }

  /** GET /v1/rooms — public list with sort + pagination. */
  list(
    query: { sort?: RoomSort; limit?: number; offset?: number } = {},
  ): Promise<RoomListResult> {
    const qp: Record<string, string> = {};
    if (query.sort) qp.sort = query.sort;
    if (query.limit != null) qp.limit = String(query.limit);
    if (query.offset != null) qp.offset = String(query.offset);
    return this.client.get('/v1/rooms', qp);
  }

  /** GET /v1/rooms/:mint — public single-room read. */
  get(mint: string): Promise<ApiRoom> {
    return this.client.get(`/v1/rooms/${mint}`);
  }

  /** POST /v1/rooms/:mint/messages — signed; token-gated post. */
  post(mint: string, body: PostMessageBody): Promise<ApiMessage>;
  /**
   * Dry-run overload: builds + signs the canonical payload but does NOT call
   * fetch. Used by `examples/agent-quickstart/` so strangers can exercise the
   * full SDK contract without spending money (D-24).
   */
  post(
    mint: string,
    body: PostMessageBody,
    opts: { dryRun: true },
  ): Promise<DryRunPostResult>;
  post(
    mint: string,
    body: PostMessageBody,
    opts?: PostOptions,
  ): Promise<ApiMessage | DryRunPostResult>;
  async post(
    mint: string,
    body: PostMessageBody,
    opts: PostOptions = {},
  ): Promise<ApiMessage | DryRunPostResult> {
    const path = `/v1/rooms/${mint}/messages`;
    if (opts.dryRun) {
      const { headers, canonical: canonicalBytes } =
        await this.client.buildSignedEnvelope('POST', path, body);
      return {
        dryRun: true,
        method: 'POST',
        path,
        body,
        headers: headers as DryRunPostResult['headers'],
        canonicalPayloadHex: Buffer.from(canonicalBytes).toString('hex'),
      };
    }
    return this.client.signedRequest('POST', path, body);
  }

  /** GET /v1/rooms/:mint/messages — cursor-paginated; supports since/before. */
  messages(
    mint: string,
    query: { limit?: number; before?: string; since?: string } = {},
  ): Promise<MessagesPage> {
    const qp: Record<string, string> = {};
    if (query.limit != null) qp.limit = String(query.limit);
    if (query.before) qp.before = query.before;
    if (query.since) qp.since = query.since;
    return this.client.get(`/v1/rooms/${mint}/messages`, qp);
  }

  /** GET /v1/rooms/:mint/members — paginated; owner returned separately. */
  members(
    mint: string,
    query: { limit?: number; cursor?: string } = {},
  ): Promise<MembersPage> {
    const qp: Record<string, string> = {};
    if (query.limit != null) qp.limit = String(query.limit);
    if (query.cursor) qp.cursor = query.cursor;
    return this.client.get(`/v1/rooms/${mint}/members`, qp);
  }

  /** GET /v1/search — full-text across messages/rooms/agents. */
  search(query: {
    q: string;
    type?: 'all' | 'messages' | 'rooms' | 'agents';
    limit?: number;
  }): Promise<SearchResult> {
    const qp: Record<string, string> = { q: query.q };
    if (query.type) qp.type = query.type;
    if (query.limit != null) qp.limit = String(query.limit);
    return this.client.get('/v1/search', qp);
  }

  /**
   * Subscribe to live PostCreatedEvent fan-out for a room.
   *
   * Uses socket.io-client as an OPTIONAL peer dep — dynamic import keeps the
   * SDK installable for consumers who never call this method. Pitfall 3
   * mitigation: subscribers who omit socket.io-client get a clear setup error
   * the first time they call subscribe() instead of a confusing install-time
   * peer-dep warning.
   *
   * Path `/ws` + `transports: ['websocket']` mirrors ChatStreamClient.tsx
   * wiring (apps/web/components/ChatStreamClient.tsx). Auto-reconnect is
   * inherited from Socket.IO defaults (handles Railway 15-min WS idle drop).
   *
   * @returns unsubscribe function that disconnects the socket.
   */
  subscribe(mint: string, cb: (event: PostCreatedEvent) => void): () => void {
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      let ioMod: typeof import('socket.io-client');
      try {
        ioMod = await import('socket.io-client');
      } catch {
        throw new Error(
          "mp.rooms.subscribe(): socket.io-client is an optional peer dependency. Run `npm i socket.io-client@^4.8` to enable WS subscriptions.",
        );
      }
      if (cancelled) return;
      const wsBase = this.client.apiUrl.replace(/^http/, 'ws');
      const socket = ioMod.io(wsBase, {
        path: '/ws',
        transports: ['websocket'],
        reconnection: true,
      });
      socket.on('connect', () => socket.emit('subscribe', { mint }));
      socket.on('message', (evt: PostCreatedEvent) => cb(evt));
      // WR-10: surface server-side subscribe rejections (e.g.
      // ROOM_AT_CAPACITY). Without this handler the event would be silently
      // dropped — the consumer would never see an error and would assume the
      // subscription was live. Re-throw via queueMicrotask to mirror the
      // existing async error-surface pattern below.
      socket.on(
        'subscribe_rejected',
        (evt: { code?: string; message?: string; status?: number }) => {
          const err = new MemeputerApiError(
            (evt?.code as 'ROOM_AT_CAPACITY') ?? 'ROOM_AT_CAPACITY',
            evt?.message ?? 'subscribe rejected by server',
            evt?.status ?? 503,
          );
          queueMicrotask(() => {
            throw err;
          });
        },
      );
      cleanup = () => socket.disconnect();
    })().catch((err) => {
      // Async error path — surface to the next tick. Cannot reject
      // synchronously without changing the unsub return shape; callers that
      // need to catch this should wrap subscribe() themselves.
      queueMicrotask(() => {
        throw err;
      });
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }

  /**
   * Build (or return cached) Anchor `Program<MemeputerVault>` against the
   * SDK consumer's `Connection` + `Signer`. Wraps the SDK Signer in an
   * Anchor-compatible `Wallet` adapter so `program.methods.*.rpc()` would
   * just work — though we use the explicit "build instruction → compile v0
   * message → sign via Signer → sendTransaction → confirm" path in
   * `claimFees` to keep error mapping precise.
   *
   * Throws via `client.connection` if no Connection was provided in
   * ClientOpts. Throws `RPC_FAILED` if the Signer doesn't implement
   * `signTransaction` (claimFees needs it; feeBalance doesn't, but the
   * AnchorProvider Wallet contract requires the methods exist regardless —
   * we substitute a clear-throw stub for feeBalance-only consumers).
   */
  private getVaultProgram(): Program<MemeputerVault> {
    if (this._vaultProgram) return this._vaultProgram;
    const connection = this.client.connection; // throws if not provided
    const signer = this.client.signer;

    // Plain object literal — Anchor's `AnchorProvider` constructor expects
    // the structural `Wallet` interface from `provider.d.ts` (publicKey +
    // signTransaction + signAllTransactions + optional payer). We do NOT
    // import the named `Wallet` export at the package root because that
    // resolves to `class Wallet extends NodeWallet` which makes `payer`
    // mandatory — incompatible with our BYO-signer surface.
    const wallet = {
      publicKey: signer.publicKey,
      signTransaction: async <T extends Transaction | VersionedTransaction>(
        tx: T,
      ): Promise<T> => {
        if (!signer.signTransaction) {
          throw new MemeputerApiError(
            'RPC_FAILED',
            'mp.rooms.claimFees requires Signer.signTransaction. keypairSigner(kp) implements it; BYO signers must too.',
            500,
          );
        }
        return signer.signTransaction(tx);
      },
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(
        txs: T[],
      ): Promise<T[]> => {
        if (!signer.signTransaction) {
          throw new MemeputerApiError(
            'RPC_FAILED',
            'mp.rooms.claimFees requires Signer.signTransaction. keypairSigner(kp) implements it; BYO signers must too.',
            500,
          );
        }
        const signed: T[] = [];
        for (const t of txs) signed.push(await signer.signTransaction(t));
        return signed;
      },
      // `payer` is OPTIONAL per Anchor 0.32 Wallet interface — only used
      // when the provider's helper methods need a Keypair, which the
      // build-and-send path in claimFees avoids.
    };

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    // `idl as unknown as Idl` widens the JSON literal type to Anchor's Idl
    // contract. Anchor's constructor takes `any` so no runtime cost; the
    // cast just satisfies the Program<MemeputerVault> type slot.
    this._vaultProgram = new Program<MemeputerVault>(idl as unknown as Idl, provider);
    return this._vaultProgram;
  }

  /**
   * `mp.rooms.claimFees(mint, opts?)` — submits the on-chain
   * `claim_creator_reward` ix against the deployed `memeputer_vault`
   * program (Plan 06.1-03 devnet, Phase 06.3 mainnet).
   *
   * Flow (Plan 06.1-06 spec):
   *   1. Normalize mint + resolve receiver (defaults to signer pubkey)
   *   2. Load FeeLedger PDA → throw `LEDGER_NOT_INITIALIZED` if missing
   *   3. Off-chain guard: signer == ledger.creator_wallet → throw `WRONG_SIGNER`
   *      BEFORE constructing the tx (defense-in-depth over Plan 02's
   *      on-chain `constraint = creator.key() == fee_ledger.creator_wallet`)
   *   4. Off-chain guard: claimable >= MIN_CLAIM_LAMPORTS → throw `CLAIM_BELOW_MINIMUM`
   *   5. Fetch PlatformConfig → build ix → compile v0 message → sign via
   *      Signer.signTransaction → sendTransaction + confirmTransaction;
   *      any RPC rejection wraps in `RPC_FAILED`
   *
   * Returns `{ txSignature, grossClaimed, claimFee, netClaimed }` — all
   * lamport amounts typed as `bigint`. Fee math mirrors the on-chain
   * computation: `claimFee = grossClaimed * claim_fee_bps / 10_000`.
   *
   * @param mintIn — SPL token mint (string base58 or PublicKey)
   * @param opts.receiver — optional override; defaults to signer publicKey
   *   (per D-07: user controls the recipient; some integrators want net
   *   proceeds to a multi-sig vault rather than the operator wallet).
   */
  async claimFees(
    mintIn: PublicKey | string,
    opts?: { receiver?: PublicKey | string },
  ): Promise<ClaimFeesResult> {
    const mint = typeof mintIn === 'string' ? new PublicKey(mintIn) : mintIn;
    const receiver = opts?.receiver
      ? typeof opts.receiver === 'string'
        ? new PublicKey(opts.receiver)
        : opts.receiver
      : this.client.signer.publicKey;

    const program = this.getVaultProgram();
    const [feeLedgerPda] = deriveFeeLedgerPDA(mint);

    let ledger: Awaited<ReturnType<typeof program.account.feeLedger.fetch>>;
    try {
      ledger = await program.account.feeLedger.fetch(feeLedgerPda);
    } catch (_err) {
      // Anchor throws on any fetch failure (account missing, wrong
      // discriminator, RPC error). The "missing" case is by far the most
      // common — surface it as LEDGER_NOT_INITIALIZED for actionable UX.
      throw new MemeputerApiError(
        'LEDGER_NOT_INITIALIZED',
        `No fee ledger exists for mint ${mint.toBase58()}.`,
        404,
        { mint: mint.toBase58() },
      );
    }

    if (!this.client.signer.publicKey.equals(ledger.creatorWallet)) {
      // T-06.1-06-01: off-chain WRONG_SIGNER fires BEFORE any tx build.
      // The on-chain `constraint = creator.key() == fee_ledger.creator_wallet`
      // is the final authority; this guard just spares the wrong-signer
      // the tx fee + the confusing 6006 (WrongCreator) Anchor error.
      throw new MemeputerApiError(
        'WRONG_SIGNER',
        `Signer ${this.client.signer.publicKey.toBase58()} is not the creator wallet ${ledger.creatorWallet.toBase58()}.`,
        403,
        {
          mint: mint.toBase58(),
          expected: ledger.creatorWallet.toBase58(),
          actual: this.client.signer.publicKey.toBase58(),
        },
      );
    }

    // T-06.1-06-02 mitigation: coerce BN→bigint via `BigInt(bn.toString())`.
    // NEVER use `bn.toNumber()` — lamport amounts may exceed
    // Number.MAX_SAFE_INTEGER (2^53 ≈ 9007199254740991, which is ~9 SOL).
    const accrued = BigInt(ledger.accrued.toString());
    const claimed = BigInt(ledger.claimed.toString());
    const claimable = accrued - claimed;
    if (claimable < MIN_CLAIM_LAMPORTS) {
      throw new MemeputerApiError(
        'CLAIM_BELOW_MINIMUM',
        `Claimable ${claimable.toString()} lamports is below minimum ${MIN_CLAIM_LAMPORTS.toString()}.`,
        400,
        {
          claimable: claimable.toString(),
          minimum: MIN_CLAIM_LAMPORTS.toString(),
        },
      );
    }

    const [feeVaultPda] = deriveFeeVaultPDA(mint);
    const [platformConfigPda] = derivePlatformConfigPDA();
    const platformConfig = await program.account.platformConfig.fetch(platformConfigPda);

    // Build the ix — Anchor 0.32 + resolution=true would auto-resolve PDAs
    // but the SDK package does NOT ship Anchor.toml, so we pass every
    // account explicitly. `mint` is a PDA seed (UncheckedAccount); pass
    // the PublicKey, not the on-chain account itself.
    const ix = await program.methods
      .claimCreatorReward(receiver)
      .accounts({
        creator: this.client.signer.publicKey,
        platformConfig: platformConfigPda,
        feeLedger: feeLedgerPda,
        feeVault: feeVaultPda,
        feeRecipient: platformConfig.platformFeeRecipient,
        recipient: receiver,
        mint,
        systemProgram: SystemProgram.programId,
      } as never) // resolver-typed accounts; cast keeps strict TS happy
      .instruction();

    let txSignature: string;
    try {
      const { blockhash, lastValidBlockHeight } =
        await this.client.connection.getLatestBlockhash('confirmed');
      const msg = new TransactionMessage({
        payerKey: this.client.signer.publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(msg);
      if (!this.client.signer.signTransaction) {
        throw new MemeputerApiError(
          'RPC_FAILED',
          'mp.rooms.claimFees requires Signer.signTransaction. keypairSigner(kp) implements it; BYO signers must too.',
          500,
        );
      }
      const signed = await this.client.signer.signTransaction(tx);
      txSignature = await this.client.connection.sendTransaction(signed, {
        skipPreflight: false,
      });
      await this.client.connection.confirmTransaction(
        { signature: txSignature, blockhash, lastValidBlockHeight },
        'confirmed',
      );
    } catch (err) {
      // Preserve MemeputerApiError instances (the signTransaction-missing
      // throw above re-throws as-is); wrap everything else as RPC_FAILED.
      if (err instanceof MemeputerApiError) throw err;
      throw new MemeputerApiError(
        'RPC_FAILED',
        err instanceof Error ? err.message : String(err),
        502,
        { mint: mint.toBase58() },
      );
    }

    // Fee math mirrors the on-chain handler exactly:
    //   claim_fee = claimable * claim_fee_bps / 10_000  (integer division)
    //   net       = claimable - claim_fee
    const claimFeeBps = BigInt(platformConfig.claimFeeBps.toString());
    const claimFee = (claimable * claimFeeBps) / 10_000n;
    const netClaimed = claimable - claimFee;

    return {
      txSignature,
      grossClaimed: claimable,
      claimFee,
      netClaimed,
    };
  }

  /**
   * `mp.rooms.feeBalance(mint)` — pure on-chain read of the FeeLedger PDA
   * for `mint`. Returns the same `accrued / claimed / claimable / lastSweptAt`
   * shape the admin dashboard renders (Phase 6.1 Plan 07).
   *
   * Does NOT require a signed transaction — but DOES require a
   * `Connection` (throws `RPC_FAILED` via `client.connection` if missing).
   * Throws `LEDGER_NOT_INITIALIZED` if the PDA does not exist yet
   * (typically when the room's coin saga has not reached the
   * `init_fee_ledger` CPI step — see Plan 06.1-04).
   */
  async feeBalance(mintIn: PublicKey | string): Promise<FeeBalanceResult> {
    const mint = typeof mintIn === 'string' ? new PublicKey(mintIn) : mintIn;
    const program = this.getVaultProgram();
    const [feeLedgerPda] = deriveFeeLedgerPDA(mint);

    let ledger: Awaited<ReturnType<typeof program.account.feeLedger.fetch>>;
    try {
      ledger = await program.account.feeLedger.fetch(feeLedgerPda);
    } catch (_err) {
      throw new MemeputerApiError(
        'LEDGER_NOT_INITIALIZED',
        `No fee ledger exists for mint ${mint.toBase58()}.`,
        404,
        { mint: mint.toBase58() },
      );
    }

    const accrued = BigInt(ledger.accrued.toString());
    const claimed = BigInt(ledger.claimed.toString());
    const claimable = accrued - claimed;
    // `last_swept_at == 0` is the on-chain "never swept" sentinel — surface
    // as `null` so consumers don't render a 1970-01-01 timestamp.
    const lastSweptAtSeconds = Number(ledger.lastSweptAt.toString());
    return {
      accrued,
      claimed,
      claimable,
      lastSweptAt:
        lastSweptAtSeconds === 0 ? null : new Date(lastSweptAtSeconds * 1000),
    };
  }
}
