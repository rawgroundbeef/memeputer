import { z } from 'zod';

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
}).refine(
  (data) => data.brandAgentId || (data.brandName && (data.voice || data.personality)),
  {
    message: "Either brandAgentId or both brandName and voice/personality must be provided",
  }
);

export type BrandProfile = z.infer<typeof BrandProfileSchema>;

