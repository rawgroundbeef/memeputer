/**
 * Orchestrator Agent - An Autonomous Agent-to-Agent Economy Demo
 * 
 * This agent demonstrates agent-to-agent economy:
 * - Receives a wallet with USDC balance
 * - Makes autonomous decisions about which agents to hire
 * - Pays other agents from the provided wallet
 * - Tracks spending and manages budget
 * 
 * Current implementation: Simple keyword-based decision making
 * Future enhancement: Could use LLM reasoning for more sophisticated planning
 */
import { Connection, Keypair } from '@solana/web3.js';
import { AgentsApiClient, InteractionResult } from 'memeputer/dist/lib/api.js';
import { BrandProfile } from './types';

export interface OrchestratorAgentConfig {
  wallet: Keypair;
  connection: Connection;
  apiBase: string;
}

export interface TaskRequest {
  task: string;
  budgetUsdc: number;
  brandProfile?: BrandProfile; // Optional brand profile for voice/style
}

export interface TaskResult {
  success: boolean;
  totalSpent: number;
  agentsHired: string[];
  payments: Array<{
    agentId: string;
    command: string;
    amount: number;
    txId: string;
  }>;
  result?: string;
  artifacts?: {
    // Trend information
    trends?: {
      items: Array<{
        id?: string;
        title?: string;
        summary?: string;
        source?: string;
        score?: number;
        hashtags?: string[];
        canonicalUrl?: string | null;
      }>;
      selectedTrend?: {
        id?: string;
        title?: string;
        summary?: string;
        source?: string;
        score?: number;
        hashtags?: string[];
        canonicalUrl?: string | null;
      };
    } | null;
    // Brief information
    brief?: {
      angle?: string;
      tone?: string;
      visualStyle?: string[];
      callToAction?: string;
      negativeConstraints?: string[];
    } | null;
    // Image generation details
    imageGeneration?: {
      prompt?: string;
      imageUrl?: string | null;
      imageHash?: string | null;
      statusUrl?: string | null;
      seed?: number | null;
      guidance?: number | null;
    } | null;
    // Caption information
    caption?: {
      text?: string;
      hashtags?: string[];
      disclaimer?: string | null;
      length?: string;
    } | null;
    // Social media posts
    postedLinks?: {
      telegram?: string;
      farcaster?: string;
    } | null;
    // Brand information used
    brandProfile?: BrandProfile | null;
  };
  error?: string;
}

/**
 * OrchestratorAgent - An agent that pays other agents to complete tasks
 * 
 * This demonstrates a true agent-to-agent economy where:
 * - The orchestrator agent has its own wallet with USDC
 * - It autonomously decides which agents to hire
 * - It pays those agents from its own wallet
 * - Those agents may pay other agents (creating a network)
 */
export class OrchestratorAgent {
  private apiClient: AgentsApiClient;
  private wallet: Keypair;
  private connection: Connection;
  private totalSpent: number = 0;
  private agentsHired: string[] = [];
  private payments: Array<{ agentId: string; command: string; amount: number; txId: string }> = [];

  constructor(config: OrchestratorAgentConfig) {
    this.apiClient = new AgentsApiClient(config.apiBase);
    this.wallet = config.wallet;
    this.connection = config.connection;
  }

