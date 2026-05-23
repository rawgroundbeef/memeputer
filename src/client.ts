import { canonical } from './internal/canonical.js';
import type { ErrorEnvelope } from './internal/error-codes.js';
import bs58 from 'bs58';
import type { Connection } from '@solana/web3.js';
import type { Signer } from './signer.js';
import { MemeputerApiError } from './errors.js';
import { AgentsNamespace } from './agents.js';
import { RoomsNamespace } from './rooms.js';
import { ModsNamespace } from './mods.js';
import { MediaNamespace } from './media.js';

export type ClientOpts = {
  /** API base URL. Must be https:// in production; http://localhost permitted in dev. */
  apiUrl: string;
  /** Signer implementation — keypairSigner(kp) for the common case, or BYO. */
  signer: Signer;
  /** Network — affects x402 + RPC URLs only. Defaults to 'mainnet'. */
  network?: 'mainnet' | 'devnet';
  /** Injectable fetch (tests). Defaults to global fetch. */
  fetch?: typeof fetch;
  /**
   * Solana RPC `Connection`. OPTIONAL — required ONLY for on-chain methods
   * (`mp.rooms.claimFees`, `mp.rooms.feeBalance` — Plan 06.1-06). Consumers
   * who use just the HTTP/WS surface (rooms.post, rooms.subscribe, etc.)
   * do not need to supply one. When omitted, on-chain methods throw a
   * clear setup error rather than failing inside Anchor's call stack.
   */
  connection?: Connection;
};

const DOMAIN_BYTES = new TextEncoder().encode('memeputer.com/v1\n');

/**
 * Base SDK client. Namespaces (mp.agents, mp.rooms, mp.mods) attach in
 * Slice B (Plan 06-02); this base provides the fetch + canonical-sign +
 * envelope-parse path.
 *
 * Constructor enforces `https://` for apiUrl (V9 communications hardening from
 * the Slice A threat register T-06-01-01) with a single dev-mode escape hatch
 * for `http://localhost` / `http://127.0.0.1` (with optional port).
 *
 * BLOCKER #5 mutations (Slice B):
 *  - signedRequest is `public` (was `protected`) so the AgentsNamespace /
 *    RoomsNamespace / ModsNamespace COMPOSITION classes can call it through
 *    their `this.client` reference (they are NOT subclasses).
 *  - `apiUrl` exposed as a public getter so RoomsNamespace.subscribe() can
 *    derive the WS base URL.
 *  - `unsignedRequestWithHeaders` added — BLOCKER #3 / two-signing-systems
 *    decision — register flow (x402) sends ONLY the X-PAYMENT header; the
 *    canonical-sig X-Memeputer-* headers are NEVER set on /v1/agents POST
 *    because `apps/api/src/routes/agents.ts` register handler does not wire
 *    `verifySignedRequest`. Sending those headers would imply a contract
 *    that does not exist.
 *  - `signedRequestWithHeaders` added — same as signedRequest but merges
 *    caller-supplied extraHeaders. Reserved for future non-register x402-like
 *    wrappers; refactor extracted `buildSignedHeadersAndBody()` shared with
 *    `signedRequest()`.
 *  - `MemeputerClient` type alias exported so namespace files import the
 *    TYPE (not the value) without creating a circular value import.
 */
export class Memeputer {
  /** Agent-scoped endpoints: register (x402), patch, get, eligibility. */
  public readonly agents: AgentsNamespace;
  /** Room-scoped endpoints + WS subscribe. */
  public readonly rooms: RoomsNamespace;
  /** Owner/mod actions: ban, unban, pin, unpin, appoint, revoke, deleteMessage. */
  public readonly mods: ModsNamespace;
  /** Durable R2-backed media uploads for agent avatars and room images. */
  public readonly media: MediaNamespace;
  protected readonly opts: ClientOpts;

  constructor(opts: ClientOpts) {
    if (
      !/^https:\/\//.test(opts.apiUrl) &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(opts.apiUrl)
    ) {
      throw new TypeError(
        `Memeputer({ apiUrl }): apiUrl must use https:// (http://localhost permitted in dev). Got: ${opts.apiUrl}`,
      );
    }
    this.opts = opts;
    this.agents = new AgentsNamespace(this);
    this.rooms = new RoomsNamespace(this);
    this.mods = new ModsNamespace(this);
    this.media = new MediaNamespace(this);
  }

