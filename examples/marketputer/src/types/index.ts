import { z } from 'zod';

// BrandProfile schema
// If brandAgentId is provided, all other fields come from the agent's profile in Memeputer
// If brandAgentId is not provided, brandName and voice are required
export const BrandProfileSchema = z.object({
  brandAgentId: z.string().optional(), // If provided, use brand agent's profile (all other fields ignored)
  brandName: z.string().optional(), // Required if brandAgentId not provided
  voice: z.string().optional(), // Required if brandAgentId not provided
  styleKeywords: z.array(z.string()).optional(), // Not needed if brandAgentId provided
  logoUrl: z.string().nullable().optional(),
  allowTerms: z.array(z.string()).optional(), // Not needed if brandAgentId provided
  denyTerms: z.array(z.string()).optional(), // Not needed if brandAgentId provided
  disclaimer: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  emojiPack: z.array(z.string()).optional(), // Not needed if brandAgentId provided
  referenceImageUrls: z.array(z.string().url()).optional(), // Reference image URLs for PFPputer (must be publicly accessible)
}).refine(
  (data) => data.brandAgentId || (data.brandName && data.voice),
  {
    message: "Either brandAgentId or both brandName and voice must be provided",
  }
);

export type BrandProfile = z.infer<typeof BrandProfileSchema>;

// TrendItem schema
export const TrendItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  source: z.enum(['DEXSCREENER', 'BIRDEYE', 'RSS', 'X']),
  canonicalUrl: z.string().nullable(),
  score: z.number(),
  hashtags: z.array(z.string()),
});

export type TrendItem = z.infer<typeof TrendItemSchema>;

// X402Receipt schema
export const X402ReceiptSchema = z.object({
  lamports: z.number(),
  txId: z.string(),
  payer: z.string(),
  merchant: z.string(),
});

export type X402Receipt = z.infer<typeof X402ReceiptSchema>;

// Campaign assets
export const CampaignAssetsSchema = z.object({
  imageUrl: z.string().nullable(),
  imageHash: z.string().nullable(),
  caption: z.string().nullable(),
});

export type CampaignAssets = z.infer<typeof CampaignAssetsSchema>;

// Campaign posts
export const CampaignPostsSchema = z.object({
  telegramLink: z.string().nullable(),
  farcasterLink: z.string().nullable(),
  xQueuedId: z.string().nullable(),
});

export type CampaignPosts = z.infer<typeof CampaignPostsSchema>;

// Campaign receipt NFT
export const ReceiptNftSchema = z.object({
  mint: z.string().nullable(),
  explorerUrl: z.string().nullable(),
});

export type ReceiptNft = z.infer<typeof ReceiptNftSchema>;

// X402 receipt entry
export const X402ReceiptEntrySchema = z.object({
  agent: z.string(),
  command: z.string(),
  lamports: z.number(),
  txId: z.string(),
});

export type X402ReceiptEntry = z.infer<typeof X402ReceiptEntrySchema>;

// Campaign schema
export const CampaignSchema = z.object({
  id: z.string(),
  brandProfile: BrandProfileSchema,
  budgetLamports: z.number(),
  selectedTrend: TrendItemSchema.nullable(),
  assets: CampaignAssetsSchema,
  posts: CampaignPostsSchema,
  x402Receipts: z.array(X402ReceiptEntrySchema),
  receiptNft: ReceiptNftSchema,
});

export type Campaign = z.infer<typeof CampaignSchema>;

// Brief schema
export const BriefSchema = z.object({
  angle: z.string(),
  tone: z.string(),
  visualStyle: z.array(z.string()),
  callToAction: z.string(),
  negativeConstraints: z.array(z.string()),
});

export type Brief = z.infer<typeof BriefSchema>;

// Caption schema
export const CaptionSchema = z.object({
  text: z.string(),
  hashtags: z.array(z.string()),
  disclaimer: z.string().nullable(),
  length: z.enum(['SHORT', 'MEDIUM']),
});

export type Caption = z.infer<typeof CaptionSchema>;

// Image generation prompt schema
export const ImagePromptSchema = z.object({
  prompt: z.string(),
  negativePrompt: z.string(),
  seed: z.number().nullable(),
  guidance: z.number(),
});

export type ImagePrompt = z.infer<typeof ImagePromptSchema>;

// Safety check result schema
export const SafetyCheckSchema = z.object({
  pass: z.boolean(),
  issues: z.array(z.enum(['NSFW', 'IP', 'FINANCIAL', 'BRAND_CONFLICT'])),
  redactions: z.array(z.string()),
});

export type SafetyCheck = z.infer<typeof SafetyCheckSchema>;

