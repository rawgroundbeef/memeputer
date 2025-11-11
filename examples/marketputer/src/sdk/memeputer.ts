import { AgentsApiClient, InteractionResult } from 'memeputer/dist/lib/api.js';
import { Connection, Keypair } from '@solana/web3.js';
import {
  BrandProfile,
  TrendItem,
  Brief,
  ImagePrompt,
  Caption,
  SafetyCheck,
  X402Receipt,
  Campaign,
} from '../types';

export interface MemeputerClientConfig {
  apiBase: string;
  wallet: Keypair;
  connection: Connection;
  mockMode?: boolean;
}

export interface GetTrendsRequest {
  sources: ('DEXSCREENER' | 'BIRDEYE' | 'RSS' | 'X')[];
  rssFeeds?: string[];
  timeframeMinutes?: number;
  maxItems?: number;
  includeHashtags?: boolean;
  filter?: {
    include?: string[];
    exclude?: string[];
  };
}

export interface GetTrendsResponse {
  items: TrendItem[];
  x402Receipt: X402Receipt;
}

export interface SummarizeTopicRequest {
  title: string;
  content: string;
  url?: string | null;
}

export interface SummarizeTopicResponse {
  summary: string;
  entities: string[];
  riskFlags: ('IP' | 'NSFW' | 'FINANCIAL' | 'POLITICAL')[];
  x402Receipt: X402Receipt;
}

export interface GenerateBriefRequest {
  brandProfile?: BrandProfile; // Optional if brandAgentId provided
  brandAgentId?: string; // Optional: use this brand agent's personality
  trendItem: TrendItem;
  policy: {
    denyTerms: string[];
    requireDisclaimer: boolean;
  };
}

export interface GenerateBriefResponse {
  brief: Brief;
  x402Receipt: X402Receipt;
}

export interface GeneratePfpPromptRequest {
  brandProfile?: BrandProfile; // Optional if brandAgentId provided
  brandAgentId?: string; // Optional: use this brand agent's personality
  brief: Brief;
  imageConstraints?: {
    aspectRatio?: string;
    elements?: string[];
  };
}

export interface GeneratePfpPromptResponse {
  prompt: string;
  negativePrompt: string;
  seed: number | null;
  guidance: number;
  x402Receipt: X402Receipt;
}

export interface GenerateCaptionsRequest {
  brandProfile?: BrandProfile; // Optional if brandAgentId provided
  brandAgentId?: string; // Optional: use this brand agent's personality
  trendItem: TrendItem;
  brief: Brief;
  numVariants?: number;
  includeHashtags?: boolean;
  includeDisclaimer?: boolean;
}

export interface GenerateCaptionsResponse {
  captions: Caption[];
  x402Receipt: X402Receipt;
}

export interface CreateMemeImageRequest {
  prompt: string;
  negativePrompt: string;
  seed?: number | null;
  aspectRatio?: string;
  referenceImageUrls?: string[]; // Reference images for PFPputer style
}

export interface CreateMemeImageResponse {
  imageUrl: string;
  imageHash: string;
  x402Receipt: X402Receipt;
}

export interface SafetyCheckRequest {
  brandProfile: BrandProfile;
  caption: string;
  imageHash?: string | null;
  trendTitle: string;
}

export interface SafetyCheckResponse {
  pass: boolean;
  issues: ('NSFW' | 'IP' | 'FINANCIAL' | 'BRAND_CONFLICT')[];
  redactions: string[];
  x402Receipt: X402Receipt;
}

export interface PostTelegramRequest {
  botToken: string;
  chatId: string;
  caption: string;
  imageUrl: string;
}

export interface PostTelegramResponse {
  messageLink: string;
  x402Receipt: X402Receipt;
}

export interface PostFarcasterRequest {
  neynarApiKey: string;
  fid: number;
  caption: string;
  imageUrl: string;
}

export interface PostFarcasterResponse {
  castUrl: string;
  castHash: string;
  x402Receipt: X402Receipt;
}

export interface MintReceiptNftRequest {
  rpcUrl: string;
  payerSecret: string;
  campaign: Campaign;
}

export interface MintReceiptNftResponse {
  mint: string;
  explorerUrl: string;
  x402Receipt: X402Receipt;
}

export class MemeputerClient {
  private apiClient: AgentsApiClient;
  private wallet: Keypair;
  private connection: Connection;
  private mockMode: boolean;