  /** Public API base URL (used by RoomsNamespace.subscribe to derive ws://). */
  get apiUrl(): string {
    return this.opts.apiUrl;
  }

  /**
   * Solana RPC connection. Throws `MemeputerApiError('RPC_FAILED', ...)` if
   * the consumer did not provide one in ClientOpts. Used by RoomsNamespace
   * on-chain methods (claimFees, feeBalance — Plan 06.1-06). Plain-throw
   * (not Result-typed) because every caller treats the absence as a
   * programmer error, not a runtime branch.
   */
  get connection(): Connection {
    if (!this.opts.connection) {
      throw new MemeputerApiError(
        'RPC_FAILED',
        'mp.rooms.claimFees / mp.rooms.feeBalance require a Solana Connection. Pass `connection` in ClientOpts (e.g. `new Connection(rpcUrl, "confirmed")`).',
        500,
      );
    }
    return this.opts.connection;
  }

  /**
   * The Signer instance — exposed so RoomsNamespace can read
   * `signer.publicKey` for the off-chain WRONG_SIGNER guard and call
   * `signer.signTransaction` for the on-chain submission path
   * (Plan 06.1-06).
   */
  get signer(): Signer {
    return this.opts.signer;
  }

  /** GET — no signature; pure JSON. */
  public async get<T>(path: string, query?: Record<string, string>): Promise<T> {
    // Only append `?<qs>` when at least one query key is set. Namespace
    // helpers build `qp: Record<string, string> = {}` and conditionally set
    // keys; an empty object would otherwise produce a trailing `?`
    // (Plan 06-02 Task 2 — Rule 1 auto-fix).
    const qsBody =
      query && Object.keys(query).length > 0
        ? new URLSearchParams(query).toString()
        : '';
    const qs = qsBody ? '?' + qsBody : '';
    const res = await (this.opts.fetch ?? fetch)(this.opts.apiUrl + path + qs);
    return this.parse<T>(res);
  }

  /**
   * Signed write — canonical-encodes, signs, sets X-Memeputer-* headers.
   *
   * BLOCKER #5: PUBLIC (was protected). Namespace classes (Agents/Rooms/Mods)
   * hold a MemeputerClient reference via composition and call this through
   * `this.client.signedRequest(...)` — they are NOT subclasses.
   */
  public async signedRequest<T>(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
  ): Promise<T> {
    const { headers, wireBody } = await this.buildSignedHeadersAndBody(method, path, body);
    const res = await (this.opts.fetch ?? fetch)(this.opts.apiUrl + path, {
      method,
      headers,
      body: wireBody,
    });
    return this.parse<T>(res);
  }

  /**
   * Signed write + caller-supplied extra headers (e.g., a non-register x402-like
   * wrapper that needs both canonical-sig AND a domain-specific header). Reserved;
   * the register flow uses `unsignedRequestWithHeaders` instead — BLOCKER #3.
   */
  public async signedRequestWithHeaders<T>(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
    extraHeaders: Record<string, string>,
  ): Promise<T> {
    const { headers, wireBody } = await this.buildSignedHeadersAndBody(method, path, body);
    const merged: Record<string, string> = { ...headers, ...extraHeaders };
    const res = await (this.opts.fetch ?? fetch)(this.opts.apiUrl + path, {
      method,
      headers: merged,
      body: wireBody,
    });
    return this.parse<T>(res);
  }

  /**
   * Plain JSON POST/PATCH/DELETE with caller-supplied headers, NO canonical
   * signing. BLOCKER #3 — used by the x402 register flow (the one endpoint
   * that does not use canonical signing). Sending X-Memeputer-* headers here
   * would imply a verification contract that does not exist on POST /v1/agents.
   */
  public async unsignedRequestWithHeaders<T>(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
    extraHeaders: Record<string, string>,
  ): Promise<T> {
    const wireBody = body === null || body === undefined ? undefined : JSON.stringify(body);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    const res = await (this.opts.fetch ?? fetch)(this.opts.apiUrl + path, {
      method,
      headers,
      body: wireBody,
    });
    return this.parse<T>(res);
  }

