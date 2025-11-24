import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Memeputer } from '../index';
import { Connection, Keypair } from '@solana/web3.js';

// Mock the API client
vi.mock('../api', () => {
  class MockAgentsApiClient {
    interact = vi.fn();
    checkStatus = vi.fn();
    pollStatus = vi.fn();
    listAgents = vi.fn();
  }
  return {
    AgentsApiClient: MockAgentsApiClient,
  };
});

describe('Memeputer SDK', () => {
  let memeputer: Memeputer;
  let mockWallet: Keypair;
  let mockConnection: Connection;
  let mockApiClient: any;

  beforeEach(() => {
    // Create a mock wallet and connection
    mockWallet = Keypair.generate();
    mockConnection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    // Create SDK instance
    memeputer = new Memeputer({
      apiUrl: 'https://agents.memeputer.com/x402',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      wallet: mockWallet,
      connection: mockConnection,
    });

    // Get the mocked API client instance
    mockApiClient = (memeputer as any).apiClient;
  });

  describe('prompt()', () => {
    it('should call interact with string overload', async () => {
      const mockResponse = {
        response: 'Hello, world!',
        success: true,
        format: 'text',
        agentId: 'test-agent',
        transactionSignature: 'test-tx',
      };

      mockApiClient.interact.mockResolvedValue(mockResponse);

      const result = await memeputer.prompt('test-agent', 'Hello');

      expect(mockApiClient.interact).toHaveBeenCalledWith(
        'test-agent',
        'Hello',
        mockWallet,
        mockConnection,
      );
      expect(result.response).toBe('Hello, world!');
    });

    it('should call interact with object overload', async () => {
      const mockResponse = {
        response: 'Response text',
        success: true,
        format: 'text',
        agentId: 'test-agent',
        transactionSignature: 'test-tx',
      };

      mockApiClient.interact.mockResolvedValue(mockResponse);

      const result = await memeputer.prompt({
        agentId: 'test-agent',
        message: 'Test message',
      });

      expect(mockApiClient.interact).toHaveBeenCalledWith(
        'test-agent',
        'Test message',
        mockWallet,
        mockConnection,
      );
      expect(result.response).toBe('Response text');
    });
  });

  describe('command()', () => {
    it('should call interact with simple command (no params)', async () => {
      const mockResponse = {
        response: 'pong',
        success: true,
        format: 'text',
        agentId: 'memeputer',
        transactionSignature: 'test-tx',
      };

      mockApiClient.interact.mockResolvedValue(mockResponse);

      const result = await memeputer.command('memeputer', 'ping');

      expect(mockApiClient.interact).toHaveBeenCalledWith(
        'memeputer',
        '/ping',
        mockWallet,
        mockConnection,
      );
      expect(result.response).toBe('pong');
    });

    it('should format command with positional params as CLI format', async () => {
      const mockResponse = {
        response: 'Success',
        success: true,
        format: 'text',
        agentId: 'pfpputer',
        transactionSignature: 'test-tx',
      };

      mockApiClient.interact.mockResolvedValue(mockResponse);

      const result = await memeputer.command('pfpputer', 'pfp', ['generate', 'a cat']);

      expect(mockApiClient.interact).toHaveBeenCalledWith(
        'pfpputer',
        '/pfp generate a cat',
        mockWallet,
        mockConnection,
      );
      expect(result.response).toBe('Success');
    });

    it('should format command with named string params as CLI format', async () => {
      const mockResponse = {
        response: 'Success',
        success: true,
        format: 'text',
        agentId: 'pfpputer',
        transactionSignature: 'test-tx',
      };

      mockApiClient.interact.mockResolvedValue(mockResponse);

      const result = await memeputer.command('pfpputer', 'pfp', {
        style: 'anime',
        subject: 'cat',
      });

      expect(mockApiClient.interact).toHaveBeenCalledWith(
        'pfpputer',
        '/pfp --style anime --subject cat',
        mockWallet,
        mockConnection,
      );
      expect(result.response).toBe('Success');
    });

    it('should send complex params as JSON', async () => {
      const mockResponse = {
        response: 'Brief generated',
        success: true,
        format: 'text',
        agentId: 'briefputer',
        transactionSignature: 'test-tx',
      };

      mockApiClient.interact.mockResolvedValue(mockResponse);

      const result = await memeputer.command('briefputer', 'generate_brief', {
        trendItem: { title: 'Test', summary: 'Test summary' },
        policy: { denyTerms: [] },
      });

      // Should use command-specific endpoint (empty message, params passed separately)
      const callArgs = mockApiClient.interact.mock.calls[0];
      const message = callArgs[1];
      const command = callArgs[4];
      const params = callArgs[5];
      
      expect(message).toBe(''); // Empty message for command-specific endpoint
      expect(command).toBe('generate_brief');
      expect(params).toBeDefined();
      expect(params.trendItem).toBeDefined();
      expect(params.policy).toBeDefined();
      expect(result.response).toBe('Brief generated');
    });

    it('should send commands in jsonPayloadCommands list as JSON even with simple params', async () => {
      const mockResponse = {
        response: 'Image described',
        success: true,
        format: 'text',
        agentId: 'imagedescripterputer',
        transactionSignature: 'test-tx',
      };

      mockApiClient.interact.mockResolvedValue(mockResponse);

      const result = await memeputer.command('imagedescripterputer', 'describe_image', {
        imageUrl: 'https://example.com/image.png',
        detailLevel: 'detailed',
      });

      // Should use command-specific endpoint because describe_image is in jsonPayloadCommands
      const callArgs = mockApiClient.interact.mock.calls[0];
      const message = callArgs[1];
      const command = callArgs[4];
      const params = callArgs[5];
      
      expect(message).toBe(''); // Empty message for command-specific endpoint
      expect(command).toBe('describe_image');
      expect(params).toBeDefined();
      expect(params.imageUrl).toBe('https://example.com/image.png');
      expect(params.detailLevel).toBe('detailed');
      expect(result.response).toBe('Image described');
    });

    it('should call interact with object syntax', async () => {
      const mockResponse = {
        response: 'pong',
        success: true,
        format: 'text',
        agentId: 'memeputer',
        transactionSignature: 'test-tx',
      };

      mockApiClient.interact.mockResolvedValue(mockResponse);

      const result = await memeputer.command({
        agentId: 'memeputer',
        command: 'ping',
      });

      expect(mockApiClient.interact).toHaveBeenCalledWith(
        'memeputer',
        '/ping',
        mockWallet,
        mockConnection,
      );
      expect(result.response).toBe('pong');
    });

    describe('camelCase to kebab-case conversion', () => {
      it('should convert camelCase keys to kebab-case flags', async () => {
        const mockResponse = {
          response: 'Success',
          success: true,
          format: 'text',
          agentId: 'pfpputer',
          transactionSignature: 'test-tx',
        };

        mockApiClient.interact.mockResolvedValue(mockResponse);

        const result = await memeputer.command('pfpputer', 'pfp', {
          refImages: ['url1', 'url2'],
          maxWidth: 1024,
        });

        expect(mockApiClient.interact).toHaveBeenCalledWith(
          'pfpputer',
          '/pfp --ref-images url1 url2 --max-width 1024',
          mockWallet,
          mockConnection,
        );
        expect(result.response).toBe('Success');
      });

      it('should handle positional args with _args key', async () => {
        const mockResponse = {
          response: 'Success',
          success: true,
          format: 'text',
          agentId: 'pfpputer',
          transactionSignature: 'test-tx',
        };

        mockApiClient.interact.mockResolvedValue(mockResponse);

        const result = await memeputer.command('pfpputer', 'pfp', {
          _args: ['generate', 'a cat'],
          refImages: ['url1', 'url2'],
        });

        expect(mockApiClient.interact).toHaveBeenCalledWith(
          'pfpputer',
          '/pfp generate a cat --ref-images url1 url2',
          mockWallet,
          mockConnection,
        );
        expect(result.response).toBe('Success');
      });

      it('should handle positional args with args key (alternative)', async () => {
        const mockResponse = {
          response: 'Success',
          success: true,
          format: 'text',
          agentId: 'pfpputer',
          transactionSignature: 'test-tx',
        };

        mockApiClient.interact.mockResolvedValue(mockResponse);

        const result = await memeputer.command('pfpputer', 'pfp', {
          args: ['generate', 'a cat'],
          refImages: ['url1'],
        });

        expect(mockApiClient.interact).toHaveBeenCalledWith(
          'pfpputer',
          '/pfp generate a cat --ref-images url1',
          mockWallet,
          mockConnection,
        );
        expect(result.response).toBe('Success');
      });

      it('should handle single value flags (not arrays)', async () => {
        const mockResponse = {
          response: 'Success',
          success: true,
          format: 'text',
          agentId: 'pfpputer',
          transactionSignature: 'test-tx',
        };

        mockApiClient.interact.mockResolvedValue(mockResponse);

        const result = await memeputer.command('pfpputer', 'pfp', {
          style: 'anime',
          maxWidth: 1024,
        });

        expect(mockApiClient.interact).toHaveBeenCalledWith(
          'pfpputer',
          '/pfp --style anime --max-width 1024',
          mockWallet,
          mockConnection,
        );
        expect(result.response).toBe('Success');
      });

      it('should handle complex camelCase conversions', async () => {
        const mockResponse = {
          response: 'Success',
          success: true,
          format: 'text',
          agentId: 'test-agent',
          transactionSignature: 'test-tx',
        };

        mockApiClient.interact.mockResolvedValue(mockResponse);

        const result = await memeputer.command('test-agent', 'test', {
          camelCaseKey: 'value',
          multiWordKeyName: 'value2',
          single: 'value3',
        });

        expect(mockApiClient.interact).toHaveBeenCalledWith(
          'test-agent',
          '/test --camel-case-key value --multi-word-key-name value2 --single value3',
          mockWallet,
          mockConnection,
        );
        expect(result.response).toBe('Success');
      });
    });
  });
});

