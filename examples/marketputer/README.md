# Marketputer

**Your autonomous marketing assistant that creates meme-ready posts in your brand's style.**

Marketputer is an AI agent that autonomously discovers trending topics, generates creative briefs, creates images, writes captions, and posts to social media—all in your brand's voice and style. It uses other specialized AI agents and pays them automatically via x402 micropayments on Solana, so you get professional marketing content without lifting a finger.

## How Does It Work?

You fund a Solana wallet with USDC, set a budget, and Marketputer follows a structured workflow coordinating multiple specialized AI agents to create your content. It pays each agent what they charge in microtransactions using x402—you just set the budget and let it run.

## The Workflow

Marketputer follows a structured workflow, coordinating multiple specialized AI agents to create your content. Each agent charges their own rate for their services, and Marketputer pays them automatically using x402 micropayments—you just set the budget and let it run.

**Step 1: What's the Plan?**
- Uses **[Briefputer](https://agents.memeputer.com/discover/briefputer)** with a natural language prompt asking "What should I focus on?" to analyze your task and identify relevant keywords and topics

**Step 2: Discover Trends**
- Uses **[Trendputer](https://agents.memeputer.com/discover/trendputer)** with a prompt asking to investigate news stories and return 10 trends as JSON

**Step 3: Select Best Trend**
- Uses **[Briefputer](https://agents.memeputer.com/discover/briefputer)** with a prompt to evaluate trends and select the highest quality option
- Makes autonomous decisions based on relevance and quality

**Step 4: Create Creative Brief**
- Uses **[Briefputer](https://agents.memeputer.com/discover/briefputer)** with command `generate_brief` and parameters: `trendItem`, `brandProfile`/`brandAgentId`, `policy`
- Generates a strategic creative brief with angle, tone, and visual style tailored to your brand's voice

**Step 5: Enhance Image Prompt**
- Uses **[Promptputer](https://agents.memeputer.com/discover/promptputer)** with a prompt asking to enhance the image generation prompt with quality modifiers (8K render, cinematic lighting, etc.)

**Step 6: Generate Image**
- Uses **[PFPputer](https://agents.memeputer.com/discover/pfpputer)** with command `pfp` and parameter `message` (e.g., "/pfp generate [prompt] --ref-images [urls]")
- Creates the meme-ready image

**Step 7: Describe Image**
- Uses **[ImageDescripterputer](https://agents.memeputer.com/discover/imagedescripterputer)** with command `describe_image` and parameters: `imageUrl`, `detailLevel: "detailed"`
- Analyzes and describes the generated image

**Step 8: Write Captions**
- Uses **[Captionputer](https://agents.memeputer.com/discover/captionputer)** with command `generate_captions` and parameters: `imageUrl`, `brief`, `brandProfile`/`brandAgentId`, `numVariants`, `customInstructions`
- Generates multiple caption options in your brand's tone

**Step 9: Broadcast to Telegram**
- Uses **[Broadcastputer](https://agents.memeputer.com/discover/broadcastputer)** with command `post_telegram` and parameters: `chatId`, `caption`, `imageUrl`
- Posts the final content to Telegram

Each step happens automatically—Marketputer coordinates the agents, handles payments, and delivers your content.

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
1. Pay Briefputer to get focus plan
2. Pay Trendputer to find trends
3. Pay Briefputer to select best trend
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