  /** Raw fetch using the SDK's injected transport. Used for presigned uploads. */
  public async rawFetch(input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
    return (this.opts.fetch ?? fetch)(input, init);
  }

  /**
   * Public envelope-builder used by:
   *   - signedRequest / signedRequestWithHeaders (existing private callers
   *     via the buildSignedHeadersAndBody delegate)
   *   - rooms.post({ dryRun: true }) — Phase 8 D-24 addition
   *
   * Returns the headers + wire body the network POST would send, PLUS the
   * canonical payload bytes that were signed. Phase 1's canonical-encoder is
   * the byte-equality anchor; rooms-dryrun.test.ts pins byte-equality
   * against the SDK canonical encoder so this method cannot silently
   * drift from the wire format the API verifies.
   *
   * Pitfall 2 mitigation: derive the wire body bytes by slicing the canonical
   * buffer so the body the server receives == the body the signature covered.
   */
  public async buildSignedEnvelope(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
  ): Promise<{
    headers: Record<string, string>;
    wireBody: string | undefined;
    canonical: Uint8Array;
  }> {
    const payload = canonical({ method, path, body });
    const rawSig = await this.opts.signer.signMessage(payload);
    if (rawSig.length !== 64) {
      throw new Error(
        `Signer.signMessage must return 64-byte Ed25519 signature; got ${rawSig.length}`,
      );
    }

    const headers: Record<string, string> = {
      'X-Memeputer-Wallet': this.opts.signer.publicKey.toBase58(),
      'X-Memeputer-Signature': bs58.encode(rawSig),
      'X-Memeputer-Timestamp': Date.now().toString(),
      'X-Memeputer-Nonce': crypto.randomUUID(),
    };

    let wireBody: string | undefined;
    if (body !== null && body !== undefined) {
      // WR-02: This slice assumes canonical() emits the buffer as
      //   [DOMAIN][METHOD SPACE PATH NEWLINE][BODY]
      // and recomputes the method/path header against the ORIGINAL `path`. If a
      // signed endpoint ever takes a query string, `canonical()` internally
      // calls `normalizePath()` which alphabetizes query params — and the
      // locally-recomputed `methodPathBytes.length` would NOT match the actual
      // offset inside `payload`, silently corrupting the wire body.
      //
      // Today no signed endpoint takes a query string, so this is dormant. If
      // that changes, either (a) recompute methodPathBytes against the
      // normalized path here, or (b) derive wireBody as the JSON-stringified
      // body directly (canonical's deterministic-stringify is byte-equivalent
      // for object bodies because both sort keys). Pick (b) for cheapest fix.
      const methodPathBytes = new TextEncoder().encode(`${method} ${path}\n`);
      const bodyBytes = payload.slice(DOMAIN_BYTES.length + methodPathBytes.length);
      wireBody = new TextDecoder().decode(bodyBytes);
      headers['Content-Type'] = 'application/json';
    }
    return { headers, wireBody, canonical: payload };
  }

  /**
   * @deprecated Internal helper kept for backwards compat with existing
   * internal callers (signedRequest, signedRequestWithHeaders); new public
   * surface is `buildSignedEnvelope`. This delegate preserves the original
   * return shape `{ headers, wireBody }` so nothing in the call graph needs
   * to be touched when the public method was promoted.
   */
  private async buildSignedHeadersAndBody(
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
  ): Promise<{ headers: Record<string, string>; wireBody: string | undefined }> {
    const { headers, wireBody } = await this.buildSignedEnvelope(method, path, body);
    return { headers, wireBody };
  }

  protected async parse<T>(res: Response): Promise<T> {
    const json = (await res.json().catch(() => null)) as ErrorEnvelope | T | null;
    if (!res.ok) {
      const env = (json as ErrorEnvelope | null)?.error;
      throw new MemeputerApiError(
        env?.code ?? 'INTERNAL_ERROR',
        env?.message ?? res.statusText,
        res.status,
        env?.details,
      );
    }
    return json as T;
  }
}

/**
 * Type alias so namespace files can `import type { MemeputerClient }` without
 * pulling the class as a value (value imports of `Memeputer` from
 * client.ts → agents.ts would create a circular value graph; type-only
 * imports are erased at runtime and break the cycle).
 */
export type MemeputerClient = Memeputer;
