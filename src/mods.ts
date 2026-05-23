import type { MemeputerClient } from './client.js';

/** POST /v1/rooms/:mint/bans body. `reason` required (1..500 chars). */
export interface CreateBanBody {
  userWallet: string;
  reason: string;
}

/** POST /v1/rooms/:mint/mods body. */
export interface AppointModBody {
  userWallet: string;
}

/**
 * ModsNamespace — `mp.mods.*` wraps owner/mod write endpoints across rooms.
 *
 * Authorization model (CONTEXT D-13): owners can ban/unban/pin/unpin/delete
 * AND appoint/revoke mods. Appointed mods inherit the first set but NOT the
 * appointment power (mod escalation is impossible without the owner's
 * signature). The server enforces this via the room-authorization service;
 * the SDK does not pre-validate.
 *
 * Response shapes vary slightly per endpoint (`{ banned: true }`,
 * `{ unbanned: true }`, `{ appointed: true }`, `{ status: 'already_mod' }`,
 * etc.) — the SDK returns the raw envelope as `unknown`-shaped JSON. v2 may
 * normalize this to `{ ok: true }` once the API surface stabilizes.
 */
export class ModsNamespace {
  constructor(private readonly client: MemeputerClient) {}

  /** POST /v1/rooms/:mint/bans — signed; owner or appointed mod. */
  ban(mint: string, body: CreateBanBody): Promise<unknown> {
    return this.client.signedRequest('POST', `/v1/rooms/${mint}/bans`, body);
  }

  /** DELETE /v1/rooms/:mint/bans/:userWallet — signed; owner or appointed mod. */
  unban(mint: string, userWallet: string): Promise<unknown> {
    return this.client.signedRequest(
      'DELETE',
      `/v1/rooms/${mint}/bans/${userWallet}`,
      null,
    );
  }

  /** POST /v1/rooms/:mint/pins/:messageId — signed; owner or appointed mod. */
  pin(mint: string, messageId: string): Promise<unknown> {
    return this.client.signedRequest(
      'POST',
      `/v1/rooms/${mint}/pins/${messageId}`,
      null,
    );
  }

  /** DELETE /v1/rooms/:mint/pins/:messageId — signed; owner or appointed mod. */
  unpin(mint: string, messageId: string): Promise<unknown> {
    return this.client.signedRequest(
      'DELETE',
      `/v1/rooms/${mint}/pins/${messageId}`,
      null,
    );
  }

  /** POST /v1/rooms/:mint/mods — signed; owner ONLY (mods cannot appoint mods). */
  appoint(mint: string, body: AppointModBody): Promise<unknown> {
    return this.client.signedRequest('POST', `/v1/rooms/${mint}/mods`, body);
  }

  /** DELETE /v1/rooms/:mint/mods/:userWallet — signed; owner ONLY. */
  revoke(mint: string, userWallet: string): Promise<unknown> {
    return this.client.signedRequest(
      'DELETE',
      `/v1/rooms/${mint}/mods/${userWallet}`,
      null,
    );
  }

  /** DELETE /v1/rooms/:mint/messages/:messageId — signed; owner or mod (soft delete). */
  deleteMessage(mint: string, messageId: string): Promise<unknown> {
    return this.client.signedRequest(
      'DELETE',
      `/v1/rooms/${mint}/messages/${messageId}`,
      null,
    );
  }
}
