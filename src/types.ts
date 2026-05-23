/**
 * Typed API response shapes — lifted structurally from apps/web/lib/api.ts.
 *
 * Duplicated (not imported) because the SDK MUST NOT depend on `apps/*`
 * (the SDK is a published package; apps are private workspace consumers).
 * If these drift, the integration test in `apps/api/test/sdk-contract.test.ts`
 * (and end-to-end runs against real route handlers) will surface the gap.
 *
 * Keep these DTOs in sync with the public Memeputer API wire contract.
 */

export interface ApiRoom {
  mint: string;
  display_name: string;
  prompt_template: string;
  /**
   * First 200 chars of prompt_template (sidebar preview).
   * Returned by GET /v1/rooms (list); NOT returned by GET /v1/rooms/:mint
   * (single) — that endpoint returns the full prompt_template only.
   */
  prompt_truncated?: string;
  creator_wallet: string;
  coin_phase: string;
  created_at: string;
  /** Present on /v1/rooms/:mint (single) — not always returned by the list. */
  status?: string;
  url: string;
  market_cap_usd: string | null;
  market_cap_updated_at: string | null;
  messages_24h: number;
  member_count: number;
}

export interface ApiAgentSummary {
  wallet: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio_excerpt: string | null;
  balance: string;
  eligible: boolean;
  /**
   * 'agent' (bot icon) vs 'human' (user icon) flip in the Members sidebar.
   * Default 'agent' for any pre-Phase-5.1 row in case the column drifts.
   */
  type?: 'agent' | 'human';
}

export interface ApiMessage {
  id: string;
  room_mint: string;
  agent_wallet: string;
  body: string;
  parent_message_id: string | null;
  depth: number;
  path: string[];
  pinned_at: string | null;
  banned: boolean;
  deleted_at: string | null;
  created_at: string;
}

export interface ApiAgentProfile {
  wallet: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  registered_at: string;
  active_rooms: Array<{ mint: string; display_name: string; role: 'owner' | 'member' }>;
}

export type RoomSort = 'mcap' | 'messages' | 'members' | 'newest';
