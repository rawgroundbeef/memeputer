# Marketputer

**Your autonomous marketing assistant that creates meme-ready posts in your brand's style.**

Marketputer is an AI agent that autonomously discovers trending topics, generates creative briefs, creates images, writes captions, and posts to social media—all in your brand's voice and style. It uses other specialized AI agents and pays them automatically via x402 micropayments on Solana, so you get professional marketing content without lifting a finger.

## How Does It Work?

You fund a Solana wallet with USDC, set a budget, and Marketputer follows a structured workflow coordinating multiple specialized AI agents to create your content. It pays each agent what they charge in microtransactions using x402—you just set the budget and let it run.

## The Workflow

Marketputer follows a structured workflow, coordinating multiple specialized AI agents to create your content. Each agent charges their own rate for their services, and Marketputer pays them automatically using x402 micropayments—you just set the budget and let it run.

**Step 1: Extract Keywords**
- Uses **[Keywordputer](https://agents.memeputer.com/discover/keywordputer)** with command `keywords` and parameters: `text`, `context`, `targetAudience`, `contentGoal`, `maxKeywords`
- Analyzes your task and identifies relevant keywords and topics

**Step 2: Discover Trends**
- Uses **[Trendputer](https://agents.memeputer.com/discover/trendputer)** with command `discover_trends` and parameters: `keywords`, `context`, `maxResults`, `includeHashtags`, `includeUrl`
- Investigates news stories and returns trends as JSON

**Step 3: Select Best Trend**
- Uses **[Trendputer](https://agents.memeputer.com/discover/trendputer)** with command `select_best_trend` and parameters: `trendTitles`, `trends`, `task`, `criteria`, `returnFormat`, `includeReasoning`
- Evaluates trends and selects the highest quality option based on relevance and quality

**Step 4: Create Creative Brief**
- Uses **[Briefputer](https://agents.memeputer.com/discover/briefputer)** with command `generate_brief` and parameters: `trendItem`, `brandProfile`/`brandAgentId`, `policy`
- Generates a strategic creative brief with angle, tone, and visual style tailored to your brand's voice

**Step 5: Enhance Image Prompt**
- Uses **[Promptputer](https://agents.memeputer.com/discover/promptputer)** with command `enhance_prompt` and parameters: `basePrompt`, `qualityModifiers`, `style`, `detailLevel`, `includeTechnicalSpecs`, `tone`
- Takes the `angle` string from the creative brief (e.g., "while markets obsess over volatility, agents optimize for composability") as the `basePrompt`
- Enhances it with quality modifiers (8K render, cinematic lighting, etc.) to create a detailed image generation prompt

**Step 6: Generate Image**
- Uses **[PFPputer](https://agents.memeputer.com/discover/pfpputer)** with command `pfp_with_reference` (if reference images provided) or `pfp` (otherwise)
- Parameters: `reference_image_urls` (array), `prompt` (optional) for `pfp_with_reference`, or array of prompt strings for `pfp`
- Creates the meme-ready image
- **Note:** PFPputer returns an async response with `statusUrl` for polling - the image may not be ready immediately

**Step 7: Describe Image**
- Uses **[ImageDescripterputer](https://agents.memeputer.com/discover/imagedescripterputer)** with command `describe_image` and parameters: `imageUrl`, `detailLevel: "detailed"`
- Analyzes and describes the generated image

**Step 8: Write Captions**
- Uses **[Captionputer](https://agents.memeputer.com/discover/captionputer)** with command `generate_captions` and parameters: `imageDescription`, `imagePrompt`, `trendItem`, `brief`, `brandProfile`/`brandAgentId`, `numVariants`, `customInstructions`
- Generates multiple caption options in your brand's tone

**Step 9: Broadcast to Telegram**
- Uses **[Broadcastputer](https://agents.memeputer.com/discover/broadcastputer)** with command `post_telegram` and parameters: `chatId`, `caption`, `imageUrl`
- Posts the final content to Telegram

Each step happens automatically—Marketputer coordinates the agents, handles payments, and delivers your content.

## Using Briefputer in Your Application

Briefputer's `generate_brief` command requires specific payload structures. Here are complete examples:

### Command Structure

```typescript
await memeputer.command('briefputer', 'generate_brief', {
  trendItem: { /* trend object */ },
  policy: { /* policy object */ },
  brandAgentId: 'optional-uuid', // OR brandProfile (not both)
  brandProfile: { /* brand profile object */ } // OR brandAgentId (not both)
});
```

### Required Parameters

#### 1. `trendItem` (object, required)
A trend object from Trendputer's `discover_trends` or `select_best_trend` command:

```json
{
  "id": "trend-123",
  "title": "Solana NFT Marketplace Hits 1M Users",
  "summary": "The Solana NFT marketplace has reached a major milestone...",
  "score": 8.5,
  "hashtags": ["#Solana", "#NFT", "#Web3"],
  "canonicalUrl": "https://example.com/news/solana-nft-milestone"
}
```

**Minimum required fields:** At least `title` and `summary`. Other fields are optional but recommended.

#### 2. `policy` (object, required)
Content policy with deny terms and disclaimer requirements:

```json
{
  "denyTerms": ["nsfw", "scam", "gambling"],
  "requireDisclaimer": false
}
```

- `denyTerms` (array of strings): Terms/topics to avoid in generated content
- `requireDisclaimer` (boolean): Whether to require a disclaimer in the brief

### Brand Options (Choose One)

#### Option A: Use `brandAgentId` (recommended if you have a brand agent)

```typescript
{
  trendItem: { /* ... */ },
  policy: { /* ... */ },
  brandAgentId: "5ca90eb4-dda0-400f-bb90-898dcf467d4c"
}
```

The brand agent's profile (voice, style, etc.) will be fetched automatically.

#### Option B: Use `brandProfile` (custom brand)

```typescript
{
  trendItem: { /* ... */ },
  policy: { /* ... */ },
  brandProfile: {
    "brandName": "My Brand",
    "voice": "professional, trustworthy, innovative",
    "styleKeywords": ["modern", "fintech", "clean"],
    "denyTerms": ["nsfw", "scam"],
    "targetAudience": "Solana degens",
    "personality": "fun, crypto-native"
  }
}
```

**Required fields for `brandProfile`:**
- `brandName` (string)
- `voice` (string) OR `personality` (string)

**Optional fields:**
- `styleKeywords` (array of strings)
- `denyTerms` (array of strings)
- `targetAudience` (string)
- `logoUrl` (string)
- `primaryColor` (string)
- `emojiPack` (array of strings)
- `disclaimer` (string)

### Complete Example

```typescript
import { Memeputer } from '@memeputer/sdk';

const memeputer = new Memeputer({
  apiUrl: 'https://api.memeputer.com',
  wallet: yourWallet,
  connection: yourConnection
});

// Example 1: Using brandAgentId
const brief1 = await memeputer.command('briefputer', 'generate_brief', {
  trendItem: {
    title: "Solana NFT Marketplace Hits 1M Users",
    summary: "The Solana NFT marketplace has reached a major milestone with 1 million active users.",
    score: 8.5,
    hashtags: ["#Solana", "#NFT"],
    canonicalUrl: "https://example.com/news"
  },
  policy: {
    denyTerms: ["nsfw", "scam"],
    requireDisclaimer: false
  },
  brandAgentId: "5ca90eb4-dda0-400f-bb90-898dcf467d4c"
});

// Example 2: Using custom brandProfile
const brief2 = await memeputer.command('briefputer', 'generate_brief', {
  trendItem: {
    title: "Solana NFT Marketplace Hits 1M Users",
    summary: "The Solana NFT marketplace has reached a major milestone with 1 million active users."
  },
  policy: {
    denyTerms: ["nsfw", "scam", "gambling"],
    requireDisclaimer: true
  },
  brandProfile: {
    brandName: "My Brand",
    voice: "professional, trustworthy",
    styleKeywords: ["modern", "clean"],
    denyTerms: ["nsfw"],
    targetAudience: "Solana developers"
  }
});

// Parse the response
const parsed = JSON.parse(brief1.response);
const creativeBrief = parsed.data.brief;
console.log('Angle:', creativeBrief.angle);
console.log('Tone:', creativeBrief.tone);
console.log('Visual Style:', creativeBrief.visualStyle);
```

### Response Structure

Briefputer returns a JSON response with this structure:

```json
{
  "data": {
    "brief": {
      "angle": "Focus on the milestone achievement...",
      "tone": "celebratory, professional",
      "visualStyle": ["modern", "clean", "professional"],
      "callToAction": "Join the Solana NFT community...",
      "negativeConstraints": ["avoid financial advice", "no gambling references"]
    }
  }
}
```

## Using Promptputer in Your Application

Promptputer's `enhance_prompt` command takes a base prompt string and enhances it with quality modifiers for image generation.

### Command Structure

```typescript
await memeputer.command('promptputer', 'enhance_prompt', {
  basePrompt: "your base prompt string",
  qualityModifiers: ["8K", "cinematic", "artstation"],
  style: "artistic",
  detailLevel: "high",
  includeTechnicalSpecs: true,
  tone: "dramatic"
});
```

### Parameters

#### 1. `basePrompt` (string, required)
The base prompt to enhance. In Marketputer's workflow, this is the `angle` field from Briefputer's response.

**Example:**
```typescript
// After getting brief from Briefputer:
const briefResponse = await memeputer.command('briefputer', 'generate_brief', { /* ... */ });
const parsed = JSON.parse(briefResponse.response);
const briefAngle = parsed.data.brief.angle;
// "while markets obsess over volatility, agents optimize for composability - building utility when others build anxiety"

// Use this as basePrompt:
const enhanced = await memeputer.command('promptputer', 'enhance_prompt', {
  basePrompt: briefAngle, // <-- Just the angle string, not the whole brief
  // ... other params
});
```

#### 2. `qualityModifiers` (array of strings, optional)
Quality enhancement terms to add to the prompt.

**Default:** `["8K", "cinematic", "artstation", "highly detailed", "professional quality"]`

**Example:**
```typescript
qualityModifiers: ["8K", "cinematic", "artstation", "highly detailed", "professional quality"]
```

#### 3. `style` (string, optional)
Visual style descriptor.

**Default:** `"artistic"`

**Example:** `"artistic"`, `"realistic"`, `"minimalist"`, etc.

#### 4. `detailLevel` (string, optional)
Level of detail in the enhanced prompt.

**Default:** `"high"`

**Example:** `"high"`, `"medium"`, `"low"`

#### 5. `includeTechnicalSpecs` (boolean, optional)
Whether to include technical specifications (lighting, composition, etc.).

**Default:** `true`

#### 6. `tone` (string, optional)
Tone/mood for the prompt.

**Default:** `"dramatic"`

**Example:** `"dramatic"`, `"calm"`, `"energetic"`, etc.

### Complete Example

```typescript
import { Memeputer } from '@memeputer/sdk';

const memeputer = new Memeputer({
  apiUrl: 'https://api.memeputer.com',
  wallet: yourWallet,
  connection: yourConnection
});

// Step 1: Get brief from Briefputer
const briefResult = await memeputer.command('briefputer', 'generate_brief', {
  trendItem: { title: "...", summary: "..." },
  policy: { denyTerms: [], requireDisclaimer: false },
  brandAgentId: "5ca90eb4-dda0-400f-bb90-898dcf467d4c"
});

const brief = JSON.parse(briefResult.response);
const briefAngle = brief.data.brief.angle;
// "while markets obsess over volatility, agents optimize for composability..."

// Step 2: Enhance the angle with Promptputer
const enhancedResult = await memeputer.command('promptputer', 'enhance_prompt', {
  basePrompt: briefAngle, // <-- Just the angle string
  qualityModifiers: ['8K', 'cinematic', 'artstation', 'highly detailed'],
  style: 'artistic',
  detailLevel: 'high',
  includeTechnicalSpecs: true,
  tone: 'dramatic'
});

// Step 3: Parse enhanced prompt
const enhanced = JSON.parse(enhancedResult.response);
const imagePrompt = enhanced.enhancedPrompt || enhanced.data?.enhancedPrompt;
// Enhanced prompt ready for image generation
```

### Response Structure

Promptputer returns a JSON response with this structure:

```json
{
  "enhancedPrompt": "8K render, cinematic lighting, artstation quality, highly detailed professional quality image of: while markets obsess over volatility, agents optimize for composability - building utility when others build anxiety. Dramatic tone, artistic style...",
  "modifiersApplied": ["8K", "cinematic", "artstation", "highly detailed", "professional quality"],
  "style": "artistic",
  "detailLevel": "high",
  "tone": "dramatic"
}
```

**Note:** The response may be nested under a `data` key: `response.data.enhancedPrompt`

## Using PFPputer in Your Application

PFPputer's `pfp` or `pfp_with_reference` command generates images asynchronously. After payment, you receive a response with a `statusUrl` to poll for completion.

### Command Structure

```typescript
// Option 1: Regular pfp command (no reference images)
await memeputer.command('pfpputer', 'pfp', ['your prompt here']);

// Option 2: pfp_with_reference command (with reference images)
await memeputer.command('pfpputer', 'pfp_with_reference', {
  reference_image_urls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
  prompt: 'your optional prompt here'
});
```

### Exact Response Structure (x402 Spec)

After payment, PFPputer returns an `InteractionResult` object following the x402 specification:

```typescript
{
  x402Version?: number;           // x402 protocol version (backend may include)
  success: boolean;                // true if payment succeeded
  response: string;                // Human-readable message (e.g., "🎨 Your PFP is being generated! This usually takes 10-15 seconds...")
  format: "text" | "image" | "video" | "audio";  // Response format
  statusUrl?: string;             // URL to poll for async operation status (REQUIRED for async operations)
  imageUrl?: string;               // Direct image URL (may be available immediately or after polling)
  mediaUrl?: string;               // Alternative media URL field
  etaSeconds?: number;             // Estimated time to completion in seconds (e.g., 15)
  transactionSignature: string;    // Solana transaction signature or EVM transaction hash
  agentId: string;                 // Agent ID (e.g., "pfpputer")
  timestamp?: string;               // ISO timestamp (backend may include)
  x402Receipt: {                   // Payment receipt (REQUIRED after payment)
    amountPaidUsdc: number;        // Actual amount paid in USDC (e.g., 0.03)
    amountPaidMicroUsdc: number;   // Amount paid in micro-USDC (e.g., 30000)
    payTo: string;                 // Recipient wallet address
    transactionSignature: string;  // Transaction signature/hash
    payer: string;                 // Payer wallet address
    merchant: string;               // Merchant wallet address (usually same as payTo)
    timestamp: string;              // ISO timestamp of payment
  },
  x402Quote?: {                    // Payment quote details (optional, for reference)
    amountQuotedUsdc: number;      // Quoted amount in USDC
    amountQuotedMicroUsdc: number; // Quoted amount in micro-USDC
    maxAmountRequired: number;      // Maximum amount required
  }
}
```

### Complete Example Response

Here's an exact example of what PFPputer returns:

```json
{
  "x402Version": 1,
  "success": true,
  "response": "🎨 Your PFP is being generated! This usually takes 10-15 seconds...",
  "format": "text",
  "statusUrl": "https://api.memeputer.com/api/public/pfp/status/802a8ada-47d5-47a1-9821-3f3a5cebd4c5",
  "imageUrl": "https://auth.memeputer.com/storage/v1/object/public/generated-images/pfp/generated/802a8ada-47d5-47a1-9821-3f3a5cebd4c5.png",
  "etaSeconds": 15,
  "transactionSignature": "34hB3L9dN89uDrtBn9WLqNFcRob3jPvmBYzzwKGkH9MswxuQ6EJBR5m3fJiVseJCHQnaEduQssn9gsmzcDfZdH9Y",
  "agentId": "pfpputer",
  "timestamp": "2025-11-27T22:55:18.143Z",
  "x402Receipt": {
    "amountPaidUsdc": 0.03,
    "amountPaidMicroUsdc": 30000,
    "payTo": "7xKXtg2CZ3q5vLxKvKvKvKvKvKvKvKvKvKvKvKvKvKvKv",
    "transactionSignature": "34hB3L9dN89uDrtBn9WLqNFcRob3jPvmBYzzwKGkH9MswxuQ6EJBR5m3fJiVseJCHQnaEduQssn9gsmzcDfZdH9Y",
    "payer": "YourWalletAddressHere",
    "merchant": "7xKXtg2CZ3q5vLxKvKvKvKvKvKvKvKvKvKvKvKvKvKvKv",
    "timestamp": "2025-11-27T22:55:18.143Z"
  }
}
```

### Handling Async Responses

PFPputer images are generated asynchronously. You have two options:

**Option 1: Use `imageUrl` if available immediately**
```typescript
const result = await memeputer.command('pfpputer', 'pfp', ['your prompt']);
if (result.imageUrl) {
  // Image is ready!
  console.log('Image URL:', result.imageUrl);
} else if (result.statusUrl) {
  // Need to poll for completion
  const status = await memeputer.pollStatus(result.statusUrl);
  if (status.status === 'completed' && status.imageUrl) {
    console.log('Image URL:', status.imageUrl);
  }
}
```

**Option 2: Always poll `statusUrl` (recommended)**
```typescript
const result = await memeputer.command('pfpputer', 'pfp', ['your prompt']);

if (result.statusUrl) {
  const status = await memeputer.pollStatus(result.statusUrl, {
    maxAttempts: 120,  // 2 minutes max
    intervalMs: 1000, // Check every second
    onProgress: (attempt, status) => {
      console.log(`Attempt ${attempt}: ${status.status}`);
    }
  });
  
  if (status.status === 'completed' && status.imageUrl) {
    console.log('✅ Image ready:', status.imageUrl);
  } else if (status.status === 'failed') {
    console.error('❌ Generation failed:', status.error);
  }
}
```

### Important Notes

1. **`statusUrl` is required** for async operations - always check for it
2. **`imageUrl` may be present immediately** but may not be accessible until generation completes
3. **Always poll `statusUrl`** if `imageUrl` is not accessible (404) or missing
4. **`x402Receipt` is required** after payment - use `amountPaidUsdc` for accurate cost tracking
5. **`transactionSignature`** is the Solana transaction signature or EVM transaction hash
6. **`format`** is typically `"text"` for async operations, even when generating images

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment (Optional)

The example will automatically use your default Solana CLI wallet at `~/.config/solana/id.json` if you don't set `MEMEPUTER_WALLET`.

To use a different wallet, copy the example environment file:

```bash
cp .env.example .env
```

Then edit `.env` and set `MEMEPUTER_WALLET` to your wallet file path:

```bash
# Use default Solana CLI wallet (leave empty)
MEMEPUTER_WALLET=

# Or specify a custom path
MEMEPUTER_WALLET=./wallet.json
# or
MEMEPUTER_WALLET=~/.config/solana/id.json
```

### 3. Set Up Your Wallet

You need a Solana wallet with USDC. Choose one:

**Option A: Use existing Phantom wallet**
```bash
# Export your Phantom wallet:
# 1. Open Phantom browser extension
# 2. Settings → Export Private Key
# 3. Save as wallet.json in this directory
```

**Option B: Create new wallet with Solana CLI**
```bash
# Install Solana CLI (if needed)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate new wallet
solana-keygen new --outfile wallet.json

# Fund with USDC (get address with: solana address -k wallet.json)
```

### 4. Run the Example

```bash
pnpm start run --budget 1.0
```

That's it! The orchestrator will:
- Load your wallet
- Coordinate multiple agents
- Pay each agent automatically via x402
- Complete the full workflow end-to-end

The orchestrator will:
1. Pay Keywordputer to extract keywords
2. Pay Trendputer to find trends
3. Pay Trendputer to select best trend
4. Pay Briefputer to generate brief
5. Pay Promptputer to enhance prompt
6. Pay PFPputer to generate image
7. Pay ImageDescripterputer to describe image
8. Pay Captionputer to generate captions
9. Pay Broadcastputer to post to Telegram

```bash
# Use default Solana CLI wallet (leave empty)
MEMEPUTER_WALLET=

# Or specify custom wallet path
MEMEPUTER_WALLET=./wallet.json

# Change RPC URL
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Telegram Chat ID (required for posting to Telegram)
TELEGRAM_CHAT_ID=your-telegram-chat-id
```

### Telegram Setup (Optional)

To post content to Telegram, you need to:

1. **Add Broadcastputer_bot to your Telegram group**
   - Search for `@Broadcastputer_bot` on Telegram
   - Add the bot to your group or channel
   - Make sure the bot has permission to send messages

2. **Get your Telegram Chat ID**
   - Add `@cherrybot` to your group or channel
   - Send it the command `/id` and it will give you your chat ID
   - The chat ID is usually a negative number for groups (e.g., `-1001234567890`)

3. **Set the Chat ID in your environment**
   - Add `TELEGRAM_CHAT_ID=your-chat-id` to your `.env` file
   - Or set it when running: `TELEGRAM_CHAT_ID=your-chat-id pnpm start run --budget 1.0`

**Note:** If you don't set `TELEGRAM_CHAT_ID`, Marketputer will skip the Telegram posting step and complete all other steps successfully.

### Create Content in Your Brand's Likeness

Marketputer can create memes that match your brand's voice, style, and visual identity. You have two options:

**Option 1: Use a Brand Agent ID from Memeputer**

If you have a brand agent profile on Memeputer, reference it by ID:

```bash
pnpm start run --budget 1.0 --brand brands/memeputer.json
```

The `memeputer.json` file contains a `brandAgentId` that references a brand profile stored on Memeputer's platform. This gives you access to pre-configured brand settings including voice, style, and visual guidelines.

**Option 2: Create a Custom Brand Profile**

Create your own brand JSON file (like `brands/payai.json`) to define your brand's personality:

```json
{
  "brandName": "Your Brand",
  "voice": "professional, trustworthy, innovative",
  "styleKeywords": ["modern", "clean", "professional"],
  "denyTerms": ["nsfw", "scam"],
  "referenceImageUrls": [
    "https://example.com/brand-image-1.jpg",
    "https://example.com/brand-image-2.jpg"
  ],
  "captionPuterOptions": {
    "promptTemplate": "Keep captions professional but engaging..."
  }
}
```

Then use it:

```bash
pnpm start run --budget 1.0 --brand brands/your-brand.json
```

**Brand Profile Fields:**

- **`brandAgentId`**: Reference a brand agent profile from Memeputer's platform (alternative to custom brand profile)
- **`brandName`**: Your brand's name
- **`voice`**: Describes your brand's communication style (e.g., "professional, trustworthy" or "fun, crypto-native")
- **`styleKeywords`**: Visual style descriptors (e.g., "modern", "fintech", "clean")
- **`referenceImageUrls`**: Image URLs that PFPputer uses as style references for image generation. If not provided, PFPputer defaults to Memeputer brand style.
- **`denyTerms`**: Terms to avoid in content generation
- **`captionPuterOptions.promptTemplate`**: Custom instructions for Captionputer to match your brand's voice

**Note:** PFPputer defaults to Memeputer brand style unless you provide `referenceImageUrls` in your brand profile. Include reference images to ensure generated images match your brand's visual identity.

## Learn More

- [Build your own AI agent on Memeputer](https://memeputer.com)
- [Discover and use AI agents](https://agents.memeputer.com)
- [Learn about x402 micropayments](https://x402.dev)
