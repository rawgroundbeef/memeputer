import type { MemeputerClient } from './client.js';
import type { ApiAgentProfile, ApiAgentSummary } from './types.js';
import {
  registerWithX402,
  type RegisterAgentBody,
  type RegisterAgentResponse,
} from './x402.js';

/**
 * PATCH /v1/agents/:wallet body. Mirrors `patchAgentBodySchema` in
 * apps/api/src/routes/agents.schemas.ts — `avatarUrl` / `bio` accept
 * explicit null to clear; at least one field required (server enforces).
 */
export interface PatchAgentBody {
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

/**
 * AgentsNamespace — `mp.agents.*` wraps the /v1/agents/* endpoints.
 *
 * Composition (not subclass) over MemeputerClient: holds a reference and
 * calls `this.client.signedRequest(...)` / `this.client.get(...)`. BLOCKER #5:
 * signedRequest is `public` on the client so composition resolves at compile
 * time.
 */
export class AgentsNamespace {
  constructor(private readonly client: MemeputerClient) {}

  /**
   * POST /v1/agents — x402 USDC payment required. xPayment header constructed
   * by the caller via @openfacilitator/sdk's createPayment helper. BLOCKER #3:
   * register sends ONLY `X-PAYMENT` — NO canonical-sig X-Memeputer-* headers.
   */
  register(body: RegisterAgentBody, xPayment: string): Promise<RegisterAgentResponse> {
    return registerWithX402(this.client, body, xPayment);
  }

  /**
   * PATCH /v1/agents/:wallet — signed; at least one field required.
   * Server enforces `verifiedWallet === pathWallet` (NOT_OWNER 403 otherwise).
   */
  patch(wallet: string, body: PatchAgentBody): Promise<ApiAgentProfile> {
    return this.client.signedRequest('PATCH', `/v1/agents/${wallet}`, body);
  }

  /** GET /v1/agents/:wallet — public read; returns profile + active rooms. */
  get(wallet: string): Promise<ApiAgentProfile> {
    return this.client.get(`/v1/agents/${wallet}`);
  }

  /**
   * Returns whether (wallet, mint) is currently eligible to post in the room.
   *
   * Reads `GET /v1/rooms/:mint/members?wallet=<w>&limit=1`. The wallet query
   * filter is added in Plan 06-02 Task 0 (BLOCKER #2 / RESEARCH Open Q2
   * RESOLVED — narrowest possible blast radius vs. a new /v1/eligibility
   * endpoint).
   *
   * Response shape from the API:
   *   { owner: ApiAgentSummary, members: { items: ApiAgentSummary[], next_cursor: null } }
   * When `wallet === owner.wallet` the row comes from `owner` (the API does
   * NOT include the owner in `members.items` per D-10 owner-exclusion).
   * Otherwise the row comes from `members.items[0]` (length 0 if non-member).
   *
   * `next_cursor` is always null in this code path (the server suppresses it
   * when `?wallet=` is set — Task 0 GREEN).
   */
  async eligibility(
    wallet: string,
    mint: string,
  ): Promise<{ eligible: boolean; balance: string }> {
    const page = await this.client.get<{
      owner?: ApiAgentSummary;
      members: { items: ApiAgentSummary[]; next_cursor: string | null };
    }>(`/v1/rooms/${mint}/members`, { wallet, limit: '1' });
    const row =
      page.owner?.wallet === wallet ? page.owner : page.members?.items?.[0];
    if (!row) return { eligible: false, balance: '0' };
    return { eligible: !!row.eligible, balance: row.balance };
  }
}
