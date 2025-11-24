import { Connection, Keypair } from '@solana/web3.js';
import { Memeputer, PromptResult, getUsdcBalance } from '@memeputer/sdk';
import { OrchestratorConfig, TaskRequest, TaskResult } from './types';
import { CleanLogger } from './lib/logger';
import { getTxUrl, getAccountUrl, detectNetwork } from './lib/utils';

/**
 * Orchestrator - Coordinates and pays multiple specialized agents to complete tasks
 * 
 * This demonstrates an agent-to-agent economy where:
 * - The orchestrator has its own wallet with USDC
 * - It coordinates a fixed workflow of specialized agents
 * - It pays those agents from its own wallet using x402 micropayments
 * - The orchestrator tracks spending and manages the budget
 */
export class Orchestrator {
  private memeputer: Memeputer;
  private wallet: Keypair;
  private connection: Connection;
  private totalSpent: number = 0;
  private agentsHired: string[] = [];
  private payments: Array<{ agentId: string; command: string; amount: number; txId: string }> = [];
  private network: 'mainnet' | 'devnet';
  private logger: CleanLogger;
  private apiBase: string;

  constructor(config: OrchestratorConfig) {
    this.memeputer = new Memeputer({
      apiUrl: config.apiBase,
      wallet: config.wallet,
      connection: config.connection,
      verbose: true, // Show x402 protocol details
    });
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

    const fixedTask = 'Find relevant topics and create a meme about them';
    const brandProfile = request.brandProfile || {
      brandName: 'Memeputer',
      personality: 'fun, crypto-native, memes',
      targetAudience: 'Solana degens',
      voice: 'casual, humorous',
      denyTerms: [],
    };

    try {
      this.logger.section('Orchestrator Agent', `Task: "${fixedTask}" | Budget: ${request.budgetUsdc} USDC`);

      // Step 1: Extract Keywords
      this.logger.section('Step 1: Extract Keywords', 'keywordputer');
      this.logger.startLoading('Processing...');
      const focusPlan = await this.whatShouldIFocusOn(fixedTask);
      this.logger.stopLoading();
      this.logger.result('✅', `Extracted ${focusPlan.keywords?.length || 0} keywords`);
      if (focusPlan.keywords && focusPlan.keywords.length > 0) {
        this.logger.info(`Keywords: ${focusPlan.keywords.join(', ')}`);
      }

      // Step 2: Discover Trends
      const trends = await this.discoverTrends(fixedTask, focusPlan.keywords || []);

      // Step 3: Select Best Trend
      let selectedTrend: any = null;
      if (trends?.items && trends.items.length > 0) {
        this.logger.section('Step 3: Select Best Trend', 'trendputer');
        this.logger.startLoading('Processing...');
        selectedTrend = await this.selectBestTrend(trends.items, fixedTask);
        this.logger.stopLoading();
        
        if (selectedTrend) {
          this.logger.result('✅', `Selected: "${selectedTrend.title}"`);
          if (selectedTrend.summary) {
            this.logger.info(`   ${selectedTrend.summary.substring(0, 100)}${selectedTrend.summary.length > 100 ? '...' : ''}`);
          }
        } else {
          this.logger.warn('No suitable trends found - proceeding without trend context');
        }
      } else {
        this.logger.warn('No trends returned - proceeding without trend context');
      }

      // Step 4: Create Creative Brief
      const brief = await this.createBrief(selectedTrend, trends, fixedTask, brandProfile);

      // Step 5: Enhance Image Prompt
      this.logger.section('Step 5: Enhance Image Prompt', 'promptputer');
      const basePrompt = brief?.brief?.angle || fixedTask;
      const imagePrompt = await this.enhanceImagePrompt(basePrompt);
      this.logger.result('✅', 'Prompt enhanced');

      // Step 6: Generate Image
      const { imageUrl, imageHash, imageStatusUrl } = await this.generateImage(imagePrompt, brandProfile);

      // Wait for image to be ready before proceeding
      let readyImageUrl = imageUrl;
      if (imageStatusUrl || imageUrl) {
        readyImageUrl = await this.waitForImageReady(imageUrl, imageStatusUrl);
      }

      // Step 7: Describe Image
      let imageDescription: string | null = null;
      let imageDescriptionData: any = null;
      if (!readyImageUrl) {
        this.logger.warn('Skipping image description - no image was generated or image not ready');
      } else {
        const descriptionResult = await this.describeImage(readyImageUrl);
        imageDescription = descriptionResult.description;
        imageDescriptionData = descriptionResult.data;
      }

      // Step 8: Write Captions
      let caption: string | null = null;
      let captionData: any = null;
      let captionOptions: any[] = [];
      if (!imageDescription) {
        this.logger.warn('Skipping caption generation - no image description available');
      } else {
        const captionResult = await this.writeCaptions(
          imageDescription,
          imagePrompt,
          trends,
          brief,
          fixedTask,
          brandProfile
        );
        caption = captionResult.caption;
        captionData = captionResult.captionData;
        captionOptions = captionResult.captionOptions;
      }

      // Step 9: Broadcast to Telegram
      let postedLinks: { telegram?: string } = {};
      if (!imageUrl) {
        this.logger.warn('Skipping Telegram post - no image was generated');
      } else if (!caption) {
        this.logger.warn('Skipping Telegram post - no caption was generated');
      } else {
        postedLinks = await this.broadcastToTelegram(
          imageUrl,
          caption,
          captionData,
          captionOptions,
          selectedTrend,
          trends,
          brief,
          imagePrompt
        );
      }

      // Build and return result
      return this.buildTaskResult(
        request,
        trends,
        selectedTrend,
        brief,
        imageUrl,
        imagePrompt,
        imageHash,
        imageStatusUrl,
        imageDescription,
        imageDescriptionData,
        caption,
        captionData,
        captionOptions,
        postedLinks
      );
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
   * Step 2: Discover trends using TrendPuter
   * Uses the structured discover_trends command for reliable JSON parsing
   */
  private async discoverTrends(fixedTask: string, keywords: string[]): Promise<any> {
    this.logger.section('Step 2: Discover Trends', 'trendputer');
    
    const trendsResult = await this.hireAgentWithCommand('trendputer', 'discover_trends', {
      keywords: keywords.length > 0 ? keywords : undefined,
      context: fixedTask,
      maxResults: 10,
      includeHashtags: true,
      includeUrl: true,
    });
    
    // Log the raw command result for debugging
    console.log('\n   📋 Trendputer Command Result:');
    console.log(`   Response length: ${trendsResult.response?.length || 0} characters`);
    console.log(`   Response preview: ${trendsResult.response?.substring(0, 500) || 'empty'}${trendsResult.response && trendsResult.response.length > 500 ? '...' : ''}`);
    if (trendsResult.response) {
      try {
        const preview = JSON.parse(trendsResult.response);
        console.log(`   ✅ Valid JSON structure:`, JSON.stringify({
          itemsCount: preview.items?.length || 0,
          hasMetadata: !!preview.metadata,
          firstItemKeys: preview.items?.[0] ? Object.keys(preview.items[0]) : []
        }, null, 2));
      } catch {
        console.log(`   ⚠️  Response is not valid JSON`);
      }
    }
    console.log('');
    
    // Parse trends response - guaranteed to be valid JSON
    try {
      const trends = JSON.parse(trendsResult.response);
      this.logger.result('✅', `Got ${trends?.items?.length || 0} trends`);
      if (trends?.items && trends.items.length > 0) {
        trends.items.forEach((trend: any, idx: number) => {
          console.log(`      ${idx + 1}. ${trend.title || 'Untitled'}`);
          if (trend.summary) {
            console.log(`         ${trend.summary.substring(0, 80)}${trend.summary.length > 80 ? '...' : ''}`);
          }
        });
      }
      return trends;
    } catch (error) {
      this.logger.error(`Failed to parse trends: ${error instanceof Error ? error.message : error}`);
      return { items: [] };
    }
  }

  /**
   * Step 4: Create creative brief using BriefPuter
   */
  private async createBrief(
    selectedTrend: any,
    trends: any,
    fixedTask: string,
    brandProfile: any
  ): Promise<any> {
    this.logger.section('Step 4: Create Creative Brief', 'briefputer');
    
    const trendItem = selectedTrend || trends?.items?.[0] || {
      title: fixedTask,
      summary: fixedTask,
    };
    
    if (brandProfile.brandAgentId) {
      this.logger.info(`Using brand agent: ${brandProfile.brandAgentId}`);
    } else if (brandProfile.brandName) {
      this.logger.info(`Using brand: ${brandProfile.brandName}`);
    }
    
    const briefPayload: any = {
      trendItem,
      policy: {
        denyTerms: brandProfile.denyTerms || [],
        requireDisclaimer: false,
      },
    };
    
    if (brandProfile.brandAgentId) {
      briefPayload.brandAgentId = brandProfile.brandAgentId;
      this.logger.info(`Sending brandAgentId to BriefPuter: ${brandProfile.brandAgentId}`);
    } else {
      briefPayload.brandProfile = brandProfile;
      this.logger.info(`Sending brandProfile to BriefPuter: ${brandProfile.brandName || 'Custom'}`);
    }
    
    const briefResult = await this.hireAgentWithCommand('briefputer', 'generate_brief', briefPayload);
    
    try {
      const parsed = JSON.parse(briefResult.response);
      const brief = parsed.data;
      this.logger.result('✅', 'Got creative brief');
      
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
      return brief;
    } catch {
      this.logger.warn('Failed to parse brief response');
      return { brief: null };
    }
  }

  /**
   * Step 6: Generate image using PFPputer
   */
  private async generateImage(
    enhancedPrompt: string,
    brandProfile: any
  ): Promise<{ imageUrl: string | null; imageHash: string | null; imageStatusUrl: string | null }> {
    this.logger.section('Step 6: Generate Image', 'pfpputer');
    
    // Use camelCase keys - SDK will convert to kebab-case flags automatically
    const pfpParams: any = {
      _args: ['generate', enhancedPrompt], // Positional arguments
    };
    
    if (brandProfile?.referenceImageUrls && brandProfile.referenceImageUrls.length > 0) {
      pfpParams.refImages = brandProfile.referenceImageUrls;
      this.logger.info(`Using ${brandProfile.referenceImageUrls.length} reference image(s)`);
    }
    
    const imageResult = await this.hireAgentWithCommand('pfpputer', 'pfp', pfpParams);
    
    let imageStatusUrl: string | null = null;
    if (imageResult.statusUrl) {
      imageStatusUrl = imageResult.statusUrl;
    }
    
    let imageUrl = imageResult.imageUrl || imageResult.mediaUrl || null;
    let imageHash: string | null = null;
    
    if (!imageUrl) {
      try {
        const parsed = JSON.parse(imageResult.response);
        imageUrl = parsed.data?.imageUrl || null;
        imageHash = parsed.data?.imageHash || null;
      } catch {
        if (imageResult.response.startsWith('http')) {
          imageUrl = imageResult.response.trim();
        }
      }
    }
    
    if (!imageUrl && imageResult.statusUrl) {
      this.logger.info('Image generation in progress...');
      const statusResult = await this.memeputer.pollStatus(imageResult.statusUrl, {
        maxAttempts: 120,
        intervalMs: 1000,
        onProgress: (attempt, _status) => {
          const elapsedSeconds = attempt - 1;
          if (elapsedSeconds > 0 && elapsedSeconds % 15 === 0) {
            this.logger.info(`   ⏳ Still processing... (${elapsedSeconds}s elapsed)`);
          }
        },
      });
      imageUrl = statusResult.imageUrl || statusResult.mediaUrl || null;
      if (statusResult.status === 'failed') {
        throw new Error(`Image generation failed: ${statusResult.error || 'Unknown error'}`);
      }
    }
    
    if (imageUrl) {
      this.logger.result('✅', `Image generated: ${imageUrl.substring(0, 60)}...`);
    } else {
      this.logger.warn('No image URL found in response');
    }
    
    return { imageUrl, imageHash, imageStatusUrl };
  }

  /**
   * Wait for image to be ready by polling statusUrl or checking if imageUrl is accessible
   */
  private async waitForImageReady(imageUrl: string | null, statusUrl: string | null): Promise<string | null> {
    if (!imageUrl && !statusUrl) {
      return null;
    }

    // If we have a statusUrl, poll it until image is ready
    if (statusUrl) {
      this.logger.info('Waiting for image to be ready (polling status URL)...');
      const statusResult = await this.memeputer.pollStatus(statusUrl, {
        maxAttempts: 120,
        intervalMs: 1000,
        onProgress: (attempt, status) => {
          const elapsedSeconds = attempt - 1;
          if (elapsedSeconds > 0 && elapsedSeconds % 15 === 0) {
            this.logger.info(`   ⏳ Still waiting for image... (${elapsedSeconds}s elapsed, status: ${status.status})`);
          }
        },
      });

      if (statusResult.status === 'completed') {
        const readyUrl = statusResult.imageUrl || statusResult.mediaUrl || imageUrl;
        if (readyUrl) {
          this.logger.result('✅', 'Image is ready');
          return readyUrl;
        }
      } else if (statusResult.status === 'failed') {
        this.logger.error(`Image generation failed: ${statusResult.error || 'Unknown error'}`);
        return null;
      }
    }

    // If no statusUrl or statusUrl didn't return imageUrl, check if imageUrl is accessible
    if (imageUrl) {
      this.logger.info('Checking if image URL is accessible...');
      const axios = (await import('axios')).default;
      const maxAttempts = 30; // 30 seconds max
      const delayMs = 1000;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await axios.head(imageUrl, {
            validateStatus: (status) => status < 500, // Don't throw on 4xx
            timeout: 5000,
          });

          if (response.status === 200) {
            this.logger.result('✅', 'Image URL is accessible');
            return imageUrl;
          }

          // If 404, wait and retry
          if (response.status === 404) {
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
              continue;
            }
          }
        } catch (error) {
          // Network error or timeout - wait and retry
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
        }
      }

      this.logger.warn('Image URL not accessible after waiting');
    }