  /**
   * Execute a task by hiring and paying other agents
   */
  async executeTask(request: TaskRequest): Promise<TaskResult> {
    this.totalSpent = 0;
    this.agentsHired = [];
    this.payments = [];

    try {
      console.log(`\n🤖 Orchestrator Agent analyzing task...`);
      console.log(`   Task: "${request.task}"`);
      console.log(`   Budget: ${request.budgetUsdc} USDC`);
      console.log(`   Wallet: ${this.wallet.publicKey.toString()}`);
      console.log(`\n💭 The orchestrator will analyze the task and decide which agents to hire.\n`);

      // Step 1: Find trends (if needed)
      // TODO: Future enhancement - Use LLM to reason about whether trends are needed
      // Instead of keyword matching, could analyze: "Does this task require market data?"
      let trends: any = null;
      let imagePrompt: string | null = null;
      let imageHash: string | null = null;
      let imageStatusUrl: string | null = null;
      let captionData: any = null;
      const needsTrends = request.task.toLowerCase().includes('trend') || request.task.toLowerCase().includes('meme');
      if (needsTrends) {
        console.log('📊 Step 1: Deciding to hire TrendPuter for market trends...');
        console.log('   💭 Reasoning: Task mentions trends/memes, so I need market data');
        const trendsResult = await this.hireAgent('trendputer', 'get_trends', {
          sources: ['X'],
          maxItems: 5,
        }, 0.10); // Pay $0.10
        
        // Parse trends response
        try {
          trends = JSON.parse(trendsResult.response);
        } catch {
          trends = { items: [] };
        }
      }

      // Step 2: Create brief (if needed)
      // TODO: Future enhancement - LLM could decide: "Do I need a creative brief, or can I go straight to generation?"
      let brief: any = null;
      const needsBrief = trends || request.task.toLowerCase().includes('create') || request.task.toLowerCase().includes('meme');
      if (needsBrief) {
        console.log('📝 Step 2: Deciding to hire BriefPuter for creative strategy...');
        console.log('   💭 Reasoning: Need creative direction before generating content');
        const trendItem = trends?.items?.[0] || {
          title: request.task,
          summary: request.task,
          source: 'USER',
        };
        
        // Use brand profile if provided, otherwise use default
        const brandProfile = request.brandProfile || {
          brandName: 'Orchestrator Agent',
          personality: 'fun, crypto-native, memes',
          targetAudience: 'Solana degens',
          voice: 'casual, humorous',
          denyTerms: [],
        };
        
        if (request.brandProfile?.brandAgentId) {
          console.log(`   🎨 Using brand agent: ${request.brandProfile.brandAgentId}`);
        } else if (request.brandProfile?.brandName) {
          console.log(`   🎨 Using brand: ${request.brandProfile.brandName}`);
        }
        
        const briefResult = await this.hireAgent('briefputer', 'generate_brief', {
          brandAgentId: brandProfile.brandAgentId, // Use brandAgentId if provided
          brandProfile: brandProfile.brandAgentId ? undefined : brandProfile, // Only pass brandProfile if not using brandAgentId
          trendItem,
          policy: {
            denyTerms: brandProfile.denyTerms || [],
            requireDisclaimer: false,
          },
        }, 0.20); // Pay $0.20
        
        // Parse brief response
        try {
          const parsed = JSON.parse(briefResult.response);
          brief = parsed.data || parsed;
        } catch {
          brief = { brief: null };
        }
      }

      // Step 3: Generate image (if needed)
      // TODO: Future enhancement - LLM could decide: "Should I use PFPputer or another image agent?"
      // Could also negotiate price: "PFPputer costs $0.50, but ImageGen costs $0.30..."
      let imageUrl: string | null = null;
      const needsImage = brief || request.task.toLowerCase().includes('image') || request.task.toLowerCase().includes('meme');
      if (needsImage) {
        console.log('🎨 Step 3: Deciding to hire PFPputer for image generation...');
        console.log('   💭 Reasoning: Need visual content to complete the task');
        const prompt = brief?.brief?.angle || request.task;
        imagePrompt = prompt; // Store prompt for admin info
        
        // Build PFP command with reference images if brand has them
        let pfpCommand = `/pfp generate ${prompt}`;
        if (request.brandProfile?.referenceImageUrls && request.brandProfile.referenceImageUrls.length > 0) {
          pfpCommand += ` --ref-images ${request.brandProfile.referenceImageUrls.join(' ')}`;
          console.log(`   🖼️  Using ${request.brandProfile.referenceImageUrls.length} reference image(s) from brand`);
        }
        
        const imageResult = await this.hireAgent('pfpputer', 'pfp', {
          message: pfpCommand,
        }, 0.50); // Pay $0.50
        
        // Extract image URL from response
        console.log(`   📥 PFPputer response format: ${imageResult.format}`);
        console.log(`   📥 Response preview: ${imageResult.response.substring(0, 200)}...`);
        
        // Store status URL if present
        if (imageResult.statusUrl) {
          imageStatusUrl = imageResult.statusUrl;
        }
        
        // Check for direct imageUrl in result (from API response)
        imageUrl = imageResult.imageUrl || imageResult.mediaUrl || null;
        
        // Try parsing JSON response
        if (!imageUrl) {
          try {
            const parsed = JSON.parse(imageResult.response);
            imageUrl = parsed.imageUrl || parsed.image_url || parsed.data?.imageUrl || null;
            imageHash = parsed.imageHash || parsed.image_hash || parsed.data?.imageHash || null;
            console.log(`   ✅ Found imageUrl in JSON: ${imageUrl}`);
          } catch {
            // If not JSON, check if response itself is a URL
            if (imageResult.response.startsWith('http')) {
              imageUrl = imageResult.response.trim();
              console.log(`   ✅ Response is direct URL: ${imageUrl}`);
            }
          }
        }
        
        // Check for statusUrl (async image generation) - need to poll
        if (!imageUrl && imageResult.statusUrl) {
          console.log(`   ⏳ Image generation in progress, polling statusUrl...`);
          console.log(`   📍 Status URL: ${imageResult.statusUrl}`);
          
          // Poll for image completion
          imageUrl = await this.pollImageStatus(imageResult.statusUrl);
          
          if (imageUrl) {
            console.log(`   ✅ Image ready: ${imageUrl}`);
          } else {
            console.log(`   ⚠️  Image generation timed out or failed`);
          }
        }
        
        if (imageUrl) {
          console.log(`   🖼️  Image generated: ${imageUrl}`);
        } else {
          console.log(`   ⚠️  No image URL found in response`);
        }
      }

      // Step 4: Generate caption (if needed)
      // TODO: Future enhancement - LLM could decide: "Do I need a caption, or is the image self-explanatory?"
      let caption: string | null = null;
      if (brief) {
        console.log('✍️  Step 4: Deciding to hire BriefPuter for caption generation...');
        console.log('   💭 Reasoning: Have brief, so I should create matching caption');
        const trendItem = trends?.items?.[0] || {
          title: request.task,
          summary: request.task,
          source: 'USER',
        };
        
        // Use same brand profile as brief
        const brandProfile = request.brandProfile || {
          brandName: 'Orchestrator Agent',
          personality: 'fun, crypto-native, memes',
          targetAudience: 'Solana degens',
          voice: 'casual, humorous',
          denyTerms: [],
        };
        
        const captionResult = await this.hireAgent('briefputer', 'generate_captions', {
          brandAgentId: brandProfile.brandAgentId, // Use brandAgentId if provided
          brandProfile: brandProfile.brandAgentId ? undefined : brandProfile, // Only pass brandProfile if not using brandAgentId
          trendItem,
          brief: brief.brief,
          numVariants: 1,
        }, 0.10); // Pay $0.10
        
        try {
          const parsed = JSON.parse(captionResult.response);
          caption = parsed.captions?.[0]?.text || null;
        } catch {
          caption = null;
        }
      }

      // Step 5: Post to social media (if image and caption are ready)
      let postedLinks: { telegram?: string; farcaster?: string } = {};
      if (imageUrl && caption) {
        // BroadcastPuter uses its own configured bot token, we just need chat ID
        // Default to Memeputer chat if not specified
        const telegramChatId = process.env.TELEGRAM_CHAT_ID || process.env.MEMEPUTER_TELEGRAM_CHAT_ID;
        
        if (telegramChatId) {
          console.log('📱 Step 5: Deciding to hire BroadcastPuter for social media posting...');
          console.log('   💭 Reasoning: Have complete content (image + caption), ready to publish');
          console.log(`   Chat ID: ${telegramChatId}`);
          console.log(`   (BroadcastPuter will use its own configured bot token)`);
          try {
            const telegramResult = await this.hireAgent('broadcastputer', 'post_telegram', {
              chatId: telegramChatId,
              caption: caption,
              imageUrl: imageUrl,
              // botToken is optional - BroadcastPuter uses its own configured token
            }, 0.10); // Pay $0.10
            
            try {
              const parsed = JSON.parse(telegramResult.response);
              postedLinks.telegram = parsed.messageLink || parsed.data?.messageLink || null;
              if (postedLinks.telegram) {
                console.log(`   ✅ Posted to Telegram: ${postedLinks.telegram}`);
              }
            } catch {
              // Response might not be JSON
              if (telegramResult.response.includes('http')) {
                postedLinks.telegram = telegramResult.response.trim();
              }
            }
          } catch (error) {
            console.log(`   ⚠️  Failed to post to Telegram: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } else {
          console.log('📱 Step 5: Skipping Telegram post (chat ID not configured)');
          console.log(`   Set TELEGRAM_CHAT_ID or MEMEPUTER_TELEGRAM_CHAT_ID in .env to enable`);
        }

        // Farcaster posting (optional)
        // BroadcastPuter can use its own configured credentials if available
        const neynarApiKey = process.env.NEYNAR_API_KEY;
        const farcasterFid = process.env.FARCASTER_FID;
        
        if (neynarApiKey && farcasterFid) {
          console.log('🔷 Step 5b: Hiring BroadcastPuter to post to Farcaster...');
          console.log(`   (BroadcastPuter will use provided credentials or its own if configured)`);
          try {
            const farcasterResult = await this.hireAgent('broadcastputer', 'post_farcaster', {
              neynarApiKey: neynarApiKey, // Optional if agent has it configured
              fid: parseInt(farcasterFid, 10),
              caption: caption,
              imageUrl: imageUrl,
            }, 0.10); // Pay $0.10
            
            try {
              const parsed = JSON.parse(farcasterResult.response);
              postedLinks.farcaster = parsed.castUrl || parsed.data?.castUrl || null;
              if (postedLinks.farcaster) {
                console.log(`   ✅ Posted to Farcaster: ${postedLinks.farcaster}`);
              }
            } catch {
              // Response might not be JSON
              if (farcasterResult.response.includes('http')) {
                postedLinks.farcaster = farcasterResult.response.trim();
              }
            }
          } catch (error) {
            console.log(`   ⚠️  Failed to post to Farcaster: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } else {
        if (!imageUrl) {
          console.log('📱 Step 5: Skipping social media post (no image generated)');
        }
        if (!caption) {
          console.log('📱 Step 5: Skipping social media post (no caption generated)');
        }
      }

      // Compile result
      const result: string[] = [];
      if (trends) {
        result.push(`Trends found: ${trends.items?.length || 0} items`);
      }
      if (brief) {
        result.push(`Brief created: ${brief.brief?.angle || 'N/A'}`);
      }
      if (imageUrl) {
        result.push(`🖼️  Image: ${imageUrl}`);
      } else {
        result.push(`⚠️  Image: Not generated or URL not found`);
      }
      if (caption) {
        result.push(`Caption: ${caption}`);
      }
      if (postedLinks.telegram) {
        result.push(`📱 Telegram: ${postedLinks.telegram}`);
      }
      if (postedLinks.farcaster) {
        result.push(`🔷 Farcaster: ${postedLinks.farcaster}`);
      }

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`✅ TASK COMPLETED`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`\n💰 Summary:`);
      console.log(`   Total spent: ${this.totalSpent.toFixed(4)} USDC`);
      console.log(`   Remaining budget: ${(request.budgetUsdc - this.totalSpent).toFixed(4)} USDC`);
      console.log(`   Agents hired: ${this.agentsHired.length}`);
      console.log(`   Payments made: ${this.payments.length}`);

      // Select the trend that was used (first one, or could be smarter)
      const selectedTrend = trends?.items?.[0] || null;
      
      return {
        success: true,
        totalSpent: this.totalSpent,
        agentsHired: [...new Set(this.agentsHired)],
        payments: this.payments.map(p => ({
          agentId: p.agentId,
          command: p.command || 'unknown',
          amount: p.amount,
          txId: p.txId,
        })),
        result: result.join('\n'),
        artifacts: {
          trends: trends ? {
            items: trends.items || [],
            selectedTrend: selectedTrend ? {
              id: selectedTrend.id,
              title: selectedTrend.title,
              summary: selectedTrend.summary,
              source: selectedTrend.source,
              score: selectedTrend.score,
              hashtags: selectedTrend.hashtags,
              canonicalUrl: selectedTrend.canonicalUrl,
            } : undefined,
          } : null,
          brief: brief?.brief ? {
            angle: brief.brief.angle,
            tone: brief.brief.tone,
            visualStyle: brief.brief.visualStyle,
            callToAction: brief.brief.callToAction,
            negativeConstraints: brief.brief.negativeConstraints,
          } : null,
          imageGeneration: imageUrl || imagePrompt ? {
            prompt: imagePrompt || undefined,
            imageUrl: imageUrl || undefined,
            imageHash: imageHash || undefined,
            statusUrl: imageStatusUrl || undefined,
            seed: undefined, // PFPputer doesn't return seed currently
            guidance: undefined, // PFPputer doesn't return guidance currently
          } : undefined,
          caption: captionData || caption ? {
            text: caption || captionData?.text || null,
            hashtags: captionData?.hashtags || [],
            disclaimer: captionData?.disclaimer || null,
            length: captionData?.length || null,
          } : null,
          postedLinks: Object.keys(postedLinks).length > 0 ? postedLinks : null,
          brandProfile: request.brandProfile || null,
        },
      };
    } catch (error) {
      console.error('\n❌ Error during task execution:');
      console.error(error instanceof Error ? error.stack : error);
      return {
        success: false,
        totalSpent: this.totalSpent,
        agentsHired: [...new Set(this.agentsHired)],
        payments: this.payments.map(p => ({
          agentId: p.agentId,
          command: p.command || 'unknown',
          amount: p.amount,
          txId: p.txId,
        })),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Hire an agent and pay them from the orchestrator's wallet.
   * 
   * This demonstrates agent-to-agent economy:
   * - The orchestrator agent pays from the provided wallet
   * - Each payment is tracked and deducted from the agent's budget
   * - Future enhancement: Could negotiate prices, compare agent costs, etc.
   */
  private async hireAgent(
    agentId: string,
    command: string,
    payload: any,
    maxBudgetUsdc: number
  ): Promise<InteractionResult> {
    console.log(`\n   💸 Paying agent...`);
    console.log(`      Agent: ${agentId}`);
    console.log(`      Command: ${command}`);
    console.log(`      Amount: ${maxBudgetUsdc} USDC`);
    console.log(`      Wallet: ${this.wallet.publicKey.toString()}`);

    const message = JSON.stringify({
      command,
      ...payload,
    });
    
    // Debug: log payload for troubleshooting
    if (process.env.DEBUG) {
      console.log(`      Payload: ${JSON.stringify(payload, null, 2)}`);
    }

    // Call the agent using x402 - the orchestrator agent pays!
    const result = await this.apiClient.interact(
      agentId,
      message,
      this.wallet, // Orchestrator's wallet pays the agent
      this.connection
    );

    // Track payment
    if (result.transactionSignature) {
      // Estimate payment amount (in real scenario, we'd parse from transaction)
      const estimatedAmount = maxBudgetUsdc;
      this.totalSpent += estimatedAmount;
      this.agentsHired.push(agentId);
      this.payments.push({
        agentId,
        command,
        amount: estimatedAmount,
        txId: result.transactionSignature,
      });

      console.log(`   ✅ Paid ${agentId}: ${estimatedAmount.toFixed(4)} USDC`);
      console.log(`      Transaction: ${result.transactionSignature}`);
    }

    return result;
  }

  /**
   * Poll image status URL until image is ready
   */
  private async pollImageStatus(statusUrl: string, maxAttempts: number = 120, delayMs: number = 1000): Promise<string | null> {
    const axios = (await import('axios')).default;
    
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
          return imageUrl || null;
        }
        
        // Check if failed
        if (status === 'failed' || status === 'error') {
          throw new Error(`Image generation failed: ${data.error || data.message || 'Unknown error'}`);
        }
        
        // Still processing - log progress every 15 seconds
        if (status === 'processing' || status === 'pending' || status === 'in_progress') {
          const elapsedSeconds = Math.floor(attempt * delayMs / 1000);
          if (elapsedSeconds > 0 && elapsedSeconds % 15 === 0) {
            const progress = data.progress ? ` (${data.progress}%)` : '';
            console.log(`   ⏳ Still processing...${progress} (${elapsedSeconds}s elapsed)`);
          }
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        // If status is unknown but imageUrl is present, use it
        if (imageUrl) {
          return imageUrl;
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
    
    return null; // Timeout
  }

  /**
   * Get current balance (for monitoring)
   */
  async getBalance(): Promise<number> {
    const { getUsdcBalance } = await import('memeputer/dist/lib/x402Client.js');
    return getUsdcBalance(this.connection, this.wallet);
  }
}

