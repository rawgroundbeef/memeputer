import { describe, it, expect } from 'vitest';
import {
  formatAgent,
  formatPublicKey,
  formatUsdc,
  formatError,
  formatSuccess,
} from '../utils/formatting';

describe('CLI Formatting Utilities', () => {
  describe('formatAgent', () => {
    it('should format agent name with emoji', () => {
      const result = formatAgent('memeputer');
      expect(result).toContain('memeputer');
      expect(result).toContain('🤖');
    });
  });

  describe('formatPublicKey', () => {
    it('should truncate long public keys', () => {
      const longKey = 'G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ';
      const result = formatPublicKey(longKey);
      expect(result).toContain('G31J');
      expect(result).toContain('...');
      expect(result.length).toBeLessThan(longKey.length);
    });

    it('should handle short keys', () => {
      const shortKey = 'ABC123';
      const result = formatPublicKey(shortKey);
      expect(result).toContain('ABC123');
    });
  });

  describe('formatUsdc', () => {
    it('should format USDC amounts with 2 decimals by default', () => {
      expect(formatUsdc(1.5)).toContain('1.50');
      expect(formatUsdc(1.5)).toContain('USDC');
    });

    it('should format small amounts with more decimals', () => {
      expect(formatUsdc(0.001)).toContain('0.001');
      expect(formatUsdc(0.0001)).toContain('0.0001');
    });

    it('should format zero correctly', () => {
      expect(formatUsdc(0)).toContain('0.00');
    });

    it('should format large amounts correctly', () => {
      expect(formatUsdc(1000)).toContain('1000.00');
      expect(formatUsdc(1000.5)).toContain('1000.50');
    });
  });

  describe('formatError', () => {
    it('should format error messages', () => {
      const result = formatError('Something went wrong');
      expect(result).toContain('Something went wrong');
      expect(result).toContain('❌');
    });
  });

  describe('formatSuccess', () => {
    it('should format success messages', () => {
      const result = formatSuccess('Operation completed');
      expect(result).toContain('Operation completed');
      expect(result).toContain('✅');
    });
  });
});

