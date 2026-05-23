import { describe, expect, test } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { Memeputer, keypairSigner } from '../src/index.js';

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function buildMpWithCaptor() {
  const seen: Captured[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    const body = init?.body;
    seen.push({
      url: url as string,
      method: (init?.method as string) ?? 'GET',
      headers: (init?.headers as Record<string, string>) ?? {},
      body,
    });

    if ((url as string).endsWith('/v1/uploads/sign')) {
      return new Response(
        JSON.stringify({
          upload_url: 'https://mock-r2.example/avatars/wallet/01.webp?sig=mock',
          method: 'PUT',
          headers: {
            'content-type': 'image/webp',
            'cache-control': 'public, max-age=31536000, immutable',
          },
          path: 'avatars/wallet/01.webp',
          public_url: 'https://media.memeputer.com/avatars/wallet/01.webp',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if ((url as string).startsWith('https://mock-r2.example/')) {
      return new Response('', { status: 200 });
    }

    return new Response(
      JSON.stringify({
        wallet: 'SignerWallet',
        display_name: 'Signer',
        username: 'signer',
        avatar_url: 'https://media.memeputer.com/avatars/wallet/01.webp',
        bio: null,
        registered_at: new Date(0).toISOString(),
        active_rooms: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const mp = new Memeputer({
    signer: keypairSigner(Keypair.fromSeed(new Uint8Array(32).fill(80))),
    apiUrl: 'http://localhost:3001',
    fetch: fakeFetch,
  });

  return { mp, seen };
}

describe('MediaNamespace', () => {
  test('sign issues signed POST /v1/uploads/sign for agent avatars', async () => {
    const { mp, seen } = buildMpWithCaptor();

    const signed = await mp.media.sign({ kind: 'agent-avatar', contentType: 'image/webp' });

    expect(signed.public_url).toBe('https://media.memeputer.com/avatars/wallet/01.webp');
    expect(seen[0]!.url).toBe('http://localhost:3001/v1/uploads/sign');
    expect(seen[0]!.method).toBe('POST');
    expect(JSON.parse(seen[0]!.body as string)).toEqual({
      kind: 'agent-avatar',
      contentType: 'image/webp',
    });
    expect(seen[0]!.headers['X-Memeputer-Signature']).toBeDefined();
  });

  test('uploadAgentAvatar signs then PUTs bytes to the returned presigned URL', async () => {
    const { mp, seen } = buildMpWithCaptor();

    const uploaded = await mp.media.uploadAgentAvatar('webp-bytes');

    expect(uploaded).toEqual({
      path: 'avatars/wallet/01.webp',
      publicUrl: 'https://media.memeputer.com/avatars/wallet/01.webp',
    });
    expect(seen[1]!.url).toBe('https://mock-r2.example/avatars/wallet/01.webp?sig=mock');
    expect(seen[1]!.method).toBe('PUT');
    expect(seen[1]!.headers).toEqual({
      'content-type': 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
    });
    expect(seen[1]!.body).toBe('webp-bytes');
  });

  test('uploadAndSetAgentAvatar uploads then patches the agent profile', async () => {
    const { mp, seen } = buildMpWithCaptor();

    const result = await mp.media.uploadAndSetAgentAvatar('webp-bytes', 'SignerWallet');

    expect(result.publicUrl).toBe('https://media.memeputer.com/avatars/wallet/01.webp');
    expect(result.profile.avatar_url).toBe('https://media.memeputer.com/avatars/wallet/01.webp');
    expect(seen[2]!.url).toBe('http://localhost:3001/v1/agents/SignerWallet');
    expect(seen[2]!.method).toBe('PATCH');
    expect(JSON.parse(seen[2]!.body as string)).toEqual({
      avatarUrl: 'https://media.memeputer.com/avatars/wallet/01.webp',
    });
  });
});
