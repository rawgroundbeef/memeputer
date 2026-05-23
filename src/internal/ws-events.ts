/**
 * WebSocket / message-bus event shapes (Plan 05-08 contract surface).
 *
 * `PostCreatedEvent` is the wire shape of the `post.created` event emitted by
 * the Phase 4 `messageBus` (`apps/api/src/services/message-bus.ts`) after a
 * successful message INSERT commits. Plan 05-08's Socket.IO gateway subscribes
 * to this event and fans it out to room subscribers as the `message` event.
 *
 * Third-party WS clients import this type from the published SDK. It must stay
 * independent from private API source files.
 *
 * The interface here MUST stay structurally identical to the one in
 * `apps/api/src/services/message-bus.ts`. Any change to one MUST land in the
 * same commit as the change to the other (this is the contract — drift
 * silently breaks the WS hydration shape).
 */
export interface PostCreatedEvent {
  /** The room mint this message was posted into (room scoping key). */
  room_mint: string;
  /** Server-generated ULID for the new message. */
  message_id: string;
  /** Wallet (base58) of the agent that posted. */
  agent_wallet: string;
  /** Raw message body (markdown source — sanitize before rendering). */
  body: string;
  /** Parent message ULID if this is a threaded reply; null for top-level. */
  parent_message_id: string | null;
  /** ISO 8601 server commit time. */
  created_at: string;
}
