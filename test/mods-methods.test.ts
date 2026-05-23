import { describe, test, expect } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { Memeputer, keypairSigner } from '../src/index.js';

/**
 * ModsNamespace method-dispatch tests (Plan 06-02 Task 2).
 *
 * Verifies the 7 mod actions route to the documented URL/method. The
 * underlying API responses vary per endpoint (`{ banned: true }`,
 * `{ unbanned: true }`, `{ appointed: true }`, `{ removed: true }`, etc.);
 * the SDK is a thin pass-through, so these tests assert only the wire
 * shape (URL + method).
 */

function buildMp() {
  const seen: Array<{ url: string; method: string }> = [];
  const mp = new Memeputer({
    signer: keypairSigner(Keypair.fromSeed(new Uint8Array(32).fill(70))),
    apiUrl: 'http://localhost:3001',
    fetch: async (url, init) => {
      seen.push({ url: url as string, method: (init?.method as string) ?? 'GET' });
      return new Response('{"ok":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  return { mp, seen };
}

describe('ModsNamespace method dispatch', () => {
  test('ban → POST /v1/rooms/:mint/bans', async () => {
    const { mp, seen } = buildMp();
    await mp.mods.ban('M', { userWallet: 'W', reason: 'spam' });
    expect(seen[0]).toEqual({
      method: 'POST',
      url: 'http://localhost:3001/v1/rooms/M/bans',
    });
  });

  test('unban → DELETE /v1/rooms/:mint/bans/:wallet', async () => {
    const { mp, seen } = buildMp();
    await mp.mods.unban('M', 'W');
    expect(seen[0]).toEqual({
      method: 'DELETE',
      url: 'http://localhost:3001/v1/rooms/M/bans/W',
    });
  });

  test('pin → POST /v1/rooms/:mint/pins/:msg', async () => {
    const { mp, seen } = buildMp();
    await mp.mods.pin('M', 'MSG');
    expect(seen[0]).toEqual({
      method: 'POST',
      url: 'http://localhost:3001/v1/rooms/M/pins/MSG',
    });
  });

  test('unpin → DELETE /v1/rooms/:mint/pins/:msg', async () => {
    const { mp, seen } = buildMp();
    await mp.mods.unpin('M', 'MSG');
    expect(seen[0]).toEqual({
      method: 'DELETE',
      url: 'http://localhost:3001/v1/rooms/M/pins/MSG',
    });
  });

  test('appoint → POST /v1/rooms/:mint/mods', async () => {
    const { mp, seen } = buildMp();
    await mp.mods.appoint('M', { userWallet: 'W' });
    expect(seen[0]).toEqual({
      method: 'POST',
      url: 'http://localhost:3001/v1/rooms/M/mods',
    });
  });

  test('revoke → DELETE /v1/rooms/:mint/mods/:wallet', async () => {
    const { mp, seen } = buildMp();
    await mp.mods.revoke('M', 'W');
    expect(seen[0]).toEqual({
      method: 'DELETE',
      url: 'http://localhost:3001/v1/rooms/M/mods/W',
    });
  });

  test('deleteMessage → DELETE /v1/rooms/:mint/messages/:msg', async () => {
    const { mp, seen } = buildMp();
    await mp.mods.deleteMessage('M', 'MSG');
    expect(seen[0]).toEqual({
      method: 'DELETE',
      url: 'http://localhost:3001/v1/rooms/M/messages/MSG',
    });
  });
});
