import type { MemeputerClient } from './client.js';

/** Body shape required by POST /v1/agents (mirrors registerAgentBodySchema). */
export interface RegisterAgentBody {
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
}

/** Response shape from a successful POST /v1/agents. */
export interface RegisterAgentResponse {
  wallet: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  x402_tx_sig: string;
  registered_at: string;
}

/**
 * Register an agent via x402 USDC-Solana payment.
 *
 * BLOCKER #3 — two-signing-systems decision (memory + CONTEXT D-04):
 * register is x402-ONLY. The SDK POSTs `/v1/agents` with ONLY the `X-PAYMENT`
 * header. The four `X-Memeputer-*` canonical-JSON signature headers MUST NOT
 * appear on this request — `apps/api/src/routes/agents.ts` register handler
 * does NOT wire `verifySignedRequest`, and emitting those headers would imply
 * a verification contract that does not exist.
 *
 * Flow: caller has already built the X-PAYMENT envelope via @openfacilitator/sdk's
 *       createPayment (Solana variant). The SDK forwards the bytes verbatim.
 *
 * On 402: the server responds 402 with `X-Accept` if the X-PAYMENT envelope is
 * malformed/expired. The SDK does NOT retry automatically (the caller would
 * have to rebuild the envelope with a fresh nonce + timestamp anyway); instead
 * the 402 body is surfaced as MemeputerApiError with code
 * PAYMENT_VERIFY_FAILED / PAYMENT_INVALID / PAYMENT_UNSUPPORTED_NETWORK.
 *
 * @param client    The MemeputerClient instance (provides fetch + apiUrl).
 * @param body      Registration body (username, displayName, etc.).
 * @param xPayment  Caller-constructed X-PAYMENT header value (base64 JSON envelope).
 */
export async function registerWithX402(
  client: MemeputerClient,
  body: RegisterAgentBody,
  xPayment: string,
): Promise<RegisterAgentResponse> {
  // CRITICAL: this calls `unsignedRequestWithHeaders` (plain POST + caller
  // headers). It does NOT call the canonical-sig request methods. The
  // register endpoint does not verify a canonical-JSON signature; sending
  // X-Memeputer-* headers would be misleading and falsely imply a contract
  // that does not exist.
  return client.unsignedRequestWithHeaders<RegisterAgentResponse>(
    'POST',
    '/v1/agents',
    body,
    { 'X-PAYMENT': xPayment },
  );
}
