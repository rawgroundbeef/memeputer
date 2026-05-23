import { describe, test, expect } from 'vitest';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { keypairSigner } from '../src/index.js';

describe('keypairSigner adapter', () => {
  test('signMessage returns 64-byte raw Ed25519 sig verifiable by nacl.sign.detached.verify', async () => {
    const kp = Keypair.fromSeed(new Uint8Array(32).fill(42));
    const signer = keypairSigner(kp);
    const msg = new TextEncoder().encode('hello memeputer');
    const sig = await signer.signMessage(msg);
    expect(sig.length).toBe(64);
    expect(nacl.sign.detached.verify(msg, sig, kp.publicKey.toBytes())).toBe(true);
  });

  test('publicKey identity preserved', () => {
    const kp = Keypair.generate();
    expect(keypairSigner(kp).publicKey.toBase58()).toBe(kp.publicKey.toBase58());
  });
});
