import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentsApiClient } from '../api';
import axios from 'axios';
import { Connection, Keypair } from '@solana/web3.js';

// Mock axios
vi.mock('axios');

// Mock the x402Client module
vi.mock('../x402Client', () => ({
  createPaymentTransaction: vi.fn().mockResolvedValue({
    transaction: {},
    signature: 'mock-payment-header-base64',
  }),
  getUsdcBalance: vi.fn().mockResolvedValue(10.0),
}));

describe('AgentsApiClient - x402 Protocol', () => {
  let client: AgentsApiClient;
  let mockWallet: Keypair;
  let mockConnection: Connection;

  beforeEach(() => {
    client = new AgentsApiClient('https://agents.api.memeputer.com');
    mockWallet = Keypair.generate();
    mockConnection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Decimal Amount Parsing (x402 Spec)', () => {
    it('should parse decimal USDC amount correctly for 0.01 USDC', async () => {
      // Mock 402 response with decimal USDC amount per x402 spec
      const mock402Response = {
        status: 402,
        data: {
          x402Version: 1,
          accepts: [{
            scheme: 'exact',
            network: 'solana-mainnet',
            maxAmountRequired: '0.01', // Decimal USDC per x402 spec
            resource: 'https://agents.api.memeputer.com/x402/interact',
            payTo: 'G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }],
        },
      };

      // Mock successful payment response
      const mockSuccessResponse = {
        status: 200,
        data: {
          x402Version: 1,
          success: true,
          response: 'Payment processed',
          agentId: 'test-agent',
        },
      };

      (axios.post as any).mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await client.interact('test-agent', 'test message', mockWallet, mockConnection);

      expect(result.success).toBe(true);
      expect(result.response).toBe('Payment processed');
    });

    it('should parse decimal USDC amount correctly for 0.10 USDC', async () => {
      const mock402Response = {
        status: 402,
        data: {
          x402Version: 1,
          accepts: [{
            scheme: 'exact',
            network: 'solana-mainnet',
            maxAmountRequired: '0.10', // Decimal USDC per x402 spec
            resource: 'https://agents.api.memeputer.com/x402/interact',
            payTo: 'G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }],
        },
      };

      const mockSuccessResponse = {
        status: 200,
        data: {
          x402Version: 1,
          success: true,
          response: 'Payment processed',
          x402Receipt: {
            amountPaidUsdc: 0.1,
            amountPaidMicroUsdc: 100000,
          },
        },
      };

      (axios.post as any).mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await client.interact('test-agent', 'test message', mockWallet, mockConnection);

      expect(result.success).toBe(true);
      expect(result.x402Receipt?.amountPaidUsdc).toBe(0.1);
      expect(result.x402Receipt?.amountPaidMicroUsdc).toBe(100000);
    });

    it('should parse decimal USDC amount correctly for 1.0 USDC', async () => {
      const mock402Response = {
        status: 402,
        data: {
          x402Version: 1,
          accepts: [{
            scheme: 'exact',
            network: 'solana-mainnet',
            maxAmountRequired: '1.00', // Decimal USDC per x402 spec
            resource: 'https://agents.api.memeputer.com/x402/interact',
            payTo: 'G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }],
        },
      };

      const mockSuccessResponse = {
        status: 200,
        data: {
          x402Version: 1,
          success: true,
          response: 'Payment processed',
        },
      };

      (axios.post as any).mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await client.interact('test-agent', 'test message', mockWallet, mockConnection);

      expect(result.success).toBe(true);
    });

    it('should handle edge case: 0.5 USDC decimal', async () => {
      const mock402Response = {
        status: 402,
        data: {
          x402Version: 1,
          accepts: [{
            scheme: 'exact',
            network: 'solana-mainnet',
            maxAmountRequired: '0.50', // Decimal USDC per x402 spec
            resource: 'https://agents.api.memeputer.com/x402/interact',
            payTo: 'G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }],
        },
      };

      const mockSuccessResponse = {
        status: 200,
        data: {
          x402Version: 1,
          success: true,
          response: 'Payment processed',
        },
      };

      (axios.post as any).mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await client.interact('test-agent', 'test message', mockWallet, mockConnection);

      expect(result.success).toBe(true);
    });

    it('should use default value if maxAmountRequired is missing', async () => {
      const mock402Response = {
        status: 402,
        data: {
          x402Version: 1,
          accepts: [{
            scheme: 'exact',
            network: 'solana-mainnet',
            // maxAmountRequired missing - should default to "0.01"
            resource: 'https://agents.api.memeputer.com/x402/interact',
            payTo: 'G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }],
        },
      };

      const mockSuccessResponse = {
        status: 200,
        data: {
          x402Version: 1,
          success: true,
          response: 'Payment processed',
        },
      };

      (axios.post as any).mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await client.interact('test-agent', 'test message', mockWallet, mockConnection);

      expect(result.success).toBe(true);
    });
  });

  describe('x402 Resource URL', () => {
    it('should use resource URL from 402 response for paid request', async () => {
      const customResourceUrl = 'https://custom-endpoint.com/x402/interact';
      
      const mock402Response = {
        status: 402,
        data: {
          x402Version: 1,
          accepts: [{
            scheme: 'exact',
            network: 'solana-mainnet',
            maxAmountRequired: '0.01',
            resource: customResourceUrl, // Custom resource URL
            payTo: 'G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }],
        },
      };

      const mockSuccessResponse = {
        status: 200,
        data: {
          x402Version: 1,
          success: true,
          response: 'Payment processed',
        },
      };

      (axios.post as any).mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      await client.interact('test-agent', 'test message', mockWallet, mockConnection);

      // Verify the second call (paid request) used the custom resource URL
      expect(axios.post).toHaveBeenCalledTimes(2);
      const secondCallArgs = (axios.post as any).mock.calls[1];
      expect(secondCallArgs[0]).toBe(customResourceUrl);
    });

    it('should fallback to default endpoint if resource URL is missing', async () => {
      const mock402Response = {
        status: 402,
        data: {
          x402Version: 1,
          accepts: [{
            scheme: 'exact',
            network: 'solana-mainnet',
            maxAmountRequired: '0.01',
            // resource field missing
            payTo: 'G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }],
        },
      };

      const mockSuccessResponse = {
        status: 200,
        data: {
          x402Version: 1,
          success: true,
          response: 'Payment processed',
        },
      };

      (axios.post as any).mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      await client.interact('test-agent', 'test message', mockWallet, mockConnection);

      // Verify the second call used the default endpoint
      expect(axios.post).toHaveBeenCalledTimes(2);
      const secondCallArgs = (axios.post as any).mock.calls[1];
      expect(secondCallArgs[0]).toBe('https://agents.api.memeputer.com/x402/interact');
    });
  });

  describe('Network Identifier', () => {
    it('should use "solana-mainnet" as network identifier per x402 spec', async () => {
      const mock402Response = {
        status: 402,
        data: {
          x402Version: 1,
          accepts: [{
            scheme: 'exact',
            network: 'solana-mainnet', // Official x402 spec uses "{blockchain}-mainnet" format
            maxAmountRequired: '0.01',
            resource: 'https://agents.api.memeputer.com/x402/interact',
            payTo: 'G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }],
        },
      };

      const mockSuccessResponse = {
        status: 200,
        data: {
          x402Version: 1,
          success: true,
          response: 'Payment processed',
        },
      };

      (axios.post as any).mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await client.interact('test-agent', 'test message', mockWallet, mockConnection);

      expect(result.success).toBe(true);
    });

    it('should default to "solana-mainnet" if network is missing', async () => {
      const mock402Response = {
        status: 402,
        data: {
          x402Version: 1,
          accepts: [{
            scheme: 'exact',
            // network missing - should default to "solana-mainnet"
            maxAmountRequired: '0.01',
            resource: 'https://agents.api.memeputer.com/x402/interact',
            payTo: 'G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }],
        },
      };

      const mockSuccessResponse = {
        status: 200,
        data: {
          x402Version: 1,
          success: true,
          response: 'Payment processed',
        },
      };

      (axios.post as any).mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await client.interact('test-agent', 'test message', mockWallet, mockConnection);

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error if accepts array is missing', async () => {
      const mock402Response = {
        status: 402,
        data: {
          x402Version: 1,
          // accepts array missing
        },
      };

      (axios.post as any).mockResolvedValueOnce(mock402Response);

      await expect(
        client.interact('test-agent', 'test message', mockWallet, mockConnection)
      ).rejects.toThrow('No payment details in 402 response');
    });

    it('should throw error if payTo is missing', async () => {
        const mock402Response = {
        status: 402,
        data: {
          x402Version: 1,
          accepts: [{
            scheme: 'exact',
            network: 'solana-mainnet',
            maxAmountRequired: '0.01',
            resource: 'https://agents.api.memeputer.com/x402/interact',
            // payTo missing
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          }],
        },
      };

      (axios.post as any).mockResolvedValueOnce(mock402Response);

      await expect(
        client.interact('test-agent', 'test message', mockWallet, mockConnection)
      ).rejects.toThrow('No recipient wallet (payTo) found in 402 response');
    });
  });
});

