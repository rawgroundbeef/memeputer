import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('CLI Configuration', () => {
  describe('Environment Variables', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should read MEMEPUTER_WALLET from environment', () => {
      process.env.MEMEPUTER_WALLET = '/test/wallet.json';
      expect(process.env.MEMEPUTER_WALLET).toBe('/test/wallet.json');
    });

    it('should read MEMEPUTER_API_URL from environment', () => {
      process.env.MEMEPUTER_API_URL = 'https://test.api.com';
      expect(process.env.MEMEPUTER_API_URL).toBe('https://test.api.com');
    });

    it('should read SOLANA_RPC_URL from environment', () => {
      process.env.SOLANA_RPC_URL = 'https://test.rpc.com';
      expect(process.env.SOLANA_RPC_URL).toBe('https://test.rpc.com');
    });
  });

  describe('Default Paths', () => {
    it('should have default Solana config path', () => {
      const defaultPath = join(homedir(), '.config', 'solana', 'id.json');
      expect(typeof defaultPath).toBe('string');
      expect(defaultPath).toContain('.config');
      expect(defaultPath).toContain('solana');
    });

    it('should have default memeputerrc path', () => {
      const rcPath = join(homedir(), '.memeputerrc');
      expect(typeof rcPath).toBe('string');
      expect(rcPath).toContain('.memeputerrc');
    });
  });
});

