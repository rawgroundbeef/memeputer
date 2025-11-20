# Marketputer Agent Usage Analysis

## Agents Used

Marketputer coordinates **8 different agents** across 9 workflow steps:

1. **keywordputer** - Used 1 time (Step 1) ✅ Command-based
2. **trendputer** - Used 1 time (Step 2) ✅ Command-based
3. **briefputer** - Used 2 times (Steps 3, 4)
4. **promptputer** - Used 1 time (Step 5) ✅ Command-based
5. **pfpputer** - Used 1 time (Step 6)
6. **imagedescripterputer** - Used 1 time (Step 7)
7. **captionputer** - Used 1 time (Step 8)
8. **broadcastputer** - Used 1 time (Step 9)

## Current Usage: Commands vs Prompts

### ✅ Using Commands (Structured)

| Agent | Step | Command | Payload Structure |
|-------|------|---------|-------------------|
| **keywordputer** | Step 1 | `extract_keywords` | `{ task, context, targetAudience, contentGoal, maxKeywords }` |
| **trendputer** | Step 2 | `discover_trends` | `{ keywords, context, maxResults, includeHashtags, includeUrl }` |
| **briefputer** | Step 4 | `generate_brief` | `{ trendItem, brandProfile/brandAgentId, policy }` |
| **promptputer** | Step 5 | `enhance_prompt` | `{ basePrompt, qualityModifiers, style, detailLevel, tone, includeTechnicalSpecs }` |
| **pfpputer** | Step 6 | `pfp` | `{ message: "/pfp generate ..." }` |
| **imagedescripterputer** | Step 7 | `describe_image` | `{ imageUrl, detailLevel }` |
| **captionputer** | Step 8 | `generate_captions` | `{ imageDescription, imagePrompt, trendItem, brief, brandProfile, numVariants }` |
| **broadcastputer** | Step 9 | `post_telegram` | `{ chatId, caption, imageUrl }` |

### 📝 Using Prompts (Natural Language)

| Agent | Step | Prompt Type | Current Implementation |
|-------|------|-------------|------------------------|
| **briefputer** | Step 3 | Natural language | Asks to evaluate trends and return number (1-N) |

## Recent Conversions: Commands Implemented ✅

### ✅ Completed Conversions

#### 1. **keywordputer** (Step 1) - **COMPLETED**
**Previous:** briefputer prompt asking for JSON
**Now:** `extract_keywords` command
```typescript
await this.hireAgentWithCommand('keywordputer', 'extract_keywords', {
  task: task,
  context: 'Creating content for Solana community',
  targetAudience: 'Solana degens',
  contentGoal: 'meme',
  maxKeywords: 10,
});
```

**Benefits Achieved:**
- ✅ Reliable JSON parsing with `{ "data": { "keywords": [...] } }` format
- ✅ Clear parameter structure
- ✅ Better error handling
- ✅ Replaced briefputer's Step 1 functionality with specialized agent

#### 2. **trendputer** (Step 2) - **COMPLETED**
**Previous:** Natural language prompt asking for JSON
**Now:** `discover_trends` command
```typescript
await this.hireAgentWithCommand('trendputer', 'discover_trends', {
  keywords: keywords,
  context: fixedTask,
  maxResults: 10,
  includeHashtags: true,
  includeUrl: true,
});
```

**Benefits Achieved:**
- ✅ Reliable JSON parsing (no markdown extraction needed)
- ✅ Clearer parameter structure
- ✅ Better type safety
- ✅ Easier to extend

#### 3. **promptputer** (Step 5) - **COMPLETED**
**Previous:** Natural language prompt asking to enhance prompt
**Now:** `enhance_prompt` command
```typescript
await this.hireAgentWithCommand('promptputer', 'enhance_prompt', {
  basePrompt: basePrompt,
  qualityModifiers: ['8K', 'cinematic', 'artstation', 'highly detailed', 'professional quality'],
  style: 'artistic',
  detailLevel: 'high',
  includeTechnicalSpecs: true,
  tone: 'dramatic',
});
```

**Benefits Achieved:**
- ✅ More consistent output
- ✅ Easier to customize quality modifiers
- ✅ Better for programmatic use

### 🤔 Lower Priority: Could Stay as Prompts

#### 4. **briefputer** (Step 3) - **COULD STAY AS PROMPT**
**Current:** Natural language evaluation prompt
```typescript
const evaluationPrompt = `I need to evaluate ${trends.length} trending topics...
Please evaluate these trends and tell me which ONE is the best fit...
Respond with ONLY the number (1-${trends.length})`;
```

**Why it might stay as prompt:**
- Evaluation tasks are inherently open-ended
- The reasoning process benefits from natural language
- Already has fallback heuristic logic

**But could benefit from command:**
```typescript
await this.hireAgent('briefputer', 'evaluate_trends', {
  trends: trends,
  task: task,
  criteria: ['relevance', 'quality', 'engagement'],
  returnFormat: 'number' // or 'ranked' for full ranking
});
```

**Benefits:**
- More structured output
- Better error handling
- Could return full ranking instead of just number

## Summary Table

| Agent | Step | Current | Status | Notes |
|-------|------|---------|--------|-------|
| keywordputer | 1 | Command | ✅ Complete | Replaced briefputer Step 1 |
| trendputer | 2 | Command | ✅ Complete | Converted from prompt |
| briefputer | 3 | Prompt | 🔄 Optional | Evaluation is open-ended, could be structured |
| briefputer | 4 | Command | ✅ Keep | Already using command |
| promptputer | 5 | Command | ✅ Complete | Converted from prompt |
| pfpputer | 6 | Command | ✅ Keep | Already using command |
| imagedescripterputer | 7 | Command | ✅ Keep | Already using command |
| captionputer | 8 | Command | ✅ Keep | Already using command |
| broadcastputer | 9 | Command | ✅ Keep | Already using command |

## Conversion Progress

- ✅ **7 out of 9 steps** now use structured commands (78%)
- ✅ **3 recent conversions**: keywordputer, trendputer, promptputer
- 🔄 **1 remaining prompt**: briefputer Step 3 (evaluation - optional conversion)

## Implementation Notes

The orchestrator now uses explicit methods:
- `hireAgentWithCommand()` - For structured commands with JSON payloads
- `hireAgentWithPrompt()` - For natural language prompts

**Command-based agents** send structured JSON payloads via the SDK's `command()` method, which routes to the appropriate endpoint based on the command name. Commands like `extract_keywords`, `discover_trends`, and `enhance_prompt` are automatically sent as JSON payloads (not CLI format).

**Benefits of command-based approach:**
- ✅ Reliable JSON parsing (no markdown extraction)
- ✅ Type-safe parameters
- ✅ Better error handling
- ✅ Easier to test and debug
- ✅ Clear API contracts

