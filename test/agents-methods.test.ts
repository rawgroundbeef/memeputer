import { describe, test, expect } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { Memeputer, keypairSigner } from '../src/index.js';

/**
 * AgentsNamespace method-dispatch tests (Plan 06-02 Task 2).
 *
 * Verifies URL + method + headers for each `mp.agents.*` method using a
 * captor fakeFetch. The captor pattern mirrors test/client-headers.test.ts
 * from Slice A.
 *
 * BLOCKER #3 lock: register() MUST forward ONLY `X-PAYMENT`. The four
 * `X-Memeputer-*` canonical-sig headers MUST be undefined on POST /v1/agents
 * because the API handler does not wire verifySignedRequest. Asserting
 * absence pins the contract — any regression that re-routes register through
 * signedRequest() fails this test.
 *
 * BLOCKER #2 lock: eligibility() reads
 * `/v1/rooms/:mint/members?wallet=<w>&limit=1`. The wallet query filter is
 * added in Task 0 GREEN; the exact URL shape is asserted here so any drift
 * (e.g. a future /v1/eligibility endpoint stamp) is caught immediately.
 */

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

function buildMpWithCaptor(seed = 50) {
  const captured: Captured = {
    url: '',
    method: '',
    headers: {},
    body: undefined,
  };
  const fakeFetch: typeof fetch = async (url, init) => {
    captured.url = url as string;
    captured.method = (init?.method as string) ?? 'GET';
    captured.headers = (init?.headers as Record<string, string>) ?? {};
    captured.body = init?.body as string | undefined;
    // Default-shape response (the SDK's parse() accepts arbitrary JSON for 2xx).
    return new Response(JSON.stringify({ items: [], ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const mp = new Memeputer({
    signer: keypairSigner(Keypair.fromSeed(new Uint8Array(32).fill(seed))),
    apiUrl: 'http://localhost:3001',
    fetch: fakeFetch,
  });
  return { mp, captured };
}

describe('AgentsNamespace', () => {
  test('register forwards X-PAYMENT header ONLY — NO X-Memeputer-* canonical-sig headers (BLOCKER #3: two-signing-systems lock)', async () => {
    const { mp, captured } = buildMpWithCaptor();
    await mp.agents.register(
      { username: 'a', displayName: 'A' },
      'eyJ4NDAyVmVyc2lvbiI6MX0=',
    );
    expect(captured.url).toBe('http://localhost:3001/v1/agents');
    expect(captured.method).toBe('POST');
    // x402 envelope present:
    expect(captured.headers['X-PAYMENT']).toBe('eyJ4NDAyVmVyc2lvbiI6MX0=');
    // BLOCKER #3: register MUST NOT carry canonical-sig headers
    // (apps/api/src/routes/agents.ts register handler does not wire
    // verifySignedRequest). Asserting absence pins the contract.
    expect(captured.headers['X-Memeputer-Signature']).toBeUndefined();
    expect(captured.headers['X-Memeputer-Wallet']).toBeUndefined();
    expect(captured.headers['X-Memeputer-Timestamp']).toBeUndefined();
    expect(captured.headers['X-Memeputer-Nonce']).toBeUndefined();
    // Body is the plain JSON envelope (NOT canonical-byte-sliced).
    expect(JSON.parse(captured.body!)).toEqual({ username: 'a', displayName: 'A' });
    expect(captured.headers['Content-Type']).toBe('application/json');
  });

  test('patch issues PATCH /v1/agents/:wallet with signed-request headers', async () => {
    const { mp, captured } = buildMpWithCaptor(51);
    await mp.agents.patch('SomeWallet', { displayName: 'New Name' });
    expect(captured.method).toBe('PATCH');
    expect(captured.url).toBe('http://localhost:3001/v1/agents/SomeWallet');
    expect(JSON.parse(captured.body!)).toEqual({ displayName: 'New Name' });
    // PATCH uses canonical sig (apps/api/src/routes/agents.ts wires
    // verifySignedRequest at line 412).
    expect(captured.headers['X-Memeputer-Signature']).toBeDefined();
    expect(captured.headers['X-Memeputer-Wallet']).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(captured.headers['X-Memeputer-Timestamp']).toMatch(/^\d{13,}$/);
    expect(captured.headers['X-Memeputer-Nonce']).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('get issues GET /v1/agents/:wallet with NO signature headers', async () => {
    const { mp, captured } = buildMpWithCaptor(52);
    await mp.agents.get('SomeWallet');
    expect(captured.method).toBe('GET');
    expect(captured.url).toBe('http://localhost:3001/v1/agents/SomeWallet');
    expect(captured.headers['X-Memeputer-Signature']).toBeUndefined();
  });

  test('eligibility reads /v1/rooms/:mint/members?wallet=<w>&limit=1 (BLOCKER #2 / Open Q2 RESOLVED — uses members route wallet filter, NOT a new /v1/eligibility endpoint)', async () => {
    const { mp, captured } = buildMpWithCaptor(53);
    await mp.agents.eligibility('Wal1', 'Mint1');
    // Exact URL pin — the wallet filter ships in this plan (Task 0 GREEN).
    expect(captured.url).toBe(
      'http://localhost:3001/v1/rooms/Mint1/members?wallet=Wal1&limit=1',
    );
    expect(captured.method).toBe('GET');
    // No sig headers on a public read.
    expect(captured.headers['X-Memeputer-Signature']).toBeUndefined();
  });

  test('eligibility parses the API response shape: { owner, members: { items, next_cursor } } — returns { eligible, balance } from members.items[0]', async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          owner: {
            wallet: 'Owner1',
            display_name: 'O',
            username: 'o',
            avatar_url: null,
            bio_excerpt: '',
            balance: '500000',
            eligible: true,
            type: 'agent',
          },
          members: {
            items: [
              {
                wallet: 'Wal1',
                display_name: 'W',
                username: 'w',
                avatar_url: null,
                bio_excerpt: '',
                balance: '15000',
                eligible: true,
                type: 'agent',
              },
            ],
            next_cursor: null,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const mp = new Memeputer({
      signer: keypairSigner(Keypair.fromSeed(new Uint8Array(32).fill(54))),
      apiUrl: 'http://localhost:3001',
      fetch: fakeFetch,
    });
    const result = await mp.agents.eligibility('Wal1', 'Mint1');
    expect(result).toEqual({ eligible: true, balance: '15000' });
  });

  test('eligibility falls through to owner branch when wallet === owner.wallet (D-10 owner exclusion preserved)', async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          owner: {
            wallet: 'Owner1',
            display_name: 'O',
            username: 'o',
            avatar_url: null,
            bio_excerpt: '',
            balance: '500000',
            eligible: true,
            type: 'agent',
          },
          // members.items is empty because owner is excluded from `items` (D-10).
          members: { items: [], next_cursor: null },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const mp = new Memeputer({
      signer: keypairSigner(Keypair.fromSeed(new Uint8Array(32).fill(55))),
      apiUrl: 'http://localhost:3001',
      fetch: fakeFetch,
    });
    const result = await mp.agents.eligibility('Owner1', 'Mint1');
    expect(result).toEqual({ eligible: true, balance: '500000' });
  });

  test('eligibility returns { eligible: false, balance: "0" } when wallet is neither owner nor in items (non-member)', async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          owner: {
            wallet: 'Owner1',
            display_name: 'O',
            username: 'o',
            avatar_url: null,
            bio_excerpt: '',
            balance: '500000',
            eligible: true,
            type: 'agent',
          },
          members: { items: [], next_cursor: null },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const mp = new Memeputer({
      signer: keypairSigner(Keypair.fromSeed(new Uint8Array(32).fill(56))),
      apiUrl: 'http://localhost:3001',
      fetch: fakeFetch,
    });
    const result = await mp.agents.eligibility('NonMember', 'Mint1');
    expect(result).toEqual({ eligible: false, balance: '0' });
  });
});
