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
import { AgentsApiClient, InteractionResult } from '@memeputer/sdk';
import { BrandProfile } from './types';
import { CleanLogger } from './logger';

// Extend InteractionResult to include x402Receipt (until package is rebuilt)
interface InteractionResultWithReceipt extends InteractionResult {
  x402Receipt?: {
    amountPaidUsdc: number;
    amountPaidMicroUsdc: number;
    payTo: string;
    transactionSignature: string;
    payer: string;
    merchant: string;
    timestamp: string;
  };
  x402Quote?: {
    amountQuotedUsdc: number;
    amountQuotedMicroUsdc: number;
    maxAmountRequired: number;
  };
}

// Helper to generate Solscan URLs
function getSolscanTxUrl(signature: string, network: 'mainnet' | 'devnet' = 'mainnet'): string {
  return `https://solscan.io/tx/${signature}`;
}

function getSolscanAccountUrl(address: string, network: 'mainnet' | 'devnet' = 'mainnet'): string {
  return `https://solscan.io/account/${address}`;
}

function detectNetwork(rpcUrl: string): 'mainnet' | 'devnet' {
  if (rpcUrl.includes('devnet')) return 'devnet';
  return 'mainnet';
}


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
    // Image description from ImageDescripterPuter
    imageDescription?: {
      description?: string;
      style?: any | null;
      composition?: any | null;
      details?: any | null;
    } | null;
    // Caption information
    caption?: {
      text?: string;
      hashtags?: string[];
      disclaimer?: string | null;
      length?: string;
    } | null;
    // Multiple caption options
    captionOptions?: Array<{
      text?: string;
      hashtags?: string[];
      disclaimer?: string | null;
      length?: string;
    }> | null;
    // Social media posts
    postedLinks?: {
      telegram?: string;
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
  private taskBudget: number = 0; // Store task budget for safety limits
  private network: 'mainnet' | 'devnet';
  private logger: CleanLogger;
  private apiBase: string;

  constructor(config: OrchestratorAgentConfig) {
    this.apiClient = new AgentsApiClient(config.apiBase);
    this.wallet = config.wallet;
    this.connection = config.connection;
    this.network = detectNetwork(config.connection.rpcEndpoint);
    this.logger = new CleanLogger();
    this.apiBase = config.apiBase; // Store apiBase for polling URLs
  }

  /**
   * Execute a task by hiring and paying other agents
   * Fixed task: Find relevant topics and create a meme about them
   */
  async executeTask(request: TaskRequest): Promise<TaskResult> {
    this.totalSpent = 0;
    this.agentsHired = [];
    this.payments = [];
    this.taskBudget = request.budgetUsdc; // Store budget for safety limits

    // Fixed task: Find relevant topics and create a meme about them
    const fixedTask = 'Find relevant topics and create a meme about them';

    try {
      this.logger.section('Orchestrator Agent', `Task: "${fixedTask}" | Budget: ${request.budgetUsdc} USDC`);

      // Step 1: Find trends (if needed)
      // The orchestrator agent makes an autonomous decision about whether trends are needed
      // and then evaluates trend quality before proceeding
      let trends: any = null;
      let selectedTrend: any = null;
      let imagePrompt: string | null = null;
      let imageHash: string | null = null;
      let imageStatusUrl: string | null = null;
      
      // Step 1: Ask AI what we should focus on (before getting trends)
      this.logger.section('Step 1: Getting focus plan', 'briefputer');
      this.logger.startLoading('Processing...');
      const focusPlan = await this.whatShouldIFocusOn(fixedTask);
      this.logger.stopLoading();
      this.logger.result('✅', `Focus plan: ${focusPlan.keywords?.length || 0} keywords identified`);
      if (focusPlan.keywords && focusPlan.keywords.length > 0) {
        this.logger.info(`Keywords: ${focusPlan.keywords.join(', ')}`);
      }
      
      // Step 2: Always get trends
      this.logger.section('Step 2: Getting trends', 'trendputer');
      
      // ADAPTIVE RETRY LOGIC: Try multiple times with different strategies if quality is poor
      let trendsAttempts = 0;
      const maxTrendAttempts = 2;
      let selectedTrendFound = false;
      
      while (!selectedTrendFound && trendsAttempts < maxTrendAttempts) {
        trendsAttempts++;
        
        if (trendsAttempts > 1) {
          this.logger.warn(`Retry attempt ${trendsAttempts}: Requesting higher quality trends`);
        }
        
        // Get trends using TrendPuter's AI Reporter investigation (with web search)
        // TrendPuter uses its reporter profile - no custom commands needed, just natural language prompts
        const keywordsContext = focusPlan.keywords && focusPlan.keywords.length > 0
          ? ` Focus on: ${focusPlan.keywords.join(', ')}.`
          : '';
        
        // Build natural language prompt for TrendPuter
        // Simple and direct - TrendPuter's profile handles the investigation
        const trendPrompt = trendsAttempts === 1
          ? `Investigate the most compelling news stories of the day.${keywordsContext} Context: ${fixedTask}. Return exactly 10 trends as JSON: {"items": [{"title": "...", "summary": "..."}]}`
          : `Investigate the top news stories with a focus on verified, credible sources.${keywordsContext} Context: ${fixedTask}. Return exactly 10 trends as JSON: {"items": [{"title": "...", "summary": "..."}]}`;
        
        // No hardcoded amount - use remaining budget as safety limit
        // Actual payment comes from 402 quote
        const trendsResult = await this.hireAgent('trendputer', trendPrompt, {});
        
        // Parse trends response
        try {
          trends = JSON.parse(trendsResult.response);
          this.logger.result('✅', `Got ${trends?.items?.length || 0} trends`);
          // Display trends in readable format
          if (trends?.items && trends.items.length > 0) {
            trends.items.forEach((trend: any, idx: number) => {
              console.log(`      ${idx + 1}. ${trend.title || 'Untitled'}`);
              if (trend.summary) {
                console.log(`         ${trend.summary.substring(0, 80)}${trend.summary.length > 80 ? '...' : ''}`);
              }
            });
          }
        } catch (parseError) {
          trends = { items: [] };
          
          // Try to extract JSON from markdown code blocks or other formats
          const jsonMatch = trendsResult.response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                           trendsResult.response.match(/(\{[\s\S]*"items"[\s\S]*\})/);
          if (jsonMatch) {
            try {
              trends = JSON.parse(jsonMatch[1]);
              this.logger.result('✅', `Extracted ${trends?.items?.length || 0} trends from markdown`);
              // Display trends
              if (trends?.items && trends.items.length > 0) {
                trends.items.forEach((trend: any, idx: number) => {
                  console.log(`      ${idx + 1}. ${trend.title || 'Untitled'}`);
                  if (trend.summary) {
                    console.log(`         ${trend.summary.substring(0, 80)}${trend.summary.length > 80 ? '...' : ''}`);
                  }
                });
              }
            } catch {
              this.logger.warn('Failed to parse trends JSON');
            }
          } else {
            this.logger.warn('No trends found in response');
          }
        }
        
        // Agent evaluates trend quality and selects the best one
        // THE WOW FACTOR: The orchestrator agent hires BriefPuter to evaluate trends using AI reasoning
        // This demonstrates true autonomy - it uses AI reasoning (via another agent) instead of just heuristics
        if (trends?.items && trends.items.length > 0) {
          this.logger.info(`Selecting best trend (agent: briefputer)`);
          this.logger.startLoading('Processing...');
          selectedTrend = await this.selectBestTrend(trends.items, fixedTask);
          this.logger.stopLoading();
          
          if (selectedTrend) {
            this.logger.result('✅', `Selected: "${selectedTrend.title}"`);
            if (selectedTrend.summary) {
              this.logger.info(`   ${selectedTrend.summary.substring(0, 100)}${selectedTrend.summary.length > 100 ? '...' : ''}`);
            }
            selectedTrendFound = true;
          } else {
            this.logger.warn('No suitable trends found in this batch');
            if (trendsAttempts < maxTrendAttempts) {
              // AI-POWERED DECISION: Ask if we should retry
              const shouldRetry = await this.shouldRetryTrends(trendsAttempts, fixedTask);
              if (shouldRetry) {
                this.logger.info('Retrying with higher quality focus');
                // Continue loop to retry
              } else {
                this.logger.info('Proceeding without trends');
                trends = { items: [] };
                selectedTrendFound = true; // Exit loop
              }
            } else {
              this.logger.warn('Exhausted retry attempts - proceeding without trend context');
              trends = { items: [] };
            }
          }
        } else {
          this.logger.warn('No trends returned');
          if (trendsAttempts < maxTrendAttempts) {
            // Continue loop to retry
          } else {
            this.logger.warn('Exhausted retry attempts - proceeding without trend context');
          }
        }
      }

      // Step 3: Generate brief
      let brief: any = null;
      const hasGoodTrend = selectedTrend !== null;
      
      this.logger.section('Step 3: Generating brief', 'briefputer');
      
      // Use selected trend if available, otherwise use first trend or fallback
      const trendItem = selectedTrend || trends?.items?.[0] || {
        title: fixedTask,
        summary: fixedTask,
        source: 'USER',
      };
      
      // Use brand profile if provided, otherwise use default
      const brandProfile = request.brandProfile || {
        brandName: 'Memeputer',
        personality: 'fun, crypto-native, memes',
        targetAudience: 'Solana degens',
        voice: 'casual, humorous',
        denyTerms: [],
      };
      
      if (brandProfile.brandAgentId) {
        this.logger.info(`Using brand agent: ${brandProfile.brandAgentId}`);
      } else if (brandProfile.brandName) {
        this.logger.info(`Using brand: ${brandProfile.brandName}`);
      }
      
      // No hardcoded amount - actual payment comes from 402 quote
      const briefPayload: any = {
        trendItem,
        policy: {
          denyTerms: brandProfile.denyTerms || [],
          requireDisclaimer: false,
        },
      };
      
      // If brandAgentId is provided, use it (backend will fetch brand profile)
      // Otherwise, pass the brandProfile object
      if (brandProfile.brandAgentId) {
        briefPayload.brandAgentId = brandProfile.brandAgentId;
        this.logger.info(`Sending brandAgentId to BriefPuter: ${brandProfile.brandAgentId}`);
      } else {
        briefPayload.brandProfile = brandProfile;
        this.logger.info(`Sending brandProfile to BriefPuter: ${brandProfile.brandName || 'Custom'}`);
      }
      
      const briefResult = await this.hireAgent('briefputer', 'generate_brief', briefPayload);
      
      // Parse brief response
      try {
        const parsed = JSON.parse(briefResult.response);
        brief = parsed.data || parsed;
        this.logger.result('✅', 'Got creative brief');
        
        // Display brief details
        if (brief?.brief) {
          if (brief.brief.angle) {
            this.logger.info(`   Angle: ${brief.brief.angle.substring(0, 120)}${brief.brief.angle.length > 120 ? '...' : ''}`);
          }
          if (brief.brief.tone) {
            this.logger.info(`   Tone: ${brief.brief.tone}`);
          }
          if (brief.brief.visualStyle && brief.brief.visualStyle.length > 0) {
            this.logger.info(`   Visual Style: ${brief.brief.visualStyle.join(', ')}`);
          }
          if (brief.brief.callToAction) {
            this.logger.info(`   CTA: ${brief.brief.callToAction.substring(0, 80)}${brief.brief.callToAction.length > 80 ? '...' : ''}`);
          }
        }
      } catch {
        brief = { brief: null };
        this.logger.warn('Failed to parse brief response');
      }

      // Step 4: Enhance prompt with PromptPuter
      let imageUrl: string | null = null;
      const hasBrief = brief?.brief?.angle !== null && brief?.brief?.angle !== undefined;
      
      this.logger.section('Step 4: Enhancing image prompt', 'promptputer');
      
      const basePrompt = brief?.brief?.angle || fixedTask;
      
      // Ask PromptPuter to enhance the prompt for high-quality image generation
      const enhancedPrompt = await this.enhanceImagePrompt(basePrompt);
      imagePrompt = enhancedPrompt; // Store enhanced prompt for admin info
      this.logger.result('✅', 'Prompt enhanced');
      
      // Step 5: Generate image with PFPputer
      this.logger.section('Step 5: Generating image', 'pfpputer');
      
      // Build PFP command with reference images if brand has them
      let pfpCommand = `/pfp generate ${enhancedPrompt}`;
      if (request.brandProfile?.referenceImageUrls && request.brandProfile.referenceImageUrls.length > 0) {
        pfpCommand += ` --ref-images ${request.brandProfile.referenceImageUrls.join(' ')}`;
        this.logger.info(`Using ${request.brandProfile.referenceImageUrls.length} reference image(s)`);
      }
      
      // No hardcoded amount - actual payment comes from 402 quote
      const imageResult = await this.hireAgent('pfpputer', 'pfp', {
        message: pfpCommand,
      });
      
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
        } catch {
          // If not JSON, check if response itself is a URL
          if (imageResult.response.startsWith('http')) {
            imageUrl = imageResult.response.trim();
          }
        }
      }
      
      // Check for statusUrl (async image generation) - need to poll
      if (!imageUrl && imageResult.statusUrl) {
        this.logger.info('Image generation in progress...');
        // Poll for image completion
        imageUrl = await this.pollImageStatus(imageResult.statusUrl);
      }
      
      if (imageUrl) {
        this.logger.result('✅', `Image generated: ${imageUrl.substring(0, 60)}...`);
      } else {
        this.logger.warn('No image URL found in response');
      }

      // Step 6: Describe image with ImageDescripterPuter (only if we have an image)
      let imageDescription: string | null = null;
      let imageDescriptionData: any = null;
      
      if (!imageUrl) {
        this.logger.warn('Skipping image description - no image was generated');
      } else {
        this.logger.section('Step 6: Describing image', 'imagedescripterputer');
        
        try {
          const descriptionResult = await this.hireAgent('imagedescripterputer', 'describe_image', {
            imageUrl: imageUrl,
            detailLevel: 'detailed',
          });
          
          // Check if this is an async job (like PFPputer)
          // statusUrl can be on the result object itself OR in the response JSON
          let statusUrl: string | null = null;
          
          // First check: statusUrl on result object (like PFPputer)
          if (descriptionResult.statusUrl) {
            statusUrl = descriptionResult.statusUrl;
          }
          
          // Second check: statusUrl in response JSON
          if (!statusUrl) {
            try {
              const parsed = JSON.parse(descriptionResult.response);
              statusUrl = parsed.statusUrl || parsed.data?.statusUrl || null;
            } catch {
              // Response might not be JSON yet
            }
          }
          
          // If we have a statusUrl, poll for completion
          if (statusUrl) {
            // Replace localhost URLs with actual API base, but preserve port if different
            // Only replace if API base is NOT localhost (production), or if ports match
            let pollingUrl = statusUrl;
            const statusUrlMatch = statusUrl.match(/http:\/\/localhost:(\d+)/);
            const apiBaseMatch = this.apiBase.match(/http:\/\/localhost:(\d+)/);
            
            if (statusUrlMatch && apiBaseMatch) {
              // Both are localhost - only replace if ports match, otherwise keep original
              if (statusUrlMatch[1] === apiBaseMatch[1]) {
                pollingUrl = statusUrl.replace(/http:\/\/localhost:\d+/, this.apiBase);
              }
              // If ports differ, keep the original URL (status endpoint might be on different port)
            } else if (!statusUrlMatch && this.apiBase.includes('localhost')) {
              // Status URL is not localhost but API base is - don't replace
              pollingUrl = statusUrl;
            } else if (statusUrlMatch && !this.apiBase.includes('localhost')) {
              // Status URL is localhost but API base is production - replace hostname only
              pollingUrl = statusUrl.replace(/http:\/\/localhost:\d+/, this.apiBase);
            }
            
            this.logger.info('Image description in progress...');
            const polledResult = await this.pollImageDescription(pollingUrl);
            
            if (polledResult) {
              // Parse the final description response
              try {
                const finalParsed = typeof polledResult === 'string' 
                  ? JSON.parse(polledResult)
                  : polledResult;
                imageDescription = finalParsed.description || finalParsed.data?.description || null;
                imageDescriptionData = finalParsed;
                
                if (imageDescription) {
                  this.logger.result('✅', 'Got image description');
                  const preview = imageDescription.substring(0, 120);
                  this.logger.info(`   ${preview}${imageDescription.length > 120 ? '...' : ''}`);
                }
              } catch {
                // If it's already a string description, use it
                imageDescription = typeof polledResult === 'string' ? polledResult : null;
                imageDescriptionData = { description: imageDescription };
                
                if (imageDescription) {
                  this.logger.result('✅', 'Got image description');
                  const preview = imageDescription.substring(0, 120);
                  this.logger.info(`   ${preview}${imageDescription.length > 120 ? '...' : ''}`);
                }
              }
            }
          } else {
            // Immediate response (synchronous) - try to parse description
            try {
              const parsed = JSON.parse(descriptionResult.response);
              imageDescription = parsed.description || parsed.data?.description || null;
              imageDescriptionData = parsed;
              
              if (imageDescription) {
                this.logger.result('✅', 'Got image description');
                const preview = imageDescription.substring(0, 120);
                this.logger.info(`   ${preview}${imageDescription.length > 120 ? '...' : ''}`);
              } else {
                this.logger.warn('No description found in response');
              }
            } catch (parseError) {
              // Response might be plain text indicating async processing
              if (descriptionResult.response.includes('Analyzing') || descriptionResult.response.includes('processing')) {
                this.logger.warn('Image description appears async but no statusUrl found');
                this.logger.info('Check backend implementation - statusUrl should be returned');
              } else {
                imageDescription = null;
                imageDescriptionData = null;
                this.logger.warn(`Failed to parse image description: ${parseError instanceof Error ? parseError.message : parseError}`);
              }
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Failed to describe image: ${errorMessage}`);
          imageDescription = null;
        }
      }

      // Step 7: Generate captions with CaptionPuter (only if we have an image description)
      let caption: string | null = null;
      let captionData: any = null;
      let captionOptions: any[] = [];
      
      if (!imageDescription) {
        this.logger.warn('Skipping caption generation - no image description available');
      } else {
        this.logger.section('Step 7: Generating captions', 'captionputer');
        const captionTrendItem = trends?.items?.[0] || {
          title: fixedTask,
          summary: fixedTask,
          source: 'USER',
        };
        
        // Use same brand profile as brief
        const captionBrandProfile = request.brandProfile || {
          brandName: 'Memeputer',
          personality: 'fun, crypto-native, memes',
          targetAudience: 'Solana degens',
          voice: 'casual, humorous',
          denyTerms: [],
        };
        
        // Request multiple caption variants (default: 3)
        const numVariants = 3;
        
        try {
          // Call CaptionPuter with image description and context
          // CaptionPuter requires either brandAgentId or brandProfile
          const captionPayload: any = {
            imageDescription: imageDescription,
            imagePrompt: imagePrompt || null,
            trendItem: captionTrendItem,
            brief: brief?.brief || null,
            numVariants,
          };
          
          // Add customInstructions from captionPuterOptions if provided
          if (captionBrandProfile.captionPuterOptions?.promptTemplate) {
            captionPayload.customInstructions = captionBrandProfile.captionPuterOptions.promptTemplate;
          }
          
          // Add brandAgentId if available, otherwise add brandProfile
          if (captionBrandProfile.brandAgentId) {
            captionPayload.brandAgentId = captionBrandProfile.brandAgentId;
          } else {
            captionPayload.brandProfile = captionBrandProfile;
          }
          
          const captionResult = await this.hireAgent('captionputer', 'generate_captions', captionPayload);
          
          try {
            const parsed = JSON.parse(captionResult.response);
            const captions = parsed.captions || parsed.data?.captions || [];
            
            // Debug: Log what we received
            this.logger.info(`CaptionPuter response structure: ${JSON.stringify(Object.keys(parsed))}`);
            this.logger.info(`Found ${captions.length} caption(s) in response`);
            
            if (captions.length > 0) {
              captionOptions = captions;
              caption = captions[0]?.text || null;
              captionData = captions[0] || null; // Store first caption for posting
              
              this.logger.result('✅', `Got ${captions.length} caption option${captions.length > 1 ? 's' : ''}`);
              
              // Log all caption options
              captions.forEach((cap: any, idx: number) => {
                const preview = cap.text?.substring(0, 80) || 'N/A';
                this.logger.info(`   Option ${idx + 1}: ${preview}${cap.text && cap.text.length > 80 ? '...' : ''}`);
              });
              
              if (captions.length === 1 && numVariants > 1) {
                this.logger.warn(`⚠️  Requested ${numVariants} captions but only received 1`);
              }
            } else {
              this.logger.warn('No captions returned in response');
              this.logger.info(`Full response: ${JSON.stringify(parsed).substring(0, 500)}`);
            }
          } catch (parseError) {
            caption = null;
            captionData = null;
            captionOptions = [];
            this.logger.warn(`Failed to parse caption response: ${parseError instanceof Error ? parseError.message : parseError}`);
            this.logger.info(`Raw response: ${captionResult.response.substring(0, 500)}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`Failed to generate captions: ${errorMessage}`);
          caption = null;
          captionOptions = [];
        }
      }

      // Step 8: Post to Telegram (only if we have both image and caption)
      let postedLinks: { telegram?: string } = {};
      
      if (!imageUrl) {
        this.logger.warn('Skipping Telegram post - no image was generated');
      } else if (!caption) {
        this.logger.warn('Skipping Telegram post - no caption was generated');
      } else {
        this.logger.section('Step 8: Posting to Telegram', 'broadcastputer');
        // BroadcastPuter uses its own configured bot token, we just need chat ID
        // Default to Memeputer chat if not specified
        const telegramChatId = process.env.TELEGRAM_CHAT_ID || process.env.MEMEPUTER_TELEGRAM_CHAT_ID;
        
          if (telegramChatId) {
            this.logger.info(`Posting to Telegram (Chat ID: ${telegramChatId})`);
            
            // Build enhanced caption with all options and context (prompt, trend, brief)
            // If we have captionOptions, use them; otherwise fall back to single caption
            const captionsToShow = captionOptions.length > 0 
              ? captionOptions.map((cap: any) => ({
                  text: cap.text || null,
                  hashtags: cap.hashtags || [],
                }))
              : caption 
                ? [{ text: caption, hashtags: captionData?.hashtags || [] }]
                : null;
            
            const enhancedCaption = this.buildEnhancedCaption(
              captionsToShow,
              selectedTrend || trends?.items?.[0] || null,
              brief?.brief || null,
              imagePrompt || null
            );
            
            try {
              // No hardcoded amount - actual payment comes from 402 quote
              const telegramResult = await this.hireAgent('broadcastputer', 'post_telegram', {
                chatId: telegramChatId,
                caption: enhancedCaption,
                imageUrl: imageUrl || '',
                // botToken is optional - BroadcastPuter uses its own configured token
              });
              
              try {
                // Remove markdown code blocks if present
                let responseText = telegramResult.response.trim();
                if (responseText.startsWith('```')) {
                  // Remove markdown code blocks (```json ... ```)
                  responseText = responseText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
                }
                
                const parsed = JSON.parse(responseText);
                // Extract messageLink from response (could be at root or in data object)
                const messageLink = parsed.messageLink || parsed.data?.messageLink || null;
                
                if (messageLink && typeof messageLink === 'string') {
                  postedLinks.telegram = messageLink;
                  this.logger.result('✅', `Posted to Telegram: ${messageLink}`);
                } else {
                  // If no messageLink but response looks like JSON with a URL, try to extract it
                  const responseStr = JSON.stringify(parsed);
                  const urlMatch = responseStr.match(/https:\/\/t\.me\/[^\s"']+/);
                  if (urlMatch) {
                    postedLinks.telegram = urlMatch[0];
                    this.logger.result('✅', `Posted to Telegram: ${urlMatch[0]}`);
                  } else {
                    this.logger.warn('Posted to Telegram but no message link found in response');
                  }
                }
              } catch {
                // Response might not be JSON - try to extract URL directly
                const urlMatch = telegramResult.response.match(/https:\/\/t\.me\/[^\s"']+/);
                if (urlMatch) {
                  postedLinks.telegram = urlMatch[0];
                  this.logger.result('✅', `Posted to Telegram: ${urlMatch[0]}`);
                } else if (telegramResult.response.includes('http')) {
                  postedLinks.telegram = telegramResult.response.trim();
                  this.logger.result('✅', `Posted to Telegram: ${postedLinks.telegram}`);
                } else {
                  this.logger.warn('Unexpected response format from BroadcastPuter');
                }
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              this.logger.error(`Failed to post to Telegram: ${errorMessage}`);
              if (errorMessage.includes('402') || errorMessage.includes('payment')) {
                this.logger.info('This appears to be a payment issue - check BroadcastPuter\'s pricing');
              } else if (errorMessage.includes('500') || errorMessage.includes('Internal')) {
                this.logger.info('This appears to be a backend error - BroadcastPuter may be having issues');
              }
            }
          } else {
            this.logger.warn('Skipping Telegram post (chat ID not configured)');
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

      this.logger.spacer();
      this.logger.section('✅ Task Completed', '');
      this.logger.result('💰', `Total spent: ${this.totalSpent.toFixed(4)} USDC`);
      this.logger.result('💵', `Remaining budget: ${(request.budgetUsdc - this.totalSpent).toFixed(4)} USDC`);
      this.logger.result('👥', `Agents hired: ${this.agentsHired.length}`);
      this.logger.result('💸', `Payments made: ${this.payments.length}`);

      // Use the selected trend (already chosen in Step 1b)
      const finalSelectedTrend = selectedTrend || trends?.items?.[0] || null;
      
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
            selectedTrend: finalSelectedTrend ? {
              id: finalSelectedTrend.id,
              title: finalSelectedTrend.title,
              summary: finalSelectedTrend.summary,
              source: finalSelectedTrend.source,
              score: finalSelectedTrend.score,
              hashtags: finalSelectedTrend.hashtags,
              canonicalUrl: finalSelectedTrend.canonicalUrl,
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
          imageDescription: imageDescription ? {
            description: imageDescription,
            style: imageDescriptionData?.style || null,
            composition: imageDescriptionData?.composition || null,
            details: imageDescriptionData?.details || null,
          } : null,
          caption: captionData || caption ? {
            text: caption || captionData?.text || null,
            hashtags: captionData?.hashtags || [],
            disclaimer: captionData?.disclaimer || null,
            length: captionData?.length || null,
          } : null,
          captionOptions: captionOptions.length > 0 ? captionOptions.map((cap: any) => ({
            text: cap.text || null,
            hashtags: cap.hashtags || [],
            disclaimer: cap.disclaimer || null,
            length: cap.length || null,
          })) : null,
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
   * - The actual payment amount comes from the 402 quote (maxAmountRequired)
   * - maxBudgetUsdc is only a safety limit to prevent overspending
   */
  private async hireAgent(
    agentId: string,
    command: string,
    payload: any,
    maxBudgetUsdc?: number // Optional safety limit - defaults to remaining budget
  ): Promise<InteractionResultWithReceipt> {
    // Use provided limit or remaining budget as safety limit
    const remainingBudget = this.taskBudget - this.totalSpent;
    const safetyLimit = maxBudgetUsdc ?? remainingBudget;
    
    // Show command or prompt preview
    const commandPreview = command.length > 50 && Object.keys(payload).length === 0
      ? `${command.substring(0, 100)}...`
      : command;
    
    // Use logger spinner for payment processing
    this.logger.startLoading(`Paying ${agentId}...`);
    
    try {

      // If payload is empty and command looks like natural language, send as-is
      // Otherwise, format as structured command
      const message = Object.keys(payload).length === 0 && command.length > 50
        ? command // Natural language prompt - send directly
        : JSON.stringify({
            command,
            ...payload,
          });
      
      // Debug: log payload for troubleshooting
      if (process.env.DEBUG) {
        this.logger.info(`Debug: ${JSON.stringify(payload, null, 2)}`);
      }

      // Call the agent using x402 - the orchestrator agent pays!
      const result = await this.apiClient.interact(
        agentId,
        message,
        this.wallet, // Orchestrator's wallet pays the agent
        this.connection
      ) as InteractionResultWithReceipt;
      
      this.logger.stopLoading(`Paid ${agentId}`);

      // Track payment - use RECEIPT (actual amount paid) from x402Receipt if available
      // Terminology:
      // - QUOTE (402 response): maxAmountRequired = estimated cost (budget limit)
      // - RECEIPT (success response): x402Receipt.amountPaidUsdc = actual cost (for tracking)
      if (result.transactionSignature) {
        let actualAmount: number;
        let amountSource: string;
        
        if (result.x402Receipt) {
          // RECEIPT: Use actual amount paid from x402 receipt (after payment)
          // This is the accurate cost to track
          actualAmount = result.x402Receipt.amountPaidUsdc;
          amountSource = 'actual (from receipt)';
        } else {
          // Fallback: Use safety limit as estimate (shouldn't happen - backend should return receipt)
          // This happens if backend doesn't return x402Receipt yet
          actualAmount = safetyLimit;
          amountSource = 'estimated (receipt not available, using safety limit)';
        }
        
        this.totalSpent += actualAmount;
        this.agentsHired.push(agentId);
        this.payments.push({
          agentId,
          command,
          amount: actualAmount,
          txId: result.transactionSignature,
        });

        // Get payer and merchant addresses
        const payer = result.x402Receipt?.payer || this.wallet.publicKey.toString();
        const merchant = result.x402Receipt?.merchant || result.x402Receipt?.payTo || '';
        
        // Use quote amount if available (what we actually paid), otherwise use receipt amount
        const paymentAmount = result.x402Quote?.amountQuotedUsdc || actualAmount;
        
        // Log payment with CleanLogger
        this.logger.payment({
          agentId,
          amount: paymentAmount,
          transactionSignature: result.transactionSignature,
          txUrl: getSolscanTxUrl(result.transactionSignature, this.network),
          fromWallet: payer,
          fromWalletUrl: getSolscanAccountUrl(payer, this.network),
          toWallet: merchant,
          toWalletUrl: merchant ? getSolscanAccountUrl(merchant, this.network) : undefined,
          receiptAmount: result.x402Receipt?.amountPaidUsdc,
        });
      }

      return result;
    } catch (error) {
      this.logger.failLoading(`Failed to pay ${agentId}`);
      throw error;
    }
  }

  /**
   * Select the best trend from a list using AI-powered evaluation
   * The orchestrator agent asks itself (via API) to evaluate trends and pick the best one
   * This demonstrates true autonomy - the agent uses its own reasoning capabilities
   */
  private async selectBestTrend(trends: any[], task: string): Promise<any | null> {
    if (!trends || trends.length === 0) {
      return null;
    }
    
    // If only one trend, use it (but could still evaluate quality)
    if (trends.length === 1) {
      return trends[0];
    }
    
    // The orchestrator agent hires BriefPuter to evaluate trends
    // BriefPuter is designed for content evaluation and creative reasoning
    // This demonstrates agent-to-agent collaboration for decision-making
    const trendsList = trends.map((t, idx) => 
      `${idx + 1}. "${t.title || 'Untitled'}": ${(t.summary || '').substring(0, 100)}${(t.summary || '').length > 100 ? '...' : ''}`
    ).join('\n');
    
    const evaluationPrompt = `I need to evaluate ${trends.length} trending topics and pick the best one for this task: "${task}"

Here are the trends:
${trendsList}

Please evaluate these trends and tell me which ONE is the best fit. Consider:
- Relevance to the task
- Quality and credibility  
- Potential for engaging content

Respond with ONLY the number (1-${trends.length}) of the best trend. If none are suitable, respond with "0".`;

    try {
      // The orchestrator agent pays BriefPuter to evaluate trends
      // This demonstrates agent-to-agent collaboration for decision-making
      const evaluationResult = await this.apiClient.interact(
        'briefputer',
        evaluationPrompt, // Send the prompt directly as a message
        this.wallet, // Pay from orchestrator's wallet
        this.connection
      );
      
      // Track this payment - use actual cost from receipt
      if (evaluationResult.transactionSignature) {
        const actualAmount = (evaluationResult as InteractionResultWithReceipt).x402Receipt?.amountPaidUsdc || 0.01;
        const paymentAmount = (evaluationResult as InteractionResultWithReceipt).x402Quote?.amountQuotedUsdc || actualAmount;
        this.totalSpent += actualAmount;
        this.agentsHired.push('briefputer');
        this.payments.push({
          agentId: 'briefputer',
          command: 'trend-evaluation',
          amount: actualAmount,
          txId: evaluationResult.transactionSignature,
        });
        
        // Log payment
        const payer = (evaluationResult as InteractionResultWithReceipt).x402Receipt?.payer || this.wallet.publicKey.toString();
        const merchant = (evaluationResult as InteractionResultWithReceipt).x402Receipt?.merchant || (evaluationResult as InteractionResultWithReceipt).x402Receipt?.payTo || '';
        
        this.logger.payment({
          agentId: 'briefputer',
          amount: paymentAmount,
          transactionSignature: evaluationResult.transactionSignature,
          txUrl: getSolscanTxUrl(evaluationResult.transactionSignature, this.network),
          fromWallet: payer,
          fromWalletUrl: getSolscanAccountUrl(payer, this.network),
          toWallet: merchant,
          toWalletUrl: merchant ? getSolscanAccountUrl(merchant, this.network) : undefined,
          receiptAmount: (evaluationResult as InteractionResultWithReceipt).x402Receipt?.amountPaidUsdc,
        });
      }
      
      // Parse the response to get the selected trend number
      const response = evaluationResult.response.trim();
      const selectedNumber = parseInt(response.match(/\d+/)?.[0] || '0');
      
      if (selectedNumber > 0 && selectedNumber <= trends.length) {
        const selectedTrend = trends[selectedNumber - 1];
        return selectedTrend;
      } else {
        return null;
      }
    } catch (error) {
      // Fallback to heuristic-based selection if AI evaluation fails
      this.logger.warn('AI evaluation failed, using heuristic fallback');
      
      return this.selectBestTrendHeuristic(trends, task);
    }
  }

  /**
   * Fallback heuristic-based trend selection
   * Used if AI-based evaluation fails
   */
  private selectBestTrendHeuristic(trends: any[], task: string): any | null {
    const taskKeywords = task.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    const scoredTrends = trends.map(trend => {
      let score = trend.score || 0;
      
      const trendText = `${trend.title || ''} ${trend.summary || ''}`.toLowerCase();
      
      // Boost for task keyword matches (general relevance)
      const keywordMatches = taskKeywords.filter(kw => trendText.includes(kw)).length;
      score += keywordMatches * 5;
      
      // Source quality boost (all sources treated equally for quality)
      if (trend.source === 'DEXSCREENER' || trend.source === 'BIRDEYE') {
        score += 15; // Higher quality sources
      } else if (trend.source === 'X') {
        score += 10;
      } else if (trend.source === 'RSS') {
        score += 5;
      }
      
      // Boost if has URL (more credible)
      if (trend.canonicalUrl) {
        score += 5;
      }
      
      // Boost if has hashtags (more engagement potential)
      if (trend.hashtags && trend.hashtags.length > 0) {
        score += trend.hashtags.length * 2;
      }
      
      // Penalize very low-quality or spammy trends
      // Only penalize if trend has very low base score AND no relevance
      if ((trend.score || 0) < 5 && keywordMatches === 0) {
        score -= 10; // Light penalty for completely irrelevant low-score trends
      }
      
      return { trend, score };
    });
    
    // Sort by score descending
    scoredTrends.sort((a, b) => b.score - a.score);
    
    // Log top 3 candidates
    console.log(`   📊 Top trend candidates (heuristic):`);
    scoredTrends.slice(0, 3).forEach((item, idx) => {
      console.log(`      ${idx + 1}. "${item.trend.title}" (score: ${item.score.toFixed(1)})`);
    });
    
    // Only use trend if score is above threshold
    const bestTrend = scoredTrends[0];
    const threshold = 10; // Minimum score to consider
    
    if (bestTrend.score >= threshold) {
      console.log(`   ✅ Selected trend with score ${bestTrend.score.toFixed(1)} (threshold: ${threshold})`);
      return bestTrend.trend;
    } else {
      console.log(`   ⚠️  Best trend score ${bestTrend.score.toFixed(1)} below threshold ${threshold} - rejecting all trends`);
      return null;
    }
  }

  /**
   * Step 0: Ask AI what we should focus on before getting trends
   * This helps TrendPuter know what keywords/topics to investigate
   */
  private async whatShouldIFocusOn(task: string): Promise<{
    focusArea: string;
    keywords: string[];
    topics: string[];
    reasoning: string;
  }> {
    const prompt = `I'm an orchestrator agent with a task: "${task}"

Before I start looking for trends, help me think about what I should focus on. Consider:
- What topics would be most relevant to this task?
- What keywords or themes should I investigate?
- What's the goal of this content?

Respond in this exact JSON format:
{
  "focusArea": "1-2 sentence description of primary focus",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "topics": ["crypto", "tech", "culture"],
  "reasoning": "Why these topics/keywords are relevant"
}`;

    try {
      const result = await this.apiClient.interact(
        'briefputer',
        prompt,
        this.wallet,
        this.connection
      );

      if (result.transactionSignature) {
        const actualAmount = (result as InteractionResultWithReceipt).x402Receipt?.amountPaidUsdc || 0.01;
        const paymentAmount = (result as InteractionResultWithReceipt).x402Quote?.amountQuotedUsdc || actualAmount;
        this.totalSpent += actualAmount;
        this.payments.push({
          agentId: 'briefputer',
          command: 'what-should-i-focus-on',
          amount: actualAmount,
          txId: result.transactionSignature,
        });
        
        // Log payment
        const payer = (result as InteractionResultWithReceipt).x402Receipt?.payer || this.wallet.publicKey.toString();
        const merchant = (result as InteractionResultWithReceipt).x402Receipt?.merchant || (result as InteractionResultWithReceipt).x402Receipt?.payTo || '';
        
        this.logger.payment({
          agentId: 'briefputer',
          amount: paymentAmount,
          transactionSignature: result.transactionSignature,
          txUrl: getSolscanTxUrl(result.transactionSignature, this.network),
          fromWallet: payer,
          fromWalletUrl: getSolscanAccountUrl(payer, this.network),
          toWallet: merchant,
          toWalletUrl: merchant ? getSolscanAccountUrl(merchant, this.network) : undefined,
          receiptAmount: (result as InteractionResultWithReceipt).x402Receipt?.amountPaidUsdc,
        });
      }

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(result.response);
        return {
          focusArea: parsed.focusArea || task,
          keywords: parsed.keywords || [],
          topics: parsed.topics || ['crypto', 'tech'],
          reasoning: parsed.reasoning || 'No reasoning provided',
        };
      } catch {
        // If not JSON, extract keywords from text
        const response = result.response.trim();
        // Extract keywords (simple heuristic)
        const keywordMatches = response.match(/(?:keywords?|focus|topics?):\s*([^\n]+)/i);
        const keywords = keywordMatches 
          ? keywordMatches[1].split(',').map(k => k.trim()).filter(k => k.length > 0)
          : [];
        return {
          focusArea: response.substring(0, 200),
          keywords: keywords.length > 0 ? keywords : [],
          topics: ['crypto', 'tech', 'culture'],
          reasoning: response,
        };
      }
    } catch (error) {
      this.logger.warn('AI focus planning failed, using fallback');
      // Fallback: Extract keywords from task
      const taskKeywords = task.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      return {
        focusArea: task,
        keywords: taskKeywords.slice(0, 5),
        topics: ['crypto', 'tech'],
        reasoning: 'Using task keywords as fallback',
      };
    }
  }

  /**
   * AI-POWERED DECISION: Ask BriefPuter if we should get trends for this task
   */
  private async shouldGetTrends(task: string): Promise<boolean> {
    const prompt = `I have a task: "${task}"

Should I get trending topics to help me complete this task? Consider:
- Does the task benefit from current trends?
- Would trending content make this more engaging?
- Is the task too specific to need trends?

Respond in this exact JSON format:
{
  "decision": "yes" or "no",
  "reasoning": "Brief explanation of your decision"
}`;

    try {
      const result = await this.apiClient.interact(
        'briefputer',
        prompt,
        this.wallet,
        this.connection
      );

      if (result.transactionSignature) {
        const actualAmount = (result as InteractionResultWithReceipt).x402Receipt?.amountPaidUsdc || 0.01; // Fallback if no receipt
        this.totalSpent += actualAmount;
        this.payments.push({
          agentId: 'briefputer',
          command: 'should-get-trends',
          amount: actualAmount,
          txId: result.transactionSignature,
        });
      }

      // Parse JSON response
      let decision: boolean;
      let reasoning: string = '';
      try {
        const parsed = JSON.parse(result.response);
        const decisionStr = parsed.decision?.toLowerCase() || '';
        decision = decisionStr === 'yes' || decisionStr.startsWith('y');
        reasoning = parsed.reasoning || '';
      } catch {
        // Fallback to text parsing if JSON parsing fails
        const response = result.response.trim().toLowerCase();
        decision = response.includes('yes') || response.startsWith('y');
        reasoning = result.response;
      }
      console.log(`   🤖 AI decision: ${decision ? 'YES - Get trends' : 'NO - Skip trends'}`);
      if (reasoning) {
        console.log(`      Reasoning: ${reasoning.substring(0, 100)}${reasoning.length > 100 ? '...' : ''}`);
      }
      return decision;
    } catch (error) {
      console.log(`   ⚠️  AI decision failed, using fallback: Get trends`);
      // Fallback: Get trends if task mentions meme/create/trend
      return task.toLowerCase().includes('trend') || 
             task.toLowerCase().includes('meme') ||
             task.toLowerCase().includes('create');
    }
  }

  /**
   * AI-POWERED DECISION: Ask BriefPuter if we should retry getting trends
   */
  private async shouldRetryTrends(attemptNumber: number, task: string): Promise<boolean> {
    const prompt = `I tried to get trends ${attemptNumber} time(s) but didn't find suitable ones for this task: "${task}"

Should I retry with different sources, or proceed without trends? Consider:
- Is the task too specific to need trends?
- Would trending content significantly improve the result?
- Am I wasting budget on retries?

Respond with ONLY "yes" (retry) or "no" (proceed without trends).`;

    try {
      const result = await this.apiClient.interact(
        'briefputer',
        prompt,
        this.wallet,
        this.connection
      );

      if (result.transactionSignature) {
        const actualAmount = (result as InteractionResultWithReceipt).x402Receipt?.amountPaidUsdc || 0.01; // Fallback if no receipt
        this.totalSpent += actualAmount;
        this.payments.push({
          agentId: 'briefputer',
          command: 'should-retry-trends',
          amount: actualAmount,
          txId: result.transactionSignature,
        });
      }

      const response = result.response.trim().toLowerCase();
      const decision = response.includes('yes') || response.startsWith('y');
      console.log(`   🤖 AI decision: ${decision ? 'YES - Retry' : 'NO - Proceed without trends'}`);
      console.log(`      Reasoning: ${response.substring(0, 100)}...`);
      return decision;
    } catch (error) {
      console.log(`   ⚠️  AI decision failed, using fallback: Retry`);
      return true; // Default: retry once
    }
  }

  /**
   * AI-POWERED DECISION: Ask BriefPuter if we should generate a brief
   */
  private async shouldGenerateBrief(
    task: string,
    selectedTrend: any | null,
    trends: any | null
  ): Promise<boolean> {
    const hasTrend = selectedTrend !== null;
    const trendInfo = hasTrend 
      ? `I found a trend: "${selectedTrend.title}" - ${selectedTrend.summary?.substring(0, 100)}`
      : trends?.items?.length > 0 
        ? `I have ${trends.items.length} trends but none were perfect`
        : 'I have no trends';

    const prompt = `I have a task: "${task}"
${trendInfo}

Should I generate a creative brief before creating content? Consider:
- Would a brief help create better content?
- Is the task simple enough to skip the brief?
- Do I have enough context (trends) to create a useful brief?

Respond with ONLY "yes" or "no".`;

    try {
      const result = await this.apiClient.interact(
        'briefputer',
        prompt,
        this.wallet,
        this.connection
      );

      if (result.transactionSignature) {
        const actualAmount = (result as InteractionResultWithReceipt).x402Receipt?.amountPaidUsdc || 0.01; // Fallback if no receipt
        this.totalSpent += actualAmount;
        this.payments.push({
          agentId: 'briefputer',
          command: 'should-generate-brief',
          amount: actualAmount,
          txId: result.transactionSignature,
        });
      }

      const response = result.response.trim().toLowerCase();
      const decision = response.includes('yes') || response.startsWith('y');
      console.log(`   🤖 AI decision: ${decision ? 'YES - Generate brief' : 'NO - Skip brief'}`);
      console.log(`      Reasoning: ${response.substring(0, 100)}...`);
      return decision;
    } catch (error) {
      console.log(`   ⚠️  AI decision failed, using fallback: Generate brief`);
      // Fallback: Generate brief if we have trends or task mentions create/meme
      return hasTrend || 
             (trends?.items?.length > 0) ||
             task.toLowerCase().includes('create') ||
             task.toLowerCase().includes('meme');
    }
  }

  /**
   * Enhance image prompt using PromptPuter to create a high-quality, detailed prompt
   * This demonstrates agent-to-agent collaboration for prompt engineering
   */
  private async enhanceImagePrompt(basePrompt: string): Promise<string> {
    const enhancementPrompt = `I need to create a high-quality image generation prompt.

Base concept: "${basePrompt}"

Please enhance this prompt to create a detailed, artistic, high-quality image generation prompt. Add quality modifiers like:
- Highly detailed, 8K render, professional quality
- Cinematic lighting, vibrant colors, sharp focus
- Artistic composition, trending on artstation style
- Award winning, masterpiece quality

Make it compelling and detailed while keeping the core concept. Return ONLY the enhanced prompt, nothing else.`;

    try {
      const result = await this.apiClient.interact(
        'promptputer',
        enhancementPrompt,
        this.wallet,
        this.connection
      ) as InteractionResultWithReceipt;

      if (result.transactionSignature) {
        const actualAmount = result.x402Receipt?.amountPaidUsdc || 0.01;
        this.totalSpent += actualAmount;
        this.payments.push({
          agentId: 'promptputer',
          command: 'enhance-image-prompt',
          amount: actualAmount,
          txId: result.transactionSignature,
        });
        
        // Log payment
        const payer = result.x402Receipt?.payer || this.wallet.publicKey.toString();
        const merchant = result.x402Receipt?.merchant || result.x402Receipt?.payTo || '';
        const paymentAmount = result.x402Quote?.amountQuotedUsdc || actualAmount;
        
        this.logger.payment({
          agentId: 'promptputer',
          amount: paymentAmount,
          transactionSignature: result.transactionSignature,
          txUrl: getSolscanTxUrl(result.transactionSignature, this.network),
          fromWallet: payer,
          fromWalletUrl: getSolscanAccountUrl(payer, this.network),
          toWallet: merchant,
          toWalletUrl: merchant ? getSolscanAccountUrl(merchant, this.network) : undefined,
          receiptAmount: result.x402Receipt?.amountPaidUsdc,
        });
      }

      // Return the enhanced prompt (cleaned up)
      const enhanced = result.response.trim();
      // Remove any quotes or markdown formatting
      return enhanced.replace(/^["']|["']$/g, '').replace(/^```[\w]*\n?|\n?```$/g, '').trim();
    } catch (error) {
      this.logger.warn(`Prompt enhancement failed, using base prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return basePrompt; // Fallback to base prompt
    }
  }

  /**
   * AI-POWERED DECISION: Ask BriefPuter if we should generate an image
   */
  private async shouldGenerateImage(task: string, brief: any | null): Promise<boolean> {
    const hasBrief = brief?.brief?.angle !== null && brief?.brief?.angle !== undefined;
    const briefInfo = hasBrief 
      ? `I have a creative brief with angle: "${brief.brief.angle?.substring(0, 100)}"`
      : 'I do not have a creative brief';

    const prompt = `I have a task: "${task}"
${briefInfo}

Should I generate an image to complete this task? Consider:
- Does the task require visual content?
- Would an image significantly improve the result?
- Do I have enough context (brief) to generate a good image?

Respond with ONLY "yes" or "no".`;

    try {
      const result = await this.apiClient.interact(
        'briefputer',
        prompt,
        this.wallet,
        this.connection
      );

      if (result.transactionSignature) {
        const actualAmount = (result as InteractionResultWithReceipt).x402Receipt?.amountPaidUsdc || 0.01; // Fallback if no receipt
        this.totalSpent += actualAmount;
        this.payments.push({
          agentId: 'briefputer',
          command: 'should-generate-image',
          amount: actualAmount,
          txId: result.transactionSignature,
        });
      }

      const response = result.response.trim().toLowerCase();
      const decision = response.includes('yes') || response.startsWith('y');
      return decision;
    } catch (error) {
      this.logger.warn('AI decision failed, using fallback: Generate image');
      // Fallback: Generate image if we have brief or task mentions image/meme/create
      return hasBrief ||
             task.toLowerCase().includes('image') ||
             task.toLowerCase().includes('meme') ||
             task.toLowerCase().includes('create');
    }
  }

  /**
   * AI-POWERED DECISION: Ask BriefPuter if content is ready to post
   */
  private async shouldPostContent(
    task: string,
    imageUrl: string | null,
    caption: string | null,
    brief: any | null
  ): Promise<boolean> {
    const hasImage = imageUrl !== null;
    const hasCaption = caption !== null;
    const hasBrief = brief?.brief?.angle !== null;

    const prompt = `I have a task: "${task}"

Current status:
- Image: ${hasImage ? '✅ Generated' : '❌ Missing'}
- Caption: ${hasCaption ? '✅ Generated' : '❌ Missing'}
- Brief: ${hasBrief ? '✅ Created' : '❌ Missing'}

Should I post this content to social media? Consider:
- If I have both image and caption, the content is complete and ready to post
- The goal is to share the meme I created
- Only say "no" if content is truly incomplete or low quality

Respond with ONLY "yes" or "no".`;

    try {
      const result = await this.apiClient.interact(
        'briefputer',
        prompt,
        this.wallet,
        this.connection
      );

      if (result.transactionSignature) {
        const actualAmount = (result as InteractionResultWithReceipt).x402Receipt?.amountPaidUsdc || 0.01; // Fallback if no receipt
        this.totalSpent += actualAmount;
        this.payments.push({
          agentId: 'briefputer',
          command: 'should-post-content',
          amount: actualAmount,
          txId: result.transactionSignature,
        });
      }

      const response = result.response.trim().toLowerCase();
      const decision = response.includes('yes') || response.startsWith('y');
      console.log(`   🤖 AI decision: ${decision ? 'YES - Post content' : 'NO - Wait for better quality'}`);
      console.log(`      Reasoning: ${response.substring(0, 100)}...`);
      // If we have both image and caption, post regardless of AI decision (AI might be too conservative)
      // Only skip if AI says no AND we're missing critical content
      if (hasImage && hasCaption) {
        return true; // Always post if we have complete content
      }
      return decision && hasImage && hasCaption; // Otherwise respect AI decision
    } catch (error) {
      console.log(`   ⚠️  AI decision failed, using fallback: Post if complete`);
      // Fallback: Only post if we have both image and caption
      return hasImage && hasCaption;
    }
  }

  /**
   * Build enhanced Telegram caption with context (trend, brief, prompt) and all caption options
   * Caption options appear FIRST so they're easy to see
   */
  private buildEnhancedCaption(
    captionOptions: Array<{ text?: string; hashtags?: string[] }> | null,
    trend: any | null,
    brief: any | null,
    prompt: string | null
  ): string {
    let enhanced = '';
    
    // Add all caption options FIRST (at the top)
    if (captionOptions && captionOptions.length > 0) {
      enhanced += `✍️ <b>Caption Options:</b>\n\n`;
      captionOptions.forEach((cap, idx) => {
        const captionText = cap.text || 'N/A';
        enhanced += `<b>Caption ${idx + 1}:</b>\n`;
        enhanced += `${captionText}\n`;
        if (cap.hashtags && cap.hashtags.length > 0) {
          enhanced += `🏷️ ${cap.hashtags.join(' ')}\n`;
        }
        enhanced += `\n`;
      });
    } else {
      enhanced += `✍️ <b>Caption:</b>\n`;
      enhanced += `No captions generated\n\n`;
    }
    
    // Add separator
    enhanced += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Add trend context
    if (trend) {
      enhanced += `📰 <b>Trend:</b> ${trend.title || 'N/A'}\n\n`;
      if (trend.summary) {
        const summary = trend.summary.substring(0, 200);
        enhanced += `📝 ${summary}${trend.summary.length > 200 ? '...' : ''}\n`;
      }
      
      // Add source link if available
      if (trend.canonicalUrl) {
        enhanced += `🔗 <a href="${trend.canonicalUrl}">Source</a>\n`;
      }
      
      enhanced += `\n`;
    }
    
    // Add creative angle if available
    if (brief?.angle) {
      enhanced += `💡 <b>Creative Angle:</b>\n`;
      enhanced += `${brief.angle.substring(0, 200)}${brief.angle.length > 200 ? '...' : ''}\n\n`;
    }
    
    // Add image prompt if available
    if (prompt) {
      enhanced += `🎨 <b>Image Prompt:</b>\n`;
      enhanced += `<code>${prompt.substring(0, 500)}${prompt.length > 500 ? '...' : ''}</code>\n`;
    }
    
    return enhanced;
  }

  /**
   * Poll image description status URL until description is ready
   */
  private async pollImageDescription(statusUrl: string, maxAttempts: number = 120, delayMs: number = 1000): Promise<string | null> {
    const axios = (await import('axios')).default;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      attempts++;
      
      try {
        const response = await axios.get(statusUrl, {
          validateStatus: (status) => status < 500, // Don't throw on 4xx
        });
        
        const data = response.data;
        
        // Handle nested response structure: { data: { status, description, ... }, meta: {...} }
        const actualData = data.data || data; // Support both nested and flat structures
        
        // Check if completed - use actualData for nested responses
        // Accept both "completed" and "success" statuses
        if (actualData.status === 'completed' || actualData.status === 'success' || actualData.description) {
          this.logger.result('✅', 'Got image description');
          // Return the actual data as JSON string for parsing
          return JSON.stringify(actualData);
        }
        
        // Check if failed
        if (actualData.status === 'failed' || actualData.error) {
          this.logger.error(`Image description failed: ${actualData.error || 'Unknown error'}`);
          return null;
        }
        
        // Still processing - minimal logging (only every 15 seconds)
        if (attempts % 15 === 0) {
          this.logger.info(`Still processing... (${attempts}s)`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Polling error (attempt ${attempts}): ${errorMessage}`);
        if (attempts < 5) {
          // Retry on early errors
          continue;
        }
        this.logger.warn(`Connection issue, retrying... (${errorMessage})`);
        if (attempts >= maxAttempts) {
          this.logger.error(`Failed to poll image description after ${maxAttempts} attempts`);
          return null;
        }
      }
    }
    
    this.logger.warn(`Polling timeout after ${maxAttempts} seconds`);
    return null;
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