    return imageUrl; // Return original URL even if not accessible (let describe_image handle it)
  }

  /**
   * Step 7: Describe image using ImageDescripterputer
   */
  private async describeImage(imageUrl: string): Promise<{ description: string | null; data: any }> {
    this.logger.section('Step 7: Describe Image', 'imagedescripterputer');
    
    try {
      const descriptionResult = await this.hireAgentWithCommand('imagedescripterputer', 'describe_image', {
        imageUrl: imageUrl,
        detailLevel: 'detailed',
      });
      
      let statusUrl: string | null = null;
      
      if (descriptionResult.statusUrl) {
        statusUrl = descriptionResult.statusUrl;
      }
      
      if (!statusUrl) {
        try {
          const parsed = JSON.parse(descriptionResult.response);
          statusUrl = parsed.data?.statusUrl || null;
        } catch {
          // Response might not be JSON yet
        }
      }
      
      if (statusUrl) {
        // Use SDK's pollStatus method for proper async handling
        this.logger.info('Image description in progress (async operation)...');
        const statusResult = await this.memeputer.pollStatus(statusUrl, {
          maxAttempts: 120,
          intervalMs: 1000,
          onProgress: (attempt, status) => {
            const elapsedSeconds = attempt - 1;
            if (elapsedSeconds > 0 && elapsedSeconds % 15 === 0) {
              this.logger.info(`   ⏳ Still processing... (${elapsedSeconds}s elapsed, status: ${status.status})`);
            }
          },
        });
        
        if (statusResult.status === 'completed') {
          // Extract description from status result
          let description: string | null = null;
          let data: any = null;
          
          // Try to parse response if it's a string
          if (statusResult.message) {
            try {
              const parsed = JSON.parse(statusResult.message);
              description = parsed.description || parsed.data?.description || statusResult.message;
              data = parsed;
            } catch {
              description = statusResult.message;
              data = { description };
            }
          }
          
          // Also check imageUrl/mediaUrl in case description is there
          if (!description && (statusResult.imageUrl || statusResult.mediaUrl)) {
            // If we got a URL, might need to fetch it or it might be the description
            description = statusResult.imageUrl || statusResult.mediaUrl || null;
          }
          
          if (description) {
            this.logger.result('✅', 'Got image description');
            const preview = description.substring(0, 120);
            this.logger.info(`   ${preview}${description.length > 120 ? '...' : ''}`);
          } else {
            this.logger.warn('Status completed but no description found');
          }
          
          return { description, data: data || { description } };
        } else if (statusResult.status === 'failed') {
          throw new Error(`Image description failed: ${statusResult.error || 'Unknown error'}`);
        } else {
          this.logger.warn(`Unexpected status: ${statusResult.status}`);
          return { description: null, data: null };
        }
      } else {
        try {
          const parsed = JSON.parse(descriptionResult.response);
          const description = parsed.data?.description || null;
          
          if (description) {
            this.logger.result('✅', 'Got image description');
            const preview = description.substring(0, 120);
            this.logger.info(`   ${preview}${description.length > 120 ? '...' : ''}`);
          } else {
            this.logger.warn('No description found in response');
          }
          return { description, data: parsed };
        } catch (parseError) {
          if (descriptionResult.response.includes('Analyzing') || descriptionResult.response.includes('processing')) {
            this.logger.warn('Image description appears async but no statusUrl found');
            this.logger.info('Check backend implementation - statusUrl should be returned');
          } else {
            this.logger.warn(`Failed to parse image description: ${parseError instanceof Error ? parseError.message : parseError}`);
          }
          return { description: null, data: null };
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to describe image: ${errorMessage}`);
      return { description: null, data: null };
    }
  }

  /**
   * Step 8: Write captions using Captionputer
   */
  private async writeCaptions(
    imageDescription: string,
    imagePrompt: string | null,
    trends: any,
    brief: any,
    fixedTask: string,
    brandProfile: any
  ): Promise<{ caption: string | null; captionData: any; captionOptions: any[] }> {
    this.logger.section('Step 8: Write Captions', 'captionputer');
    
    const captionTrendItem = trends?.items?.[0] || {
      title: fixedTask,
      summary: fixedTask,
    };
    
    const numVariants = 3;
    
    try {
      const captionPayload: any = {
        imageDescription: imageDescription,
        imagePrompt: imagePrompt || null,
        trendItem: captionTrendItem,
        brief: brief?.brief || null,
        numVariants,
      };
      
      if (brandProfile.captionPuterOptions?.promptTemplate) {
        captionPayload.customInstructions = brandProfile.captionPuterOptions.promptTemplate;
      }
      
      if (brandProfile.brandAgentId) {
        captionPayload.brandAgentId = brandProfile.brandAgentId;
      } else {
        captionPayload.brandProfile = brandProfile;
      }
      
      const captionResult = await this.hireAgentWithCommand('captionputer', 'generate_captions', captionPayload);
      
      try {
        const parsed = JSON.parse(captionResult.response);
        const captions = parsed.data?.captions || [];
        
        this.logger.info(`CaptionPuter response structure: ${JSON.stringify(Object.keys(parsed))}`);
        this.logger.info(`Found ${captions.length} caption(s) in response`);
        
        if (captions.length > 0) {
          const captionOptions = captions;
          const caption = captions[0]?.text || null;
          const captionData = captions[0] || null;
          
          this.logger.result('✅', `Got ${captions.length} caption option${captions.length > 1 ? 's' : ''}`);
          
          captions.forEach((cap: any, idx: number) => {
            const preview = cap.text?.substring(0, 80) || 'N/A';
            this.logger.info(`   Option ${idx + 1}: ${preview}${cap.text && cap.text.length > 80 ? '...' : ''}`);
          });
          
          if (captions.length === 1 && numVariants > 1) {
            this.logger.warn(`⚠️  Requested ${numVariants} captions but only received 1`);
          }
          
          return { caption, captionData, captionOptions };
        } else {
          this.logger.warn('No captions returned in response');
          this.logger.info(`Full response: ${JSON.stringify(parsed).substring(0, 500)}`);
          return { caption: null, captionData: null, captionOptions: [] };
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse caption response: ${parseError instanceof Error ? parseError.message : parseError}`);
        this.logger.info(`Raw response: ${captionResult.response.substring(0, 500)}`);
        return { caption: null, captionData: null, captionOptions: [] };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate captions: ${errorMessage}`);
      return { caption: null, captionData: null, captionOptions: [] };
    }
  }

  /**
   * Step 9: Broadcast to Telegram using Broadcastputer
   */
  private async broadcastToTelegram(
    imageUrl: string,
    caption: string,
    captionData: any,
    captionOptions: any[],
    selectedTrend: any,
    trends: any,
    brief: any,
    imagePrompt: string | null
  ): Promise<{ telegram?: string }> {
    this.logger.section('Step 9: Broadcast to Telegram', 'broadcastputer');
    
    const telegramChatId = process.env.TELEGRAM_CHAT_ID || process.env.MEMEPUTER_TELEGRAM_CHAT_ID;
    
    if (!telegramChatId) {
      this.logger.warn('Skipping Telegram post (chat ID not configured)');
      return {};
    }
    
    this.logger.info(`Posting to Telegram (Chat ID: ${telegramChatId})`);
    
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
      const telegramResult = await this.hireAgentWithCommand('broadcastputer', 'post_telegram', {
        chatId: telegramChatId,
        caption: enhancedCaption,
        imageUrl: imageUrl || '',
      });
      
      try {
        let responseText = telegramResult.response.trim();
        if (responseText.startsWith('```')) {
          responseText = responseText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }
        
        const parsed = JSON.parse(responseText);
        const messageLink = parsed.data?.messageLink || null;
        
        if (messageLink && typeof messageLink === 'string') {
          this.logger.result('✅', `Posted to Telegram: ${messageLink}`);
          return { telegram: messageLink };
        } else {
          const responseStr = JSON.stringify(parsed);
          const urlMatch = responseStr.match(/https:\/\/t\.me\/[^\s"']+/);
          if (urlMatch) {
            this.logger.result('✅', `Posted to Telegram: ${urlMatch[0]}`);
            return { telegram: urlMatch[0] };
          } else {
            this.logger.warn('Posted to Telegram but no message link found in response');
            return {};
          }
        }
      } catch {
        const urlMatch = telegramResult.response.match(/https:\/\/t\.me\/[^\s"']+/);
        if (urlMatch) {
          this.logger.result('✅', `Posted to Telegram: ${urlMatch[0]}`);
          return { telegram: urlMatch[0] };
        } else if (telegramResult.response.includes('http')) {
          const link = telegramResult.response.trim();
          this.logger.result('✅', `Posted to Telegram: ${link}`);
          return { telegram: link };
        } else {
          this.logger.warn('Unexpected response format from BroadcastPuter');
          return {};
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
      return {};
    }
  }

  /**
   * Build the final task result object
   */
  private buildTaskResult(
    request: TaskRequest,
    trends: any,
    selectedTrend: any,
    brief: any,
    imageUrl: string | null,
    imagePrompt: string | null,
    imageHash: string | null,
    imageStatusUrl: string | null,
    imageDescription: string | null,
    imageDescriptionData: any,
    caption: string | null,
    captionData: any,
    captionOptions: any[],
    postedLinks: { telegram?: string }
  ): TaskResult {
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
          seed: undefined,
          guidance: undefined,
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
  }

  /**
   * Hire an agent with a structured command and track payment
   * 
   * This demonstrates agent-to-agent economy:
   * - The orchestrator agent pays from the provided wallet
   * - Each payment is tracked and deducted from the agent's budget
   * - The actual payment amount comes from the 402 receipt/quote
   */
  private async hireAgentWithCommand(
    agentId: string,
    command: string,
    payload: any
  ): Promise<PromptResult> {
    this.logger.startLoading(`Calling ${agentId}...`);
    
    try {
      // Call agent via SDK with structured command (payment handled internally by SDK)
      // SDK will automatically detect if command needs JSON format or CLI format
      const result = await this.memeputer.command(agentId, command, payload);
      
      this.logger.stopLoading(`Completed ${agentId}`);

      // Track payment if transaction occurred
      if (result.transactionSignature) {
        // Receipt should always be present after payment - quote is only in 402 response before payment
        if (!result.x402Receipt?.amountPaidUsdc) {
          throw new Error(`Payment transaction exists but no receipt amount found for ${agentId}`);
        }
        
        // Use receipt amount (actual paid) - this is what we actually spent
        const actualAmount = result.x402Receipt.amountPaidUsdc;
        
        this.totalSpent += actualAmount;
        this.agentsHired.push(agentId);
        this.payments.push({
          agentId,
          command,
          amount: actualAmount,
          txId: result.transactionSignature,
        });

        // Log payment details - use receipt amount (actual paid) for display
        const payer = result.x402Receipt?.payer || this.wallet.publicKey.toString();
        const merchant = result.x402Receipt?.merchant || result.x402Receipt?.payTo || '';
        const paymentAmount = result.x402Receipt?.amountPaidUsdc || actualAmount;
        
        this.logger.payment({
          agentId,
          amount: paymentAmount,
          transactionSignature: result.transactionSignature,
          txUrl: getTxUrl(result.transactionSignature, this.network),
          fromWallet: payer,
          fromWalletUrl: getAccountUrl(payer, this.network),
          toWallet: merchant,
          toWalletUrl: merchant ? getAccountUrl(merchant, this.network) : undefined,
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
   * Hire an agent with a natural language prompt and track payment
   * 
   * This demonstrates agent-to-agent economy:
   * - The orchestrator agent pays from the provided wallet
   * - Each payment is tracked and deducted from the agent's budget
   * - The actual payment amount comes from the 402 receipt/quote
   */
  private async hireAgentWithPrompt(
    agentId: string,
    prompt: string
  ): Promise<PromptResult> {
    this.logger.startLoading(`Calling ${agentId}...`);
    
    try {
      // Call agent via SDK with natural language prompt (payment handled internally by SDK)
      const result = await this.memeputer.prompt(agentId, prompt);
      
      this.logger.stopLoading(`Completed ${agentId}`);

      // Track payment if transaction occurred
      if (result.transactionSignature) {
        // Receipt should always be present after payment - quote is only in 402 response before payment
        if (!result.x402Receipt?.amountPaidUsdc) {
          throw new Error(`Payment transaction exists but no receipt amount found for ${agentId}`);
        }
        
        // Use receipt amount (actual paid) - this is what we actually spent
        const actualAmount = result.x402Receipt.amountPaidUsdc;
        
        this.totalSpent += actualAmount;
        this.agentsHired.push(agentId);
        this.payments.push({
          agentId,
          command: 'prompt',
          amount: actualAmount,
          txId: result.transactionSignature,
        });

        // Log payment details - use receipt amount (actual paid) for display
        const payer = result.x402Receipt?.payer || this.wallet.publicKey.toString();
        const merchant = result.x402Receipt?.merchant || result.x402Receipt?.payTo || '';
        const paymentAmount = result.x402Receipt?.amountPaidUsdc || actualAmount;
        
        this.logger.payment({
          agentId,
          amount: paymentAmount,
          transactionSignature: result.transactionSignature,
          txUrl: getTxUrl(result.transactionSignature, this.network),
          fromWallet: payer,
          fromWalletUrl: getAccountUrl(payer, this.network),
          toWallet: merchant,
          toWalletUrl: merchant ? getAccountUrl(merchant, this.network) : undefined,
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
   * Step 3: Select Best Trend
   * Uses Trendputer to evaluate trends and select the highest quality option
   * Uses the structured select_best_trend command for reliable JSON parsing
   */
  private async selectBestTrend(trends: any[], task: string): Promise<any | null> {
    if (!trends || trends.length === 0) {
      return null;
    }
    
    // If only one trend, use it (but could still evaluate quality)
    if (trends.length === 1) {
      return trends[0];
    }

    // Extract trend titles for simple format (backend expects trendTitles or trends)
    const trendTitles = trends.map(t => t.title || t.name || String(t)).filter(Boolean);
    
    const commandParams = {
      trendTitles: trendTitles, // Simple format - array of strings
      trends: trends, // Full objects format (takes precedence if backend supports it)
      task: task,
      criteria: ['relevance', 'quality', 'engagement'],
      returnFormat: 'index' as const,
      includeReasoning: true,
    };

    // Log input parameters
    console.log('\n   📋 Trendputer Command Input:');
    console.log(`   Task: "${task}"`);
    console.log(`   Trends: ${trends.length} trends to evaluate`);
    trends.forEach((trend, idx) => {
      console.log(`   ${idx + 1}. "${trend.title || 'Untitled'}" (score: ${trend.score || 'N/A'})`);
    });
    console.log(`   Criteria: ${commandParams.criteria.join(', ')}`);
    console.log('');

    try {
      // Step 3: Select Best Trend - Uses Trendputer command to evaluate trends and select highest quality option
      const result = await this.hireAgentWithCommand('trendputer', 'select_best_trend', commandParams);

      // Log the raw command result for debugging
      console.log('\n   📋 Trendputer Command Result:');
      console.log(`   Response length: ${result.response?.length || 0} characters`);
      console.log(`   Response preview: ${result.response?.substring(0, 500) || 'empty'}${result.response && result.response.length > 500 ? '...' : ''}`);
      if (result.response) {
        try {
          const preview = JSON.parse(result.response);
          console.log(`   ✅ Valid JSON structure:`, JSON.stringify({
            hasData: !!preview.data,
            selectedIndex: preview.data?.selectedIndex,
            hasSelectedTrend: !!preview.data?.selectedTrend,
            hasReasoning: !!preview.data?.reasoning
          }, null, 2));
        } catch {
          console.log(`   ⚠️  Response is not valid JSON`);
        }
      }
      console.log('');

      // Parse response - guaranteed format: { "data": { selectedIndex: number, selectedTrend?: {...}, reasoning?: string } }
      // Handle potential double-wrapping: { "data": { "data": { ... } } }
      try {
        const parsed = JSON.parse(result.response);
        const data = parsed.data?.data || parsed.data; // Handle double-wrapping if present
        const selectedIndex = data?.selectedIndex;
        
        if (selectedIndex !== undefined && selectedIndex >= 0 && selectedIndex < trends.length) {
          const selectedTrend = trends[selectedIndex];
          this.logger.result('✅', `Selected: "${selectedTrend.title || 'Untitled'}"`);
          if (data?.reasoning) {
            this.logger.info(`   Reasoning: ${data.reasoning}`);
          }
          return selectedTrend;
        } else if (selectedIndex === -1 || selectedIndex === null) {
          this.logger.warn('No suitable trend selected by Trendputer');
          return null;
        } else {
          this.logger.error(`Invalid selectedIndex: ${selectedIndex} (expected 0-${trends.length - 1})`);
          return null;
        }
      } catch (parseError) {
        this.logger.error(`Failed to parse trend selection: ${parseError instanceof Error ? parseError.message : parseError}`);
        // Fallback to heuristic-based selection if parsing fails
        this.logger.warn('Falling back to heuristic selection');
        return this.selectBestTrendHeuristic(trends, task);
      }
    } catch (error) {
      // Fallback to heuristic-based selection if AI evaluation fails
      this.logger.warn('Trend selection failed, using heuristic fallback');
      
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
   * Step 1: Extract Keywords
   * Uses Keywordputer to extract relevant keywords from the task
   * Uses the structured keywords command for reliable JSON parsing
   */
  private async whatShouldIFocusOn(task: string): Promise<{
    focusArea: string;
    keywords: string[];
    topics: string[];
    reasoning: string;
  }> {
    const commandParams = {
      text: task,
      context: 'Creating content for Solana community',
      targetAudience: 'Solana degens',
      contentGoal: 'meme',
      maxKeywords: 10,
    };

    // Log input parameters
    console.log('\n   📋 Keywordputer Command Input:');
    console.log(`   Task: "${task}"`);
    console.log(`   Context: ${commandParams.context}`);
    console.log(`   Target Audience: ${commandParams.targetAudience}`);
    console.log(`   Content Goal: ${commandParams.contentGoal}`);
    console.log(`   Max Keywords: ${commandParams.maxKeywords}`);

    try {
      // Step 1: Extract Keywords using Keywordputer command
      const result = await this.hireAgentWithCommand('keywordputer', 'keywords', commandParams);

      // Log the raw command result for debugging
      console.log('\n   📋 Keywordputer Command Result:');
      console.log(`   Response length: ${result.response?.length || 0} characters`);
      console.log(`   Response preview: ${result.response?.substring(0, 500) || 'empty'}${result.response && result.response.length > 500 ? '...' : ''}`);
      if (result.response) {
        try {
          const preview = JSON.parse(result.response);
          console.log(`   ✅ Valid JSON structure:`, JSON.stringify({
            hasData: !!preview.data,
            keywordsCount: preview.data?.keywords?.length || 0,
            keywords: preview.data?.keywords || []
          }, null, 2));
        } catch {
          console.log(`   ⚠️  Response is not valid JSON`);
        }
      }
      console.log('');

      // Parse response - guaranteed format: { "data": { "keywords": [...] } }
      try {
        const parsed = JSON.parse(result.response);
        const keywords = parsed.data?.keywords || [];
        
        this.logger.result('✅', `Extracted ${keywords.length} keywords`);
        if (keywords.length > 0) {
          this.logger.info(`   Keywords: ${keywords.join(', ')}`);
        }
        
        return {
          focusArea: task,
          keywords: keywords,
          topics: keywords.slice(0, 3), // Use first 3 keywords as topics
          reasoning: `Extracted ${keywords.length} keywords from task`,
        };
      } catch (parseError) {
        this.logger.error(`Failed to parse keywords: ${parseError instanceof Error ? parseError.message : parseError}`);
        // Fallback: Extract keywords from task
        const taskKeywords = task.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        return {
          focusArea: task,
          keywords: taskKeywords.slice(0, 5),
          topics: ['crypto', 'tech'],
          reasoning: 'Using task keywords as fallback',
        };
      }
    } catch (error) {
      this.logger.warn('Keyword extraction failed, using fallback');
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
   * Step 5: Enhance Image Prompt
   * Uses Promptputer to refine and enhance the image generation prompt with quality modifiers
   * Uses the structured enhance_prompt command for reliable JSON parsing
   */
  private async enhanceImagePrompt(basePrompt: string): Promise<string> {
    try {
      // Step 5: Enhance Image Prompt - Uses Promptputer to enhance prompt with quality modifiers
      const commandParams = {
        basePrompt: basePrompt,
        qualityModifiers: ['8K', 'cinematic', 'artstation', 'highly detailed', 'professional quality'],
        style: 'artistic',
        detailLevel: 'high',
        includeTechnicalSpecs: true,
        tone: 'dramatic',
      };
      
      // Log input parameters
      console.log('\n   📋 Promptputer Command Input:');
      console.log(`   Base Prompt: ${basePrompt.substring(0, 100)}${basePrompt.length > 100 ? '...' : ''}`);
      console.log(`   Quality Modifiers: ${commandParams.qualityModifiers.join(', ')}`);
      console.log(`   Style: ${commandParams.style}, Detail Level: ${commandParams.detailLevel}, Tone: ${commandParams.tone}`);
      console.log('');
      
      const result = await this.hireAgentWithCommand('promptputer', 'enhance_prompt', commandParams);
      
      // Log the raw command result for debugging
      console.log('\n   📋 Promptputer Command Result:');
      console.log(`   Response length: ${result.response?.length || 0} characters`);
      console.log(`   Response preview: ${result.response?.substring(0, 500) || 'empty'}${result.response && result.response.length > 500 ? '...' : ''}`);
      if (result.response) {
        try {
          const preview = JSON.parse(result.response);
          console.log(`   ✅ Valid JSON structure:`, JSON.stringify({
            hasEnhancedPrompt: !!preview.enhancedPrompt,
            enhancedPromptLength: preview.enhancedPrompt?.length || 0,
            modifiersApplied: preview.modifiersApplied?.length || 0,
            style: preview.style,
            detailLevel: preview.detailLevel,
          }, null, 2));
        } catch {
          console.log(`   ⚠️  Response is not valid JSON`);
        }
      }
      console.log('');

      if (result.transactionSignature) {
        const actualAmount = result.x402Receipt?.amountPaidUsdc || 0.01;
        this.totalSpent += actualAmount;
        this.payments.push({
          agentId: 'promptputer',
          command: 'enhance_prompt',
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
          txUrl: getTxUrl(result.transactionSignature, this.network),
          fromWallet: payer,
          fromWalletUrl: getAccountUrl(payer, this.network),
          toWallet: merchant,
          toWalletUrl: merchant ? getAccountUrl(merchant, this.network) : undefined,
          receiptAmount: result.x402Receipt?.amountPaidUsdc,
        });
      }

      // Parse JSON response - guaranteed to be valid JSON
      try {
        const parsed = JSON.parse(result.response);
        // Handle nested structure: { data: { enhancedPrompt: "...", ... } }
        const data = parsed.data || parsed;
        const enhancedPrompt = data.enhancedPrompt || parsed.enhancedPrompt || result.response;
        this.logger.result('✅', 'Got enhanced prompt');
        
        // Log the enhanced prompt output (human-readable)
        console.log('   📝 Enhanced Prompt Output:');
        console.log(`   ${enhancedPrompt.substring(0, 200)}${enhancedPrompt.length > 200 ? '...' : ''}`);
        const modifiersApplied = data.modifiersApplied || parsed.modifiersApplied;
        if (modifiersApplied && modifiersApplied.length > 0) {
          console.log(`   Modifiers Applied: ${modifiersApplied.join(', ')}`);
        }
        console.log('');
        
        return enhancedPrompt.trim();
      } catch (parseError) {
        // If JSON parsing fails, fall back to raw response
        this.logger.warn('Failed to parse enhanced prompt as JSON, using raw response');
        console.log('   ⚠️  Using raw response (not JSON):');
        console.log(`   ${result.response.substring(0, 200)}${result.response.length > 200 ? '...' : ''}`);
        console.log('');
        return result.response.trim();
      }
    } catch (error) {
      this.logger.warn(`Prompt enhancement failed, using base prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return basePrompt; // Fallback to base prompt
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
    
    // Note: Image prompt is intentionally omitted as it's too long and gets cut off
    // The trend title above provides better context
    
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
   * Get current balance (for monitoring)
   */
  async getBalance(): Promise<number> {
    return getUsdcBalance(this.connection, this.wallet);
  }
}

