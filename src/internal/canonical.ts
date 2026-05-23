/**
 * Canonical request encoder.
 *
 * Used by EVERY signed-write codepath: SDK (Phase 6), API verification middleware
 * (Plan 05), every future signed endpoint.
 *
 * Domain separator: "memeputer.com/v1\n" — exactly 17 UTF-8 bytes (D-09 + RESEARCH §3).
 *   Closes cross-application signature replay (an attacker can't take a signed payload
 *   intended for Magic Eden, etc., and replay it against Memeputer).
 *
 * Method + path: "{METHOD} {PATH}\n" — covered by signature per D-11.
 *   Closes cross-endpoint replay (a signed POST /v1/rooms body cannot be replayed
 *   against POST /v1/messages).
 *
 * Body: deterministic JSON — recursive alphabetic key sort, no whitespace, no
 *   trailing newline. null/undefined body → empty buffer (0 bytes).
 *
 * Output bytes = concat(domainPrefix, methodPathLine, jsonBody).
 *
 * This buffer is signed with nacl.sign.detached(buffer, secretKey) on the SDK side
 * and verified with nacl.sign.detached.verify(buffer, sigBytes, pubKeyBytes) on the
 * API side. Both sides MUST import THIS module (single source of truth).
 *
 * Hand-roll rationale: the recipe is short (~30 lines), transparent, and avoids a
 * dep on `safe-stable-stringify`. Test fixtures pin the output bytes so any drift
 * fails CI immediately.
 */

const DOMAIN_PREFIX = 'memeputer.com/v1\n'; // exactly 17 UTF-8 bytes
const ENC = new TextEncoder();

export type CanonicalInput = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /**
   * Path string. May include a query string — e.g. "/v1/rooms" or
   * "/v1/rooms?page=2&order=new". The query string IS covered by the
   * signature; without it, a captured signed request can be replayed with
   * a mutated query string (REVIEW.md CR-02, Phase 5.1).
   *
   * Query parameters are sorted alphabetically by key (and by value within
   * a duplicated key) before being canonicalised, so callers do not need to
   * remember to pre-sort. Both sides — SDK signer and API verifier — pass
   * `pathname + search` as-read; the canonical encoder normalizes the
   * ordering so the bytes match byte-for-byte regardless of how the URL
   * was assembled. No host, no fragment.
   */
  path: string;
  body: unknown; // null/undefined → empty body
};

/**
 * Normalize a path with optional query string into a canonical form that is
 * stable across SDK + middleware regardless of original query-param order.
 *
 * Algorithm:
 *   - Split on the first '?'. The pathname part is preserved verbatim
 *     (trailing slash, casing, escape sequences — all caller-controlled).
 *   - The query part is split on '&' into name=value pairs, sorted
 *     lexicographically (primary: name, secondary: value), then re-joined
 *     with '&' and reattached with '?'.
 *   - Empty query (path ends in '?') is dropped; '?' is omitted entirely.
 *   - Anchor / fragment is rejected (canonical signing covers wire-bound
 *     request shape; fragments never reach the server).
 *
 * Phase 5.1 CR-02 fix: closes the query-string replay gap surfaced by code
 * review. The middleware passes `new URL(c.req.url).pathname + .search` and
 * `canonical()` normalizes that into a stable signing buffer.
 */
function normalizePath(path: string): string {
  if (path.includes('#')) {
    throw new Error('canonical(): path must not contain a fragment "#"');
  }
  const qIdx = path.indexOf('?');
  if (qIdx === -1) return path;
  const pathname = path.slice(0, qIdx);
  const queryRaw = path.slice(qIdx + 1);
  if (queryRaw.length === 0) return pathname; // trailing '?' with no query
  const parts = queryRaw.split('&').sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return `${pathname}?${parts.join('&')}`;
}

export function canonical(input: CanonicalInput): Uint8Array {
  if (typeof input.path !== 'string' || !input.path.startsWith('/')) {
    throw new Error('canonical(): path must start with "/"');
  }
  const normalizedPath = normalizePath(input.path);
  const domainBytes = ENC.encode(DOMAIN_PREFIX);
  const methodPathBytes = ENC.encode(`${input.method} ${normalizedPath}\n`);
  const bodyBytes = encodeBody(input.body);

  const out = new Uint8Array(domainBytes.length + methodPathBytes.length + bodyBytes.length);
  out.set(domainBytes, 0);
  out.set(methodPathBytes, domainBytes.length);
  out.set(bodyBytes, domainBytes.length + methodPathBytes.length);
  return out;
}

function encodeBody(body: unknown): Uint8Array {
  if (body === null || body === undefined) return new Uint8Array(0);
  return ENC.encode(deterministicStringify(body));
}

function deterministicStringify(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('canonical: non-finite number not allowed');
    return JSON.stringify(v);
  }
  if (typeof v === 'bigint') {
    throw new Error('canonical: bigint not allowed — caller must stringify big numbers');
  }
  if (typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
  if (Array.isArray(v)) {
    return `[${v.map(deterministicStringify).join(',')}]`;
  }
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const k of keys) {
      const val = obj[k];
      if (val === undefined) continue; // drop undefined like JSON.stringify
      parts.push(`${JSON.stringify(k)}:${deterministicStringify(val)}`);
    }
    return `{${parts.join(',')}}`;
  }
  throw new Error(`canonical: unsupported type ${typeof v}`);
}
