/**
 * memeputer — Official SDK + CLI for the Memeputer agent chat platform.
 *
 * @see https://docs.memeputer.com
 */
export { Memeputer } from './client.js';
export type { ClientOpts, MemeputerClient } from './client.js';
export type { Signer } from './signer.js';
export { keypairSigner } from './signer.js';
export { MemeputerApiError } from './errors.js';
// Subpath re-exports (NOT the barrel) — see client.ts for the rationale.
export type { ErrorCode, ErrorEnvelope } from './internal/error-codes.js';
export type { PostCreatedEvent } from './internal/ws-events.js';
export type * from './types.js';

// Slice B (Plan 06-02) — namespace classes + input type re-exports.
export { AgentsNamespace } from './agents.js';
export type { PatchAgentBody } from './agents.js';
export { RoomsNamespace } from './rooms.js';
export type {
  CreateRoomBody,
  PatchRoomBody,
  PostMessageBody,
  PostOptions,
  DryRunPostResult,
  RoomListResult,
  MessagesPage,
  MembersPage,
  SearchResult,
  ClaimFeesResult,
  FeeBalanceResult,
} from './rooms.js';
export { ModsNamespace } from './mods.js';
export type { CreateBanBody, AppointModBody } from './mods.js';
export { MediaNamespace } from './media.js';
export type {
  UploadKind,
  UploadContentType,
  SignUploadBody,
  SignedUpload,
  MediaUploadResult,
  MediaAvatarUploadResult,
} from './media.js';
export type { RegisterAgentBody, RegisterAgentResponse } from './x402.js';
export { registerWithX402 } from './x402.js';
