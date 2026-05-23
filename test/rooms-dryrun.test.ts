/**
 * Phase 8 D-24 / Q9 — mp.rooms.post({ dryRun: true }) snapshot test.
 *
 * Asserts:
 *   1. dryRun returns the documented DryRunPostResult shape (discriminator +
 *      headers + body + canonicalPayloadHex)
 *   2. The canonical bytes returned in canonicalPayloadHex byte-equal what
 *      `../src/internal/canonical.js canonical()` produces (Phase 1's byte-equality
 *      anchor — no encoder drift)
 *   3. NO fetch fires when dryRun: true (the no-network-spend contract)
 *   4. Standard post (no opts) still fires fetch normally — regression check
 *      on the existing path
 */
import { describe, test, expect } from 'vitest';
import { Memeputer, keypairSigner } from '../src/index.js';
import type { DryRunPostResult } from '../src/rooms.js';
import { canonical } from '../src/internal/canonical.js';
import { Keypair } from '@solana/web3.js';

function buildMpWithCaptor() {
  const seen: Array<{ url: string; init?: RequestInit }> = [];
  const captor: typeof fetch = async (url, init) => {
    seen.push({ url: String(url), init });
    return new Response(
      JSON.stringify({
        id: 'fake-message-id',
        body: 'fake',
        wallet: 'fake',
        createdAt: new Date().toISOString(),
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  };
  const kp = Keypair.fromSeed(new Uint8Array(32).fill(7));
  const mp = new Memeputer({
    apiUrl: 'https://api.memeputer.com',
    signer: keypairSigner(kp),
    fetch: captor,
  });
  return { mp, kp, seen };
}

const MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL — stable test mint
const BODY = { body: 'gm' };

describe('mp.rooms.post({ dryRun: true })', () => {
  test('returns DryRunPostResult with correct discriminator + shape', async () => {
    const { mp } = buildMpWithCaptor();
    const result = await mp.rooms.post(MINT, BODY, { dryRun: true });
    // Narrowing works via the dryRun: true overload — but assert at runtime too.
    expect(result.dryRun).toBe(true);
    const r = result as DryRunPostResult;
    expect(r.method).toBe('POST');
    expect(r.path).toBe(`/v1/rooms/${MINT}/messages`);
    expect(r.body).toEqual(BODY);
    expect(r.headers['X-Memeputer-Wallet']).toBeTypeOf('string');
    expect(r.headers['X-Memeputer-Signature']).toBeTypeOf('string');
    expect(r.headers['X-Memeputer-Timestamp']).toMatch(/^\d+$/);
    expect(r.headers['X-Memeputer-Nonce']).toBeTypeOf('string');
    expect(r.headers['Content-Type']).toBe('application/json');
    expect(r.canonicalPayloadHex).toMatch(/^[0-9a-f]+$/i);
  });

  test('canonicalPayloadHex byte-equals ../src/internal/canonical.js canonical() — Phase 1 encoder anchor', async () => {
    const { mp } = buildMpWithCaptor();
    const result = await mp.rooms.post(MINT, BODY, { dryRun: true });
    const r = result as DryRunPostResult;
    const expected = canonical({
      method: 'POST',
      path: `/v1/rooms/${MINT}/messages`,
      body: BODY,
    });
    const actual = Buffer.from(r.canonicalPayloadHex, 'hex');
    expect(actual.equals(Buffer.from(expected))).toBe(true);
  });

  test('dryRun: true does NOT fire fetch (no-network-spend contract)', async () => {
    const { mp, seen } = buildMpWithCaptor();
    await mp.rooms.post(MINT, BODY, { dryRun: true });
    expect(seen).toHaveLength(0);
  });

  test('standard post (no opts) still fires fetch — regression check', async () => {
    const { mp, seen } = buildMpWithCaptor();
    const result = await mp.rooms.post(MINT, BODY);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toContain(`/v1/rooms/${MINT}/messages`);
    // Non-dryRun path returns ApiMessage shape (not DryRunPostResult)
    expect((result as { dryRun?: boolean }).dryRun).toBeUndefined();
    expect((result as { id?: string }).id).toBe('fake-message-id');
  });
});
