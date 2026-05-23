import { describe, test, expect } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { Memeputer, keypairSigner } from '../src/index.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { canonical } from '../src/internal/canonical.js';

describe('Memeputer client header assembly + envelope parse', () => {
  test('https:// or http://localhost only — rejects other schemes', () => {
    expect(
      () =>
        new Memeputer({
          signer: keypairSigner(Keypair.generate()),
          apiUrl: 'http://malicious.example',
        }),
    ).toThrow(/apiUrl must use https:\/\//);
    expect(
      () =>
        new Memeputer({
          signer: keypairSigner(Keypair.generate()),
          apiUrl: 'https://api.memeputer.com',
        }),
    ).not.toThrow();
    expect(
      () =>
        new Memeputer({
          signer: keypairSigner(Keypair.generate()),
          apiUrl: 'http://localhost:3001',
        }),
    ).not.toThrow();
  });

  test('signedRequest emits four X-Memeputer-* headers + Content-Type + valid bs58 sig that verifies', async () => {
    const kp = Keypair.fromSeed(new Uint8Array(32).fill(1));
    let captured: { headers: Record<string, string>; body: string | undefined } | null = null;
    const mp = new Memeputer({
      signer: keypairSigner(kp),
      apiUrl: 'http://localhost:3001',
      fetch: async (_url, init) => {
        captured = {
          headers: init?.headers as Record<string, string>,
          body: init?.body as string | undefined,
        };
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    await mp.signedRequest('POST', '/v1/rooms', { displayName: 'X' });
    expect(captured).not.toBeNull();
    const c = captured as unknown as { headers: Record<string, string>; body: string };
    expect(c.headers['X-Memeputer-Wallet']).toBe(kp.publicKey.toBase58());
    expect(c.headers['X-Memeputer-Timestamp']).toMatch(/^\d{13,}$/);
    expect(c.headers['X-Memeputer-Nonce']).toMatch(/^[0-9a-f-]{36}$/); // crypto.randomUUID
    expect(c.headers['Content-Type']).toBe('application/json');

    // Verify the signature against the canonical bytes.
    const sigBytes = bs58.decode(c.headers['X-Memeputer-Signature']);
    expect(sigBytes.length).toBe(64);
    const buf = canonical({ method: 'POST', path: '/v1/rooms', body: { displayName: 'X' } });
    expect(nacl.sign.detached.verify(buf, sigBytes, kp.publicKey.toBytes())).toBe(true);
  });

  test('two consecutive signedRequest calls produce distinct nonces (no caching)', async () => {
    const kp = Keypair.fromSeed(new Uint8Array(32).fill(2));
    const nonces: string[] = [];
    const mp = new Memeputer({
      signer: keypairSigner(kp),
      apiUrl: 'http://localhost:3001',
      fetch: async (_url, init) => {
        nonces.push((init?.headers as Record<string, string>)['X-Memeputer-Nonce']);
        return new Response('{}', { status: 200 });
      },
    });
    await mp.signedRequest('POST', '/v1/rooms', { a: 1 });
    await mp.signedRequest('POST', '/v1/rooms', { a: 1 });
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  test('non-2xx → throws MemeputerApiError with code + status + details', async () => {
    const mp = new Memeputer({
      signer: keypairSigner(Keypair.fromSeed(new Uint8Array(32).fill(3))),
      apiUrl: 'http://localhost:3001',
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: { code: 'BANNED', message: 'banned', details: { reason: 'spam' } },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
    });
    await expect(
      mp.signedRequest('POST', '/v1/rooms/M/messages', { body: 'gm' }),
    ).rejects.toMatchObject({ code: 'BANNED', status: 403, details: { reason: 'spam' } });
  });
});
