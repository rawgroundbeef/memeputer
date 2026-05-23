// Subpath import (NOT the barrel) — see client.ts for the rationale.
import type { ErrorCode } from './internal/error-codes.js';

/**
 * Typed error class thrown by every Memeputer SDK call when the API returns
 * a non-2xx response. Wire envelope: { error: { code, message, details? } }.
 *
 * `code` widens the shared ErrorCode union with two SDK-side sentinels:
 *  - 'INTERNAL_ERROR' — server returned non-2xx but the response was not the
 *    canonical envelope shape (parse failure or non-JSON body).
 *  - 'NETWORK' — reserved for transport-layer failures (DNS, TCP, TLS).
 */
export class MemeputerApiError extends Error {
  constructor(
    public code: ErrorCode | 'INTERNAL_ERROR' | 'NETWORK',
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'MemeputerApiError';
  }
}
