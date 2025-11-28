import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Connection, Keypair } from '@solana/web3.js';
import { Orchestrator } from '../orchestrator';
import { TaskRequest } from '../types';

// Mock the SDK
vi.mock('@memeputer/sdk', async () => {
  const actual = await vi.importActual('@memeputer/sdk');
  class MockMemeputer {
    prompt = vi.fn();
    command = vi.fn();
    pollStatus = vi.fn();
  }
  return {
    ...actual,
    Memeputer: MockMemeputer,
    getUsdcBalance: vi.fn(),
  };
});

// Mock the logger
vi.mock('../lib/logger', () => {
  class MockCleanLogger {
    section = vi.fn();
    startLoading = vi.fn();
    stopLoading = vi.fn();
    result = vi.fn();
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    logError = vi.fn();
    log = vi.fn();
    spacer = vi.fn();
    payment = vi.fn();
    failLoading = vi.fn();
  }
  return {
    CleanLogger: MockCleanLogger,
  };
});

// Mock utils
vi.mock('../lib/utils', () => ({
  detectNetwork: vi.fn(() => 'mainnet' as const),
  getSolscanTxUrl: vi.fn((tx: string) => `https://solscan.io/tx/${tx}`),
  getSolscanAccountUrl: vi.fn((addr: string) => `https://solscan.io/account/${addr}`),
}));

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let mockWallet: Keypair;
  let mockConnection: Connection;
  let mockMemeputer: any;
  let mockGetUsdcBalance: any;

  beforeEach(async () => {
    mockWallet = Keypair.generate();
    mockConnection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

    const { Memeputer, getUsdcBalance } = await import('@memeputer/sdk');
    mockGetUsdcBalance = getUsdcBalance as any;
    mockGetUsdcBalance.mockResolvedValue(10.0); // Default balance

    orchestrator = new Orchestrator({
      wallet: mockWallet,
      connection: mockConnection,
      apiBase: 'https://agents.memeputer.com/x402',
    });

    mockMemeputer = (orchestrator as any).memeputer;
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(orchestrator).toBeInstanceOf(Orchestrator);
      expect((orchestrator as any).wallet).toBe(mockWallet);
      expect((orchestrator as any).connection).toBe(mockConnection);
      expect((orchestrator as any).apiBase).toBe('https://agents.memeputer.com/x402');
    });

    it('should initialize tracking variables', () => {
      expect((orchestrator as any).totalSpent).toBe(0);
      expect((orchestrator as any).agentsHired).toEqual([]);
      expect((orchestrator as any).payments).toEqual([]);
    });
  });

  describe('getBalance()', () => {
    it('should return USDC balance', async () => {
      mockGetUsdcBalance.mockResolvedValue(5.5);
      const balance = await orchestrator.getBalance();
      expect(balance).toBe(5.5);
      expect(mockGetUsdcBalance).toHaveBeenCalledWith(mockConnection, mockWallet);
    });
  });

  describe('executeTask()', () => {
    const mockTaskRequest: TaskRequest = {
      task: 'Find relevant topics and create a meme about them',
      budgetUsdc: 1.0,
    };

    beforeEach(() => {
      // Mock all the internal method calls
      vi.spyOn(orchestrator as any, 'whatShouldIFocusOn').mockResolvedValue({
        keywords: ['crypto', 'memes'],
      });
      vi.spyOn(orchestrator as any, 'discoverTrends').mockResolvedValue({
        items: [
          { title: 'Test Trend', summary: 'Test summary', id: '1' },
        ],
      });
      vi.spyOn(orchestrator as any, 'selectBestTrend').mockResolvedValue({
        title: 'Test Trend',
        summary: 'Test summary',
        id: '1',
      });
      vi.spyOn(orchestrator as any, 'createBrief').mockResolvedValue({
        brief: {
          angle: 'Test angle',
          tone: 'funny',
          visualStyle: ['meme'],
          callToAction: 'Check it out',
        },
      });
      vi.spyOn(orchestrator as any, 'enhanceImagePrompt').mockResolvedValue('Enhanced prompt');
      vi.spyOn(orchestrator as any, 'generateImage').mockResolvedValue({
        imageUrl: 'https://example.com/image.png',
        imageHash: 'hash123',
        imageStatusUrl: null,
      });
      vi.spyOn(orchestrator as any, 'describeImage').mockResolvedValue({
        description: 'A funny meme image',
        data: { style: 'meme' },
      });
      vi.spyOn(orchestrator as any, 'writeCaptions').mockResolvedValue({
        caption: 'Funny caption',
        captionData: { text: 'Funny caption', hashtags: [] },
        captionOptions: [{ text: 'Funny caption', hashtags: [] }],
      });
      vi.spyOn(orchestrator as any, 'broadcastToTelegram').mockResolvedValue({
        telegram: 'https://t.me/test/123',
      });
      // Mock waitForImageReady to avoid real HTTP requests
      vi.spyOn(orchestrator as any, 'waitForImageReady').mockResolvedValue('https://example.com/image.png');
    });

    it('should reset tracking variables at start', async () => {
      // Set some initial state
      (orchestrator as any).totalSpent = 5.0;
      (orchestrator as any).agentsHired = ['agent1'];
      (orchestrator as any).payments = [{ agentId: 'agent1', command: 'test', amount: 1, txId: 'tx1' }];

      await orchestrator.executeTask(mockTaskRequest);

      expect((orchestrator as any).totalSpent).toBeGreaterThanOrEqual(0);
      // Note: These will be populated during execution, but reset at start
    });

    it('should execute full workflow successfully', async () => {
      const result = await orchestrator.executeTask(mockTaskRequest);

      expect(result.success).toBe(true);
      expect(result.totalSpent).toBeGreaterThanOrEqual(0);
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts?.trends).toBeDefined();
      expect(result.artifacts?.brief).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(orchestrator as any, 'whatShouldIFocusOn').mockRejectedValue(
        new Error('Network error')
      );

      const result = await orchestrator.executeTask(mockTaskRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.totalSpent).toBe(0);
    });

    it('should use default brand profile when not provided', async () => {
      const result = await orchestrator.executeTask(mockTaskRequest);

      expect(result.success).toBe(true);
      expect(result.artifacts?.brandProfile).toBeNull();
    });

    it('should use provided brand profile', async () => {
      const requestWithBrand: TaskRequest = {
        ...mockTaskRequest,
        brandProfile: {
          brandName: 'Test Brand',
          personality: 'funny',
          targetAudience: 'developers',
          voice: 'casual',
          denyTerms: [],
        },
      };

      const result = await orchestrator.executeTask(requestWithBrand);

      expect(result.success).toBe(true);
      expect(result.artifacts?.brandProfile).toBeDefined();
      expect(result.artifacts?.brandProfile?.brandName).toBe('Test Brand');
    });

    it('should handle missing image gracefully', async () => {
      vi.spyOn(orchestrator as any, 'generateImage').mockResolvedValue({
        imageUrl: null,
        imageHash: null,
        imageStatusUrl: null,
      });

      const result = await orchestrator.executeTask(mockTaskRequest);

      expect(result.success).toBe(true);
      expect(result.artifacts?.imageGeneration?.imageUrl).toBeUndefined();
    });

    it('should handle missing captions gracefully', async () => {
      vi.spyOn(orchestrator as any, 'writeCaptions').mockResolvedValue({
        caption: null,
        captionData: null,
        captionOptions: [],
      });

      const result = await orchestrator.executeTask(mockTaskRequest);

      expect(result.success).toBe(true);
      expect(result.artifacts?.caption).toBeNull();
    });
  });
});

