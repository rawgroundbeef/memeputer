import { MemeputerClient } from '../sdk/memeputer';
import {
  BrandProfile,
  Campaign,
  TrendItem,
  Brief,
  Caption,
  X402ReceiptEntry,
} from '../types';
import { randomUUID } from 'crypto';

export interface RunCampaignOptions {
  brandProfile: BrandProfile;
  budgetLamports: number;
  channels: ('tg' | 'fc')[];
  sources: ('DEXSCREENER' | 'BIRDEYE' | 'RSS' | 'X')[];
  maxItems?: number;
  seed?: number;
  mockMode?: boolean;
  brandConfigPath?: string; // Path to brand config file (for loading reference images)
}

export interface RunCampaignResult {
  campaign: Campaign;
  success: boolean;
  error?: string;
}

export class Orchestrator {
  private client: MemeputerClient;
  private spentLamports: number = 0;

  constructor(client: MemeputerClient) {
    this.client = client;
  }

  async runCampaign(options: RunCampaignOptions): Promise<RunCampaignResult> {
    const campaignId = randomUUID();
    this.spentLamports = 0;

    const campaign: Campaign = {
      id: campaignId,
      brandProfile: options.brandProfile,
      budgetLamports: options.budgetLamports,
      selectedTrend: null,
      assets: {
        imageUrl: null,
        imageHash: null,
        caption: null,
      },
      posts: {
        telegramLink: null,
        farcasterLink: null,
        xQueuedId: null,
      },
      x402Receipts: [],
      receiptNft: {
        mint: null,
        explorerUrl: null,
      },
    };

    try {
      // Step 1: Get trends
      console.log('📊 Fetching trends...');
      
      // Filters disabled for now - fetch random trending news
      console.log('🎲 No filter - fetching random trending news');
      
      const trendsResponse = await this.client.getTrends({
        sources: options.sources,
        maxItems: options.maxItems || 20,
        includeHashtags: true,
        filter: undefined, // Filters disabled
      });
      this.addReceipt(campaign, 'trendputer', 'get_trends', trendsResponse.x402Receipt);

      if (trendsResponse.items.length === 0) {
        return {
          campaign,
          success: false,
          error: 'No trends found matching criteria',
        };
      }

      // Step 2: Select random trend for variety
      const selectedTrend = this.selectRandomTrend(
        trendsResponse.items,
        options.brandProfile
      );
      campaign.selectedTrend = selectedTrend;
      console.log(`\n📰 Selected Trend:`);
      console.log(`   Title: ${selectedTrend.title}`);
      console.log(`   Summary: ${selectedTrend.summary}`);
      console.log(`   Source: ${selectedTrend.source}`);
      console.log(`   Score: ${selectedTrend.score}`);
      if (selectedTrend.hashtags.length > 0) {
        console.log(`   Hashtags: ${selectedTrend.hashtags.join(', ')}`);
      }
      if (selectedTrend.canonicalUrl) {
        console.log(`   Link: ${selectedTrend.canonicalUrl}`);
      }

      // Step 3: Generate brief
      console.log('📝 Generating creative brief...');
      const briefResponse = await this.client.generateBrief({
        brandProfile: options.brandProfile.brandAgentId ? undefined : options.brandProfile, // Only pass if not using brandAgentId
        brandAgentId: options.brandProfile.brandAgentId, // Pass brandAgentId if provided
        trendItem: selectedTrend,
        policy: {
          denyTerms: options.brandProfile.denyTerms || [], // Use empty array if not provided
          requireDisclaimer: selectedTrend.source === 'DEXSCREENER' || selectedTrend.source === 'BIRDEYE',
        },
      });
      this.addReceipt(campaign, 'briefputer', 'generate_brief', briefResponse.x402Receipt);

      const brief = briefResponse.brief;
      console.log(`\n📝 Creative Brief:`);
      console.log(`   Angle: ${brief.angle}`);
      console.log(`   Tone: ${brief.tone}`);
      console.log(`   Visual Style: ${brief.visualStyle.join(', ')}`);
      console.log(`   CTA: ${brief.callToAction}`);

      // Step 4: Generate PFP prompt
      console.log('🎨 Generating image prompt...');
      const promptResponse = await this.client.generatePfpPrompt({
        brandProfile: options.brandProfile.brandAgentId ? undefined : options.brandProfile, // Only pass if not using brandAgentId
        brandAgentId: options.brandProfile.brandAgentId, // Pass brandAgentId if provided
        brief,
        imageConstraints: {
          aspectRatio: '1:1',
          elements: ['logo optional', 'brand colors optional'],
        },
      });
      this.addReceipt(campaign, 'briefputer', 'generate_pfp_prompt', promptResponse.x402Receipt);
      console.log(`\n🎨 Image Prompt:`);
      console.log(`   Prompt: ${promptResponse.prompt.substring(0, 150)}...`);
      console.log(`   Seed: ${promptResponse.seed || 'random'}, Guidance: ${promptResponse.guidance}`);

      // Step 5: Generate captions
      console.log('✍️  Generating captions...');
      const captionsResponse = await this.client.generateCaptions({
        brandProfile: options.brandProfile.brandAgentId ? undefined : options.brandProfile, // Only pass if not using brandAgentId
        brandAgentId: options.brandProfile.brandAgentId, // Pass brandAgentId if provided
        trendItem: selectedTrend,
        brief,
        numVariants: 3,
        includeHashtags: true,
        includeDisclaimer: briefResponse.brief.visualStyle.includes('financial') || selectedTrend.source !== 'RSS',
      });
      this.addReceipt(campaign, 'briefputer', 'generate_captions', captionsResponse.x402Receipt);

      // Step 6: Create image
      console.log('🖼️  Creating meme image...');
      
      // Get reference image URLs from brand profile (must be publicly accessible URLs)
      const referenceImageUrls = options.brandProfile.referenceImageUrls || [];
      if (referenceImageUrls.length > 0) {
        console.log(`   Using ${referenceImageUrls.length} reference image URL(s) from brand config`);
        referenceImageUrls.forEach((url, idx) => {
          console.log(`     ${idx + 1}. ${url}`);
        });
      }
      
      const imageResponse = await this.client.createMemeImage({
        prompt: promptResponse.prompt,
        negativePrompt: promptResponse.negativePrompt, // Not used by PFPputer but kept for interface compatibility
        seed: options.seed || null, // Not used by PFPputer but kept for interface compatibility
        aspectRatio: '1:1', // Not used by PFPputer but kept for interface compatibility
        referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      });
      this.addReceipt(campaign, 'pfpputer', 'pfp', imageResponse.x402Receipt);
      campaign.assets.imageUrl = imageResponse.imageUrl;
      campaign.assets.imageHash = imageResponse.imageHash;

      // Step 7: Select caption (skip safety check for now)
      // Just use the first caption - can add safety checks later if needed
      const selectedCaption = captionsResponse.captions[0];
      if (!selectedCaption) {
        return {
          campaign,
          success: false,
          error: 'No captions generated',
        };
      }
      campaign.assets.caption = selectedCaption.text;
      console.log(`\n✍️  Selected Caption:`);
      console.log(`   ${selectedCaption.text}`);
      if (selectedCaption.hashtags.length > 0) {
        console.log(`   Hashtags: ${selectedCaption.hashtags.join(', ')}`);
      }

      // Step 8: Broadcast to Telegram (direct API call, no agent needed)
      if (!campaign.assets.caption || !campaign.assets.imageUrl) {
        return {
          campaign,
          success: false,
          error: 'Missing caption or image',
        };
      }

      if (options.channels.includes('tg')) {
        console.log('📱 Posting to Telegram...');
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        // Default to Memeputer group if not specified
        const telegramChatId = process.env.TELEGRAM_CHAT_ID || process.env.MEMEPUTER_TELEGRAM_CHAT_ID;
        
        if (telegramToken && telegramChatId) {
          // Build enhanced caption with context (selectedTrend, brief, promptResponse are in scope)
          const enhancedCaption = this.buildTelegramCaption(
            campaign.assets.caption!,
            selectedTrend,
            brief,
            promptResponse.prompt,
            promptResponse.seed,
            promptResponse.guidance
          );
          
          const telegramLink = await this.postToTelegram(
            telegramToken,
            telegramChatId,
            enhancedCaption,
            campaign.assets.imageUrl!
          );
          campaign.posts.telegramLink = telegramLink;
          console.log(`✅ Posted to Telegram: ${telegramLink}`);
        } else {
          console.log('⚠️  Telegram credentials not configured, skipping');
          console.log('   Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (or MEMEPUTER_TELEGRAM_CHAT_ID) to enable');
        }
      }

      if (options.channels.includes('fc')) {
        console.log('🔷 Posting to Farcaster...');
        const neynarApiKey = process.env.NEYNAR_API_KEY;
        const farcasterFid = process.env.FARCASTER_FID;
        
        if (neynarApiKey && farcasterFid) {
          const farcasterResponse = await this.client.postFarcaster({
            neynarApiKey,
            fid: parseInt(farcasterFid, 10),
            caption: campaign.assets.caption,
            imageUrl: campaign.assets.imageUrl,
          });
          this.addReceipt(campaign, 'broadcastputer', 'post_farcaster', farcasterResponse.x402Receipt);
          campaign.posts.farcasterLink = farcasterResponse.castUrl;
          console.log(`✅ Posted to Farcaster: ${farcasterResponse.castUrl}`);
        } else {
          console.log('⚠️  Farcaster credentials not configured, skipping');
        }
      }

      // Step 9: Optional NFT receipt (skipped by default for speed)
      // Can be done separately with: marketputer mint-receipt --run <file>

      console.log(`\n✅ Campaign completed! Total spent: ${this.spentLamports} lamports`);
      return {
        campaign,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Campaign failed: ${errorMessage}`);
      return {
        campaign,
        success: false,
        error: errorMessage,
      };
    }
  }

  private selectRandomTrend(trends: TrendItem[], brandProfile: BrandProfile): TrendItem {
    // Select random trend for variety (instead of always picking highest score)
    const randomIndex = Math.floor(Math.random() * trends.length);
    return trends[randomIndex];
  }


  private addReceipt(
    campaign: Campaign,
    agent: string,
    command: string,
    receipt: { lamports: number; txId: string }
  ): void {
    campaign.x402Receipts.push({
      agent,
      command,
      lamports: receipt.lamports,
      txId: receipt.txId,
    });
    this.spentLamports += receipt.lamports;
  }

  private buildTelegramCaption(
    caption: string,
    trend: TrendItem,
    brief: Brief,
    prompt: string,
    promptSeed?: number | null,
    promptGuidance?: number
  ): string {
    // Build a rich caption with context
    let enhanced = caption;
    
    // Add separator and trend context
    enhanced += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    enhanced += `📰 <b>Trend:</b> ${trend.title}\n`;
    enhanced += `📝 ${trend.summary.substring(0, 200)}${trend.summary.length > 200 ? '...' : ''}\n`;
    
    if (trend.hashtags.length > 0) {
      enhanced += `🏷️ ${trend.hashtags.slice(0, 3).join(' ')}\n`;
    }
    
    // Add brief context
    enhanced += `\n💡 <b>Creative Angle:</b> ${brief.angle.substring(0, 150)}${brief.angle.length > 150 ? '...' : ''}\n`;
    
    // Add image prompt
    enhanced += `\n🎨 <b>Image Prompt:</b>\n`;
    enhanced += `<code>${prompt.substring(0, 300)}${prompt.length > 300 ? '...' : ''}</code>\n`;
    if (promptSeed !== null && promptSeed !== undefined) {
      enhanced += `🌱 Seed: ${promptSeed}`;
    }
    if (promptGuidance !== undefined) {
      enhanced += ` | Guidance: ${promptGuidance}`;
    }
    enhanced += `\n`;
    
    // Add source link if available
    if (trend.canonicalUrl) {
      enhanced += `\n🔗 <a href="${trend.canonicalUrl}">Read more</a>\n`;
    }
    
    return enhanced;
  }

  private async postToTelegram(
    botToken: string,
    chatId: string,
    caption: string,
    imageUrl: string
  ): Promise<string> {
    const axios = (await import('axios')).default;
    
    try {
      // Download image first (Telegram API requires file upload or file_id)
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      
      const imageBuffer = Buffer.from(imageResponse.data);
      
      // Use FormData to upload image with caption
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('photo', imageBuffer, {
        filename: 'image.png',
        contentType: 'image/png',
      });
      form.append('caption', caption);
      form.append('parse_mode', 'HTML'); // Support HTML formatting
      
      // Post to Telegram Bot API
      const response = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendPhoto`,
        form,
        {
          headers: form.getHeaders(),
          timeout: 30000,
        }
      );
      
      const message = response.data.result;
      const messageId = message.message_id;
      
      // Generate message link
      // Format: https://t.me/c/{chat_id}/{message_id}
      // For groups: chat_id is negative, remove the minus sign
      const chatIdNum = chatId.startsWith('-') ? chatId.substring(1) : chatId;
      const messageLink = `https://t.me/c/${chatIdNum}/${messageId}`;
      
      return messageLink;
    } catch (error: any) {
      console.error('❌ Failed to post to Telegram:', error.message);
      if (error.response) {
        console.error('   Telegram API error:', JSON.stringify(error.response.data, null, 2));
      }
      throw new Error(`Failed to post to Telegram: ${error.message}`);
    }
  }
}

