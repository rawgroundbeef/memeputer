import { Connection, Keypair } from '@solana/web3.js';
import { Memeputer, PromptResult, getUsdcBalance } from '@memeputer/sdk';
import { OrchestratorConfig, TaskRequest, TaskResult } from './types';
import { CleanLogger } from './lib/logger';
import { getSolscanTxUrl, getSolscanAccountUrl, detectNetwork } from './lib/utils';

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

      // Step 1: What's the Plan?
      this.logger.section('Step 1: What\'s the Plan?', 'briefputer');
      this.logger.startLoading('Processing...');
      const focusPlan = await this.whatShouldIFocusOn(fixedTask);
      this.logger.stopLoading();
      this.logger.result('✅', `Focus plan: ${focusPlan.keywords?.length || 0} keywords identified`);
      if (focusPlan.keywords && focusPlan.keywords.length > 0) {
        this.logger.info(`Keywords: ${focusPlan.keywords.join(', ')}`);
      }

      // Step 2: Discover Trends
      const trends = await this.discoverTrends(fixedTask, focusPlan.keywords || []);

      // Step 3: Select Best Trend
      let selectedTrend: any = null;
      if (trends?.items && trends.items.length > 0) {
        this.logger.section('Step 3: Select Best Trend', 'briefputer');
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

      // Step 7: Describe Image
      let imageDescription: string | null = null;
      let imageDescriptionData: any = null;
      if (!imageUrl) {
        this.logger.warn('Skipping image description - no image was generated');
      } else {
        const descriptionResult = await this.describeImage(imageUrl);
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
   */
  private async discoverTrends(fixedTask: string, keywords: string[]): Promise<any> {
    this.logger.section('Step 2: Discover Trends', 'trendputer');
    
    const keywordsContext = keywords.length > 0
      ? ` Focus on: ${keywords.join(', ')}.`
      : '';
    
    const trendPrompt = `Investigate the most compelling news stories of the day.${keywordsContext} Context: ${fixedTask}. Return exactly 10 trends as JSON: {"items": [{"title": "...", "summary": "..."}]}`;
    
    const trendsResult = await this.hireAgent('trendputer', trendPrompt, {});
    
    // Parse trends response
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
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = trendsResult.response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                       trendsResult.response.match(/(\{[\s\S]*"items"[\s\S]*\})/);
      if (jsonMatch) {
        try {
          const trends = JSON.parse(jsonMatch[1]);
          this.logger.result('✅', `Extracted ${trends?.items?.length || 0} trends from markdown`);
          if (trends?.items && trends.items.length > 0) {
            trends.items.forEach((trend: any, idx: number) => {
              console.log(`      ${idx + 1}. ${trend.title || 'Untitled'}`);
              if (trend.summary) {
                console.log(`         ${trend.summary.substring(0, 80)}${trend.summary.length > 80 ? '...' : ''}`);
              }
            });
          }
          return trends;
        } catch {
          this.logger.warn('Failed to parse trends JSON');
        }
      } else {
        this.logger.warn('No trends found in response');
      }
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
      source: 'USER',
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
    
    const briefResult = await this.hireAgent('briefputer', 'generate_brief', briefPayload);
    
    try {
      const parsed = JSON.parse(briefResult.response);
      const brief = parsed.data || parsed;
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
    
    let pfpCommand = `/pfp generate ${enhancedPrompt}`;
    if (brandProfile?.referenceImageUrls && brandProfile.referenceImageUrls.length > 0) {
      pfpCommand += ` --ref-images ${brandProfile.referenceImageUrls.join(' ')}`;
      this.logger.info(`Using ${brandProfile.referenceImageUrls.length} reference image(s)`);
    }
    
    const imageResult = await this.hireAgent('pfpputer', 'pfp', {
      message: pfpCommand,
    });
    
    let imageStatusUrl: string | null = null;
    if (imageResult.statusUrl) {
      imageStatusUrl = imageResult.statusUrl;
    }
    
    let imageUrl = imageResult.imageUrl || imageResult.mediaUrl || null;
    let imageHash: string | null = null;
    
    if (!imageUrl) {
      try {
        const parsed = JSON.parse(imageResult.response);
        imageUrl = parsed.imageUrl || parsed.image_url || parsed.data?.imageUrl || null;
        imageHash = parsed.imageHash || parsed.image_hash || parsed.data?.imageHash || null;
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
   * Step 7: Describe image using ImageDescripterputer
   */
  private async describeImage(imageUrl: string): Promise<{ description: string | null; data: any }> {
    this.logger.section('Step 7: Describe Image', 'imagedescripterputer');
    
    try {
      const descriptionResult = await this.hireAgent('imagedescripterputer', 'describe_image', {
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
          statusUrl = parsed.statusUrl || parsed.data?.statusUrl || null;
        } catch {
          // Response might not be JSON yet
        }
      }
      
      if (statusUrl) {
        let pollingUrl = statusUrl;
        const statusUrlMatch = statusUrl.match(/http:\/\/localhost:(\d+)/);
        const apiBaseMatch = this.apiBase.match(/http:\/\/localhost:(\d+)/);
        
        if (statusUrlMatch && apiBaseMatch) {
          if (statusUrlMatch[1] === apiBaseMatch[1]) {
            pollingUrl = statusUrl.replace(/http:\/\/localhost:\d+/, this.apiBase);
          }
        } else if (statusUrlMatch && !this.apiBase.includes('localhost')) {
          pollingUrl = statusUrl.replace(/http:\/\/localhost:\d+/, this.apiBase);
        }
        
        this.logger.info('Image description in progress...');
        const polledResult = await this.pollImageDescription(pollingUrl);
        
        if (polledResult) {
          try {
            const finalParsed = typeof polledResult === 'string' 
              ? JSON.parse(polledResult)
              : polledResult;
            const description = finalParsed.description || finalParsed.data?.description || null;
            
            if (description) {
              this.logger.result('✅', 'Got image description');
              const preview = description.substring(0, 120);
              this.logger.info(`   ${preview}${description.length > 120 ? '...' : ''}`);
            }
            return { description, data: finalParsed };
          } catch {
            const description = typeof polledResult === 'string' ? polledResult : null;
            if (description) {
              this.logger.result('✅', 'Got image description');
              const preview = description.substring(0, 120);
              this.logger.info(`   ${preview}${description.length > 120 ? '...' : ''}`);
            }
            return { description, data: { description } };
          }
        }
      } else {
        try {
          const parsed = JSON.parse(descriptionResult.response);
          const description = parsed.description || parsed.data?.description || null;
          
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
    
    return { description: null, data: null };
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
      source: 'USER',
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
      
      const captionResult = await this.hireAgent('captionputer', 'generate_captions', captionPayload);
      
      try {
        const parsed = JSON.parse(captionResult.response);
        const captions = parsed.captions || parsed.data?.captions || [];
        
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
      const telegramResult = await this.hireAgent('broadcastputer', 'post_telegram', {
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
        const messageLink = parsed.messageLink || parsed.data?.messageLink || null;
        
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
   * Hire an agent and track payment
   * 
   * Wraps memeputer.prompt() with payment tracking and logging.
   * This demonstrates agent-to-agent economy:
   * - The orchestrator agent pays from the provided wallet
   * - Each payment is tracked and deducted from the agent's budget
   * - The actual payment amount comes from the 402 receipt/quote
   */
  private async hireAgent(
    agentId: string,
    command: string,
    payload: any
  ): Promise<PromptResult> {
    this.logger.startLoading(`Calling ${agentId}...`);
    
    try {
      // Determine if this is a natural language prompt or structured command
      const isNaturalLanguage = Object.keys(payload).length === 0 && command.length > 50;
      
      // Call agent via SDK (payment handled internally by SDK)
      // SDK will automatically detect if command needs JSON format or CLI format
      const result = isNaturalLanguage
        ? await this.memeputer.prompt(agentId, command) // Natural language prompt
        : await this.memeputer.command(agentId, command, payload); // Structured command - SDK handles format
      
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
   * Step 3: Select Best Trend
   * Uses Briefputer to evaluate trends and select the highest quality option
   * Makes autonomous decisions based on relevance and quality
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
      // Step 3: Select Best Trend - Uses Briefputer to evaluate trends and select highest quality option
      const evaluationResult = await this.memeputer.prompt(
        'briefputer',
        evaluationPrompt
      );
      
      // Track this payment - use actual cost from receipt
      if (evaluationResult.transactionSignature) {
        const actualAmount = evaluationResult.x402Receipt?.amountPaidUsdc || 0.01;
        const paymentAmount = evaluationResult.x402Quote?.amountQuotedUsdc || actualAmount;
        this.totalSpent += actualAmount;
        this.agentsHired.push('briefputer');
        this.payments.push({
          agentId: 'briefputer',
          command: 'trend-evaluation',
          amount: actualAmount,
          txId: evaluationResult.transactionSignature,
        });
        
        // Log payment
        const payer = evaluationResult.x402Receipt?.payer || this.wallet.publicKey.toString();
        const merchant = evaluationResult.x402Receipt?.merchant || evaluationResult.x402Receipt?.payTo || '';
        
        this.logger.payment({
          agentId: 'briefputer',
          amount: paymentAmount,
          transactionSignature: evaluationResult.transactionSignature,
          txUrl: getSolscanTxUrl(evaluationResult.transactionSignature, this.network),
          fromWallet: payer,
          fromWalletUrl: getSolscanAccountUrl(payer, this.network),
          toWallet: merchant,
          toWalletUrl: merchant ? getSolscanAccountUrl(merchant, this.network) : undefined,
          receiptAmount: evaluationResult.x402Receipt?.amountPaidUsdc,
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
   * Step 1: What's the Plan?
   * Uses Briefputer to analyze the task and identify relevant keywords and topics
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
      // Step 1: What's the Plan?
      // Use Briefputer to analyze task and identify keywords/topics
      const result = await this.memeputer.prompt('briefputer', prompt);

      if (result.transactionSignature) {
        const actualAmount = result.x402Receipt?.amountPaidUsdc || 0.01;
        const paymentAmount = result.x402Quote?.amountQuotedUsdc || actualAmount;
        this.totalSpent += actualAmount;
        this.payments.push({
          agentId: 'briefputer',
          command: 'what-should-i-focus-on',
          amount: actualAmount,
          txId: result.transactionSignature,
        });
        
        // Log payment
        const payer = result.x402Receipt?.payer || this.wallet.publicKey.toString();
        const merchant = result.x402Receipt?.merchant || result.x402Receipt?.payTo || '';
        
        this.logger.payment({
          agentId: 'briefputer',
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
   * Step 5: Enhance Image Prompt
   * Uses Promptputer to refine and enhance the image generation prompt with quality modifiers
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
      // Step 5: Enhance Image Prompt - Uses Promptputer to enhance prompt with quality modifiers
      const result = await this.memeputer.prompt(
        'promptputer',
        enhancementPrompt
      );

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
   * Get current balance (for monitoring)
   */
  async getBalance(): Promise<number> {
    return getUsdcBalance(this.connection, this.wallet);
  }
}

