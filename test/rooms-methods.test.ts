import { describe, test, expect } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { Memeputer, keypairSigner } from '../src/index.js';

/**
 * RoomsNamespace method-dispatch tests (Plan 06-02 Task 2).
 *
 * Verifies the 9 non-WS methods route to the documented URL/method/body.
 * Subscribe wiring is covered in subscribe.test.ts (mocks socket.io-client).
 */

function buildMpWithCaptor(responseBody = '{"ok":true,"items":[]}') {
  const seen: Array<{ url: string; method: string; body: unknown }> = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    seen.push({
      url: url as string,
      method: (init?.method as string) ?? 'GET',
      body: init?.body ? JSON.parse(init.body as string) : null,
    });
    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const mp = new Memeputer({
    signer: keypairSigner(Keypair.fromSeed(new Uint8Array(32).fill(60))),
    apiUrl: 'http://localhost:3001',
    fetch: fakeFetch,
  });
  return { mp, seen };
}

describe('RoomsNamespace method dispatch', () => {
  test('create → POST /v1/rooms with full body', async () => {
    const { mp, seen } = buildMpWithCaptor();
    await mp.rooms.create({
      displayName: 'X',
      imageUrl: 'https://media.memeputer.com/x.png',
      accessType: 'both',
    });
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe('http://localhost:3001/v1/rooms');
    expect(seen[0]!.body).toEqual({
      displayName: 'X',
      imageUrl: 'https://media.memeputer.com/x.png',
      accessType: 'both',
    });
  });

  test('patch → PATCH /v1/rooms/:mint', async () => {
    const { mp, seen } = buildMpWithCaptor();
    await mp.rooms.patch('MintX', { displayName: 'New' });
    expect(seen[0]!.method).toBe('PATCH');
    expect(seen[0]!.url).toBe('http://localhost:3001/v1/rooms/MintX');
    expect(seen[0]!.body).toEqual({ displayName: 'New' });
  });

  test('list → GET /v1/rooms?sort=mcap&limit=20&offset=0', async () => {
    const { mp, seen } = buildMpWithCaptor();
    await mp.rooms.list({ sort: 'mcap', limit: 20, offset: 0 });
    expect(seen[0]!.method).toBe('GET');
    expect(seen[0]!.url).toBe(
      'http://localhost:3001/v1/rooms?sort=mcap&limit=20&offset=0',
    );
  });

  test('list with no args → GET /v1/rooms (no query string)', async () => {
    const { mp, seen } = buildMpWithCaptor();
    await mp.rooms.list();
    expect(seen[0]!.method).toBe('GET');
    expect(seen[0]!.url).toBe('http://localhost:3001/v1/rooms');
  });

  test('get → GET /v1/rooms/:mint', async () => {
    const { mp, seen } = buildMpWithCaptor();
    await mp.rooms.get('MintX');
    expect(seen[0]!.method).toBe('GET');
    expect(seen[0]!.url).toBe('http://localhost:3001/v1/rooms/MintX');
  });

  test('post → POST /v1/rooms/:mint/messages with body+parentMessageId', async () => {
    const { mp, seen } = buildMpWithCaptor();
    await mp.rooms.post('MintX', { body: 'gm', parentMessageId: '01ABCDE' });
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe('http://localhost:3001/v1/rooms/MintX/messages');
    expect(seen[0]!.body).toEqual({ body: 'gm', parentMessageId: '01ABCDE' });
  });

  test('messages → GET /v1/rooms/:mint/messages?limit=50&before=abc123', async () => {
    const { mp, seen } = buildMpWithCaptor();
    await mp.rooms.messages('MintX', { limit: 50, before: 'abc123' });
    expect(seen[0]!.url).toContain('limit=50');
    expect(seen[0]!.url).toContain('before=abc123');
  });

  test('members → GET /v1/rooms/:mint/members?limit=20', async () => {
    const { mp, seen } = buildMpWithCaptor();
    await mp.rooms.members('MintX', { limit: 20 });
    expect(seen[0]!.url).toBe('http://localhost:3001/v1/rooms/MintX/members?limit=20');
  });

  // CR-01 regression: response shape was previously typed as a flat
  // `{ items, next_cursor }` but the wire ships `{ owner, members: { items,
  // next_cursor } }`. Assert the wire shape so future drift fails CI.
  test('members → response carries `owner` + nested `members.items/next_cursor`', async () => {
    const ownerWallet = '11111111111111111111111111111111';
    const memberWallet = '22222222222222222222222222222222';
    const responseBody = JSON.stringify({
      owner: {
        wallet: ownerWallet,
        display_name: 'Owner',
        username: 'owner',
        avatar_url: null,
        bio_excerpt: '',
        balance: '1000000',
        eligible: true,
        type: 'agent',
      },
      members: {
        items: [
          {
            wallet: memberWallet,
            display_name: 'Mem',
            username: 'mem',
            avatar_url: null,
            bio_excerpt: '',
            balance: '500',
            eligible: true,
            type: 'agent',
          },
        ],
        next_cursor: null,
      },
    });
    const { mp } = buildMpWithCaptor(responseBody);
    const page = await mp.rooms.members('MintX');
    expect(page.owner.wallet).toBe(ownerWallet);
    expect(page.members.items).toHaveLength(1);
    expect(page.members.items[0]!.wallet).toBe(memberWallet);
    expect(page.members.next_cursor).toBeNull();
  });

  test('search → GET /v1/search?q=gm&type=messages&limit=10', async () => {
    const { mp, seen } = buildMpWithCaptor();
    await mp.rooms.search({ q: 'gm', type: 'messages', limit: 10 });
    const url = seen[0]!.url;
    expect(url).toContain('q=gm');
    expect(url).toContain('type=messages');
    expect(url).toContain('limit=10');
  });

  // CR-02 regression: SearchResult was previously typed as `{ messages,
  // rooms, agents }` but the wire ships `{ query, results: SearchHit[] }`
  // with a `kind` discriminator. Assert the wire shape so future drift
  // fails CI.
  test('search → response carries `query` + flat `results[]` with kind discriminator', async () => {
    const responseBody = JSON.stringify({
      query: 'gm',
      results: [
        {
          kind: 'message',
          id: '01M',
          title: 'gm world',
          subtitle: null,
          room_mint: 'MintX',
          agent_wallet: 'Wallet1',
          rank: 0.8,
          created_at: '2026-05-17T00:00:00.000Z',
        },
        {
          kind: 'room',
          id: 'MintX',
          title: 'Greeters',
          subtitle: null,
          room_mint: 'MintX',
          agent_wallet: null,
          rank: 0.5,
          created_at: '2026-05-17T00:00:00.000Z',
        },
      ],
    });
    const { mp } = buildMpWithCaptor(responseBody);
    const page = await mp.rooms.search({ q: 'gm' });
    expect(page.query).toBe('gm');
    expect(page.results).toHaveLength(2);
    expect(page.results[0]!.kind).toBe('message');
    expect(page.results[1]!.kind).toBe('room');
  });
});
