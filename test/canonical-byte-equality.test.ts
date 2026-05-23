import { describe, test, expect } from 'vitest';
import { canonical } from '../src/internal/canonical.js';
import { Memeputer, keypairSigner } from '../src/index.js';
import { Keypair } from '@solana/web3.js';

describe('SDK-03: byte-equality contract', () => {
  test('SDK signedRequest wire body == canonical() body slice (byte-for-byte)', async () => {
    const kp = Keypair.fromSeed(new Uint8Array(32).fill(7));
    const captured: {
      method: string;
      headers: Record<string, string>;
      body: string | undefined;
    } = { method: '', headers: {}, body: undefined };
    const fakeFetch: typeof fetch = async (_url, init) => {
      captured.method = (init?.method as string) ?? 'GET';
      captured.headers = init?.headers as Record<string, string>;
      captured.body = init?.body as string | undefined;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const mp = new Memeputer({
      signer: keypairSigner(kp),
      apiUrl: 'http://localhost:3001',
      fetch: fakeFetch,
    });

    const body = { z: 1, a: 'hello', m: [3, 2, 1] };
    await mp.signedRequest('POST', '/v1/rooms', body);

    // Recompute the expected wire body using canonical().
    const buf = canonical({ method: 'POST', path: '/v1/rooms', body });
    const domain = new TextEncoder().encode('memeputer.com/v1\n');
    const methodPath = new TextEncoder().encode('POST /v1/rooms\n');
    const expectedBody = new TextDecoder().decode(buf.slice(domain.length + methodPath.length));

    expect(captured.body).toBe(expectedBody);
  });

  test('canonical() output is sortable + deterministic (regression for sort drift)', () => {
    const a = canonical({ method: 'POST', path: '/x', body: { b: 2, a: 1 } });
    const b = canonical({ method: 'POST', path: '/x', body: { a: 1, b: 2 } });
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
