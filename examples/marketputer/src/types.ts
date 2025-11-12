import { z } from 'zod';
import { Connection, Keypair } from '@solana/web3.js';

// BrandProfile schema
// If brandAgentId is provided, all other fields come from the agent's profile in Memeputer
// If brandAgentId is not provided, brandName and voice are required
export const BrandProfileSchema = z.object({
  brandAgentId: z.string().optional(), // If provided, use brand agent's profile (all other fields ignored)
  brandName: z.string().optional(), // Required if brandAgentId not provided
  voice: z.string().optional(), // Required if brandAgentId not provided
  personality: z.string().optional(), // Alternative to voice
  targetAudience: z.string().optional(),
  styleKeywords: z.array(z.string()).optional(), // Not needed if brandAgentId provided
  logoUrl: z.string().nullable().optional(),
  allowTerms: z.array(z.string()).optional(), // Not needed if brandAgentId provided
  denyTerms: z.array(z.string()).optional(), // Not needed if brandAgentId provided
  disclaimer: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  emojiPack: z.array(z.string()).optional(), // Not needed if brandAgentId provided
  referenceImageUrls: z.array(z.string().url()).optional(), // Reference image URLs for PFPputer (must be publicly accessible)
  captionPuterOptions: z.object({
    promptTemplate: z.string().optional(), // Custom instructions for CaptionPuter prompt template
  }).optional(), // CaptionPuter-specific options
}).refine(
  (data) => data.brandAgentId || (data.brandName && (data.voice || data.personality)),
  {
    message: "Either brandAgentId or both brandName and voice/personality must be provided",
  }
);

export type BrandProfile = z.infer<typeof BrandProfileSchema>;

// Orchestrator types
export interface OrchestratorConfig {
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

