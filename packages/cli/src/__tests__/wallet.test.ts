import { describe, it, expect } from 'vitest';
import { Keypair } from '@solana/web3.js';

describe('Wallet Utilities', () => {
  describe('Keypair Generation', () => {
    it('should generate valid Solana keypairs', () => {
      const keypair = Keypair.generate();
      
      expect(keypair).toBeDefined();
      expect(keypair.publicKey).toBeDefined();
      expect(keypair.secretKey).toBeDefined();
      expect(keypair.publicKey.toBase58()).toBeTruthy();
      expect(keypair.secretKey.length).toBe(64);
    });

    it('should generate unique keypairs', () => {
      const keypair1 = Keypair.generate();
      const keypair2 = Keypair.generate();
      
      expect(keypair1.publicKey.toBase58()).not.toBe(keypair2.publicKey.toBase58());
    });
  });

  describe('Public Key Validation', () => {
    it('should validate public key format', () => {
      const keypair = Keypair.generate();
      const pubkey = keypair.publicKey.toBase58();
      
      // Solana public keys are base58 encoded, typically 32-44 chars
      expect(pubkey.length).toBeGreaterThan(30);
      expect(pubkey.length).toBeLessThan(50);
      expect(/^[1-9A-HJ-NP-Za-km-z]+$/.test(pubkey)).toBe(true); // Base58 alphabet
    });
  });
});