  constructor(config: MemeputerClientConfig) {
    this.apiClient = new AgentsApiClient(config.apiBase);
    this.wallet = config.wallet;
    this.connection = config.connection;
    this.mockMode = config.mockMode || false;
  }

  private async callAgent(
    agentId: string,
    command: string,
    payload: any
  ): Promise<InteractionResult> {
    if (this.mockMode) {
      throw new Error('Mock mode not yet implemented for agent calls');
    }

    const message = JSON.stringify({
      command,
      ...payload,
    });

    const apiUrl = (this.apiClient as any).baseUrl || 'unknown';
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔗 Calling agent: ${agentId}`);
    console.log(`📝 Command: ${command}`);
    console.log(`🌐 Agent API Base URL: ${apiUrl}`);
    console.log(`🌐 Full Endpoint: ${apiUrl}/x402/interact`);
    console.log(`💰 Wallet: ${this.wallet.publicKey.toString().slice(0, 8)}...`);
    console.log(`📤 Payload: ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      console.log(`⏳ Making request to agent-api...`);
      
      // Log payment info for debugging
      if (agentId === 'pfpputer') {
        console.log(`💸 PFPputer command - expected price: $0.1 USDC`);
        console.log(`💸 SDK will read maxAmountRequired from 402 response and create payment`);
      }
      
      const result = await this.apiClient.interact(
        agentId,
        message,
        this.wallet,
        this.connection
      );
      console.log(`✅ Got response from agent-api`);

      console.log(`✅ Response received`);
      console.log(`📥 Format: ${result.format}`);
      console.log(`📥 Response length: ${result.response.length} chars`);
      if (result.transactionSignature) {
        console.log(`💸 Transaction: ${result.transactionSignature}`);
      }
      if (result.imageUrl) {
        console.log(`🖼️  Image URL: ${result.imageUrl}`);
      }

      return result;
    } catch (error: any) {
      // Enhanced error logging
      if (error.response) {
        console.error(`❌ API Error Status: ${error.response.status}`);
        console.error(`❌ API Error Data:`, JSON.stringify(error.response.data, null, 2));
        
        // If it's a 402, log payment details
        if (error.response.status === 402) {
          const paymentReq = error.response.data;
          if (paymentReq.accepts?.[0]) {
            const accept = paymentReq.accepts[0];
            console.error(`\n💸 Payment Requirements:`);
            console.error(`   maxAmountRequired: ${accept.maxAmountRequired}`);
            console.error(`   payTo: ${accept.payTo}`);
            console.error(`   scheme: ${accept.scheme}`);
            console.error(`   network: ${accept.network}`);
            if (accept.extra?.feePayer) {
              console.error(`   feePayer: ${accept.extra.feePayer}`);
            }
          }
        }
      }
      if (error.message) {
        console.error(`❌ Error Message: ${error.message}`);
      }
      
      // Log full error for debugging payment issues
      if (agentId === 'pfpputer' && error.message?.includes('Payment')) {
        console.error(`\n🔍 Payment Debug Info:`);
        console.error(`   This is likely the PayAI Facilitator amount mismatch issue.`);
        console.error(`   Check agent-api logs for: "invalid_exact_svm_payload_transaction_amount_mismatch"`);
        console.error(`   The SDK reads maxAmountRequired correctly, but PayAI rejects the transaction.`);
      }
      
      throw error;
    }
  }

  private parseReceipt(result: InteractionResult): X402Receipt {
    // Extract receipt from transaction signature
    return {
      lamports: 0, // Will be extracted from transaction if available
      txId: result.transactionSignature || 'mock-tx',
      payer: this.wallet.publicKey.toString(),
      merchant: 'agent',
    };
  }

  private async pollImageStatus(statusUrl: string, maxAttempts: number = 120, delayMs: number = 1000): Promise<{ imageUrl: string; imageHash: string }> {
    const axios = (await import('axios')).default;
    
    console.log(`   ⏳ Waiting for image generation...`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(statusUrl, {
          timeout: 5000,
        });
        
        // Handle nested data structure (response.data.data vs response.data)
        const responseData = response.data;
        const data = responseData.data || responseData;
        
        const status = data.status;
        const imageUrl = data.imageUrl || data.image_url;
        
        // Check if image is ready
        if (status === 'completed' || status === 'done' || imageUrl) {
          console.log(`   ✅ Image ready!`);
          return {
            imageUrl: imageUrl || '',
            imageHash: data.imageHash || data.image_hash || '',
          };
        }
        
        // Check if failed
        if (status === 'failed' || status === 'error') {
          throw new Error(`Image generation failed: ${data.error || data.message || 'Unknown error'}`);
        }
        
        // Still processing - only log every 15 seconds
        if (status === 'processing' || status === 'pending' || status === 'in_progress') {
          const elapsedSeconds = Math.floor(attempt * delayMs / 1000);
          if (elapsedSeconds > 0 && elapsedSeconds % 15 === 0) {
            const progress = data.progress ? ` (${data.progress}%)` : '';
            console.log(`   ⏳ Still processing...${progress}`);
          }
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        // If status is unknown but imageUrl is present, use it
        if (imageUrl) {
          console.log(`   ✅ Image ready!`);
          return {
            imageUrl: imageUrl,
            imageHash: data.imageHash || data.image_hash || '',
          };
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Status endpoint not found, might be a different format
          console.log(`   ⚠️  Status endpoint not found, stopping`);
          break;
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          // Connection issues, only log occasionally
          const elapsedSeconds = Math.floor(attempt * delayMs / 1000);
          if (elapsedSeconds > 0 && elapsedSeconds % 30 === 0) {
            console.log(`   ⚠️  Connection issue, retrying...`);
          }
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        if (attempt === maxAttempts) {
          throw new Error(`Failed to poll image status after ${maxAttempts} attempts: ${error.message}`);
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    throw new Error(`Image generation timed out after ${maxAttempts} attempts (${Math.floor(maxAttempts * delayMs / 1000)} seconds)`);
  }

  async getTrends(request: GetTrendsRequest): Promise<GetTrendsResponse> {
    if (this.mockMode) {
      return this.mockGetTrends();
    }

    const result = await this.callAgent('trendputer', 'get_trends', request);
    
    try {
      // Try to parse as JSON first
      let response: any;
      try {
        response = JSON.parse(result.response);
      } catch (parseError) {
        // If not JSON, TrendPuter might be returning text
        // Log the issue and throw a helpful error
        console.error('⚠️  TrendPuter returned text instead of JSON:');
        console.error(result.response);
        throw new Error(
          'TrendPuter returned text response instead of JSON. ' +
          'The agent should return JSON in format: { "items": [...], "x402Receipt": {...} }. ' +
          'Please update TrendPuter to return structured JSON.'
        );
      }

      // Validate response structure
      if (!response.items || !Array.isArray(response.items)) {
        console.warn('⚠️  Response missing items array, attempting to extract from text...');
        // Could try to parse text response here if needed
        throw new Error('Response missing items array. Expected: { "items": TrendItem[] }');
      }

      console.log(`📊 Parsed ${response.items.length} trend items`);
      
      return {
        items: response.items,
        x402Receipt: this.parseReceipt(result),
      };
    } catch (error) {
      console.error('❌ Failed to parse response:', result.response);
      throw error instanceof Error ? error : new Error(`Invalid response from trendputer: ${String(error)}`);
    }
  }

  async summarizeTopic(
    request: SummarizeTopicRequest
  ): Promise<SummarizeTopicResponse> {
    if (this.mockMode) {
      return this.mockSummarizeTopic();
    }

    const result = await this.callAgent('trendputer', 'summarize_topic', request);
    
    try {
      // Try to parse as JSON first
      let response: any;
      try {
        response = JSON.parse(result.response);
      } catch (parseError) {
        // If not JSON, log the raw response for debugging
        console.error('⚠️  summarize_topic returned text instead of JSON:');
        console.error(result.response);
        throw new Error(
          'summarize_topic returned text response instead of JSON. ' +
          'Expected format: { "summary": "...", "entities": [...], "riskFlags": [...] }'
        );
      }

      // Log parsed response structure for debugging
      console.log(`📝 Parsed response keys: ${Object.keys(response).join(', ')}`);
      
      // Handle nested data structure (response.data.summary vs response.summary)
      const data = response.data || response;
      
      console.log(`📝 Summary: ${data.summary?.substring(0, 100) || 'undefined'}...`);
      console.log(`🏷️  Entities: ${data.entities?.length || 0}`);
      console.log(`⚠️  Risk flags: ${data.riskFlags?.length || 0}`);
      
      // Validate required fields
      if (!data.summary) {
        console.warn('⚠️  Response missing summary field');
        console.warn(`   Available keys: ${Object.keys(data).join(', ')}`);
      }
      
      return {
        summary: data.summary || '',
        entities: data.entities || [],
        riskFlags: data.riskFlags || [],
        x402Receipt: this.parseReceipt(result),
      };
    } catch (error) {
      console.error('❌ Failed to parse response:', result.response);
      throw error instanceof Error ? error : new Error(`Invalid response from trendputer: ${String(error)}`);
    }
  }

  async generateBrief(
    request: GenerateBriefRequest
  ): Promise<GenerateBriefResponse> {
    if (this.mockMode) {
      return this.mockGenerateBrief();
    }

    const result = await this.callAgent('briefputer', 'generate_brief', request);
    
    try {
      // Try to parse as JSON first
      let response: any;
      try {
        response = JSON.parse(result.response);
      } catch (parseError) {
        console.error('⚠️  generate_brief returned text instead of JSON:');
        console.error(result.response);
        throw new Error(
          'generate_brief returned text response instead of JSON. ' +
          'Expected format: { "brief": {...} }'
        );
      }

      // Handle nested data structure (response.data.brief vs response.brief)
      const data = response.data || response;
      
      console.log(`📝 Parsed brief keys: ${Object.keys(data).join(', ')}`);
      
      // Validate required fields
      if (!data.brief) {
        console.warn('⚠️  Response missing brief field');
        console.warn(`   Available keys: ${Object.keys(data).join(', ')}`);
        throw new Error('Response missing brief field. Expected: { "brief": Brief }');
      }
      
      return {
        brief: data.brief,
        x402Receipt: this.parseReceipt(result),
      };
    } catch (error) {
      console.error('❌ Failed to parse response:', result.response);
      throw error instanceof Error ? error : new Error(`Invalid response from briefputer: ${String(error)}`);
    }
  }

  async generatePfpPrompt(
    request: GeneratePfpPromptRequest
  ): Promise<GeneratePfpPromptResponse> {
    if (this.mockMode) {
      return this.mockGeneratePfpPrompt();
    }

    const result = await this.callAgent(
      'briefputer',
      'generate_pfp_prompt',
      request
    );
    
    try {
      // Try to parse as JSON first
      let response: any;
      try {
        response = JSON.parse(result.response);
      } catch (parseError) {
        console.error('⚠️  generate_pfp_prompt returned text instead of JSON:');
        console.error(result.response);
        throw new Error(
          'generate_pfp_prompt returned text response instead of JSON. ' +
          'Expected format: { "prompt": "...", "negativePrompt": "...", "seed": 42, "guidance": 7.5 }'
        );
      }

      // Handle nested data structure (response.data vs response)
      const data = response.data || response;
      
      console.log(`🎨 Parsed prompt keys: ${Object.keys(data).join(', ')}`);
      
      // Validate required fields
      if (!data.prompt || !data.negativePrompt) {
        console.warn('⚠️  Response missing prompt or negativePrompt field');
        console.warn(`   Available keys: ${Object.keys(data).join(', ')}`);
        throw new Error('Response missing prompt or negativePrompt field');
      }
      
      return {
        prompt: data.prompt,
        negativePrompt: data.negativePrompt,
        seed: data.seed || null,
        guidance: data.guidance || 7.5,
        x402Receipt: this.parseReceipt(result),
      };
    } catch (error) {
      console.error('❌ Failed to parse response:', result.response);
      throw error instanceof Error ? error : new Error(`Invalid response from briefputer: ${String(error)}`);
    }
  }

  async generateCaptions(
    request: GenerateCaptionsRequest
  ): Promise<GenerateCaptionsResponse> {
    if (this.mockMode) {
      return this.mockGenerateCaptions();
    }

    const result = await this.callAgent(
      'briefputer',
      'generate_captions',
      request
    );
    
    try {
      // Try to parse as JSON first
      let response: any;
      try {
        response = JSON.parse(result.response);
      } catch (parseError) {
        console.error('⚠️  generate_captions returned text instead of JSON:');
        console.error(result.response);
        throw new Error(
          'generate_captions returned text response instead of JSON. ' +
          'Expected format: { "captions": [...] }'
        );
      }

      // Handle nested data structure (response.data.captions vs response.captions)
      const data = response.data || response;
      
      console.log(`✍️  Parsed captions keys: ${Object.keys(data).join(', ')}`);
      
      // Validate required fields
      if (!data.captions || !Array.isArray(data.captions)) {
        console.warn('⚠️  Response missing captions array');
        console.warn(`   Available keys: ${Object.keys(data).join(', ')}`);
        throw new Error('Response missing captions array. Expected: { "captions": Caption[] }');
      }
      
      console.log(`✍️  Generated ${data.captions.length} caption variants`);
      
      return {
        captions: data.captions || [],
        x402Receipt: this.parseReceipt(result),
      };
    } catch (error) {
      console.error('❌ Failed to parse response:', result.response);
      throw error instanceof Error ? error : new Error(`Invalid response from briefputer: ${String(error)}`);
    }
  }

  async createMemeImage(
    request: CreateMemeImageRequest
  ): Promise<CreateMemeImageResponse> {
    if (this.mockMode) {
      return this.mockCreateMemeImage();
    }

    // PFPputer uses Telegram-style command format: /pfp generate [prompt] --ref-images [url1] [url2] ...
    let pfpCommand = `/pfp generate ${request.prompt}`;
    
    if (request.referenceImageUrls && request.referenceImageUrls.length > 0) {
      pfpCommand += ` --ref-images ${request.referenceImageUrls.join(' ')}`;
    }
    
    // Pass as message string (not JSON) for PFPputer
    const result = await this.callAgent('pfpputer', 'pfp', {
      message: pfpCommand,
    });
    
    // PFPputer returns image URL and hash in response
    // Handle both JSON response and direct imageUrl in result
    let imageUrl = '';
    let imageHash = '';
    
    console.log(`🖼️  PFPputer response format: ${result.format}`);
    console.log(`🖼️  PFPputer response length: ${result.response.length} chars`);
    console.log(`🖼️  PFPputer response preview: ${result.response.substring(0, 200)}`);
    
    // Check for direct imageUrl in result (from API response) - immediate return
    if (result.imageUrl) {
      console.log(`✅ Found imageUrl in result: ${result.imageUrl}`);
      imageUrl = result.imageUrl;
    }
    
    // Try to parse response as JSON
    try {
      const response = JSON.parse(result.response);
      console.log(`📦 Parsed JSON response keys: ${Object.keys(response).join(', ')}`);
      imageUrl = imageUrl || response.imageUrl || response.image_url || '';
      imageHash = imageHash || response.imageHash || response.image_hash || '';
    } catch (parseError) {
      // If not JSON, might be direct URL or other format
      console.log(`📝 Response is not JSON, treating as text`);
      // Check if response itself is a URL
      if (result.response.startsWith('http')) {
        imageUrl = result.response.trim();
      }
    }
    
    // Use imageUrl from result if available (some agents return it directly)
    imageUrl = imageUrl || result.imageUrl || result.mediaUrl || '';
    
    // If no imageUrl but statusUrl is present, poll for completion
    if (!imageUrl && result.statusUrl) {
      console.log(`⏳ Image generation in progress, polling statusUrl: ${result.statusUrl}`);
      const statusResult = await this.pollImageStatus(result.statusUrl);
      imageUrl = statusResult.imageUrl || '';
      imageHash = statusResult.imageHash || '';
    }
    
    return {
      imageUrl,
      imageHash,
      x402Receipt: this.parseReceipt(result),
    };
  }

  async safetyCheck(
    request: SafetyCheckRequest
  ): Promise<SafetyCheckResponse> {
    if (this.mockMode) {
      return this.mockSafetyCheck();
    }

    const result = await this.callAgent('guardputer', 'safety_check', request);
    const response = JSON.parse(result.response);
    return {
      pass: response.pass !== false,
      issues: response.issues || [],
      redactions: response.redactions || [],
      x402Receipt: this.parseReceipt(result),
    };
  }

  async postTelegram(
    request: PostTelegramRequest
  ): Promise<PostTelegramResponse> {
    if (this.mockMode) {
      return this.mockPostTelegram();
    }

    const result = await this.callAgent(
      'broadcastputer',
      'post_telegram',
      request
    );
    const response = JSON.parse(result.response);
    return {
      messageLink: response.messageLink || '',
      x402Receipt: this.parseReceipt(result),
    };
  }

  async postFarcaster(
    request: PostFarcasterRequest
  ): Promise<PostFarcasterResponse> {
    if (this.mockMode) {
      return this.mockPostFarcaster();
    }

    const result = await this.callAgent(
      'broadcastputer',
      'post_farcaster',
      request
    );
    const response = JSON.parse(result.response);
    return {
      castUrl: response.castUrl || '',
      castHash: response.castHash || '',
      x402Receipt: this.parseReceipt(result),
    };
  }

  async mintReceiptNft(
    request: MintReceiptNftRequest
  ): Promise<MintReceiptNftResponse> {
    if (this.mockMode) {
      return this.mockMintReceiptNft();
    }

    const result = await this.callAgent(
      'receiptputer',
      'mint_receipt_nft',
      request
    );
    const response = JSON.parse(result.response);
    return {
      mint: response.mint || '',
      explorerUrl: response.explorerUrl || '',
      x402Receipt: this.parseReceipt(result),
    };
  }

  // Mock implementations for development/testing
  private mockGetTrends(): GetTrendsResponse {
    return {
      items: [
        {
          id: 'mock-1',
          title: 'Solana Memecoin Surge',
          summary: 'Solana-based memecoins are seeing increased activity',
          source: 'DEXSCREENER',
          canonicalUrl: null,
          score: 0.85,
          hashtags: ['#solana', '#memecoin', '#crypto'],
        },
      ],
      x402Receipt: {
        lamports: 1000,
        txId: 'mock-tx-trends',
        payer: 'mock-payer',
        merchant: 'trendputer',
      },
    };
  }

  private mockSummarizeTopic(): SummarizeTopicResponse {
    return {
      summary: 'Mock summary',
      entities: ['Solana', 'Memecoin'],
      riskFlags: [],
      x402Receipt: {
        lamports: 500,
        txId: 'mock-tx-summarize',
        payer: 'mock-payer',
        merchant: 'trendputer',
      },
    };
  }

  private mockGenerateBrief(): GenerateBriefResponse {
    return {
      brief: {
        angle: 'Mock angle',
        tone: 'playful',
        visualStyle: ['vibrant', 'meme-style'],
        callToAction: 'Join the movement',
        negativeConstraints: [],
      },
      x402Receipt: {
        lamports: 2000,
        txId: 'mock-tx-brief',
        payer: 'mock-payer',
        merchant: 'briefputer',
      },
    };
  }

  private mockGeneratePfpPrompt(): GeneratePfpPromptResponse {
    return {
      prompt: 'A vibrant meme-style PFP',
      negativePrompt: 'blurry, low quality',
      seed: null,
      guidance: 7.5,
      x402Receipt: {
        lamports: 1500,
        txId: 'mock-tx-prompt',
        payer: 'mock-payer',
        merchant: 'briefputer',
      },
    };
  }

  private mockGenerateCaptions(): GenerateCaptionsResponse {
    return {
      captions: [
        {
          text: 'Mock caption text',
          hashtags: ['#solana', '#memecoin'],
          disclaimer: null,
          length: 'MEDIUM',
        },
      ],
      x402Receipt: {
        lamports: 1500,
        txId: 'mock-tx-captions',
        payer: 'mock-payer',
        merchant: 'briefputer',
      },
    };
  }

  private mockCreateMemeImage(): CreateMemeImageResponse {
    return {
      imageUrl: 'https://via.placeholder.com/512',
      imageHash: 'mock-image-hash',
      x402Receipt: {
        lamports: 5000,
        txId: 'mock-tx-image',
        payer: 'mock-payer',
        merchant: 'pfpputer',
      },
    };
  }

  private mockSafetyCheck(): SafetyCheckResponse {
    return {
      pass: true,
      issues: [],
      redactions: [],
      x402Receipt: {
        lamports: 1000,
        txId: 'mock-tx-safety',
        payer: 'mock-payer',
        merchant: 'guardputer',
      },
    };
  }

  private mockPostTelegram(): PostTelegramResponse {
    return {
      messageLink: 'https://t.me/mock/123',
      x402Receipt: {
        lamports: 500,
        txId: 'mock-tx-telegram',
        payer: 'mock-payer',
        merchant: 'broadcastputer',
      },
    };
  }

  private mockPostFarcaster(): PostFarcasterResponse {
    return {
      castUrl: 'https://warpcast.com/mock/0x123',
      castHash: '0x123',
      x402Receipt: {
        lamports: 500,
        txId: 'mock-tx-farcaster',
        payer: 'mock-payer',
        merchant: 'broadcastputer',
      },
    };
  }

  private mockMintReceiptNft(): MintReceiptNftResponse {
    return {
      mint: 'mock-mint-address',
      explorerUrl: 'https://explorer.solana.com/address/mock-mint',
      x402Receipt: {
        lamports: 10000,
        txId: 'mock-tx-nft',
        payer: 'mock-payer',
        merchant: 'receiptputer',
      },
    };
  }
}
