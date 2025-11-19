# Marketputer Agent Usage Analysis

## Agents Used

Marketputer coordinates **7 different agents** across 9 workflow steps:

1. **briefputer** - Used 3 times (Steps 1, 3, 4)
2. **trendputer** - Used 1 time (Step 2)
3. **promptputer** - Used 1 time (Step 5)
4. **pfpputer** - Used 1 time (Step 6)
5. **imagedescripterputer** - Used 1 time (Step 7)
6. **captionputer** - Used 1 time (Step 8)
7. **broadcastputer** - Used 1 time (Step 9)

## Current Usage: Commands vs Prompts

### ✅ Using Commands (Structured)

| Agent | Step | Command | Payload Structure |
|-------|------|---------|-------------------|
| **briefputer** | Step 4 | `generate_brief` | `{ trendItem, brandProfile/brandAgentId, policy }` |
| **pfpputer** | Step 6 | `pfp` | `{ message: "/pfp generate ..." }` |
| **imagedescripterputer** | Step 7 | `describe_image` | `{ imageUrl, detailLevel }` |
| **captionputer** | Step 8 | `generate_captions` | `{ imageDescription, imagePrompt, trendItem, brief, brandProfile, numVariants }` |
| **broadcastputer** | Step 9 | `post_telegram` | `{ chatId, caption, imageUrl }` |

### 📝 Using Prompts (Natural Language)

| Agent | Step | Prompt Type | Current Implementation |
|-------|------|-------------|------------------------|
| **briefputer** | Step 1 | Natural language | Asks "What should I focus on?" with JSON format request |
| **trendputer** | Step 2 | Natural language | Asks for 10 trends as JSON: `{"items": [...]}` |
| **briefputer** | Step 3 | Natural language | Asks to evaluate trends and return number (1-N) |
| **promptputer** | Step 5 | Natural language | Asks to enhance prompt with quality modifiers |

## Recommendations: Which Could Benefit from Commands?

### 🎯 High Priority: Convert to Commands

#### 1. **trendputer** (Step 2) - **STRONGLY RECOMMENDED**
**Current:** Natural language prompt asking for JSON
```typescript
const trendPrompt = `Investigate the most compelling news stories of the day.${keywordsContext} Context: ${fixedTask}. Return exactly 10 trends as JSON: {"items": [{"title": "...", "summary": "..."}]}`;
```

**Recommended Command:**
```typescript
await this.hireAgent('trendputer', 'discover_trends', {
  keywords: keywords,
  context: fixedTask,
  maxResults: 10,
  sources: ['DEXSCREENER', 'BIRDEYE', 'X', 'RSS'] // optional
});
```

**Benefits:**
- ✅ More reliable JSON parsing (no markdown extraction needed)
- ✅ Clearer parameter structure
- ✅ Better type safety
- ✅ Easier to extend (add filters, sources, etc.)
- ✅ Currently has fragile JSON parsing logic (lines 207-243)

#### 2. **briefputer** (Step 1) - **RECOMMENDED**
**Current:** Natural language prompt asking for JSON
```typescript
const prompt = `I'm an orchestrator agent with a task: "${task}"
...Respond in this exact JSON format: { "focusArea": "...", "keywords": [...], ... }`;
```

**Recommended Command:**
```typescript
await this.hireAgent('briefputer', 'analyze_task', {
  task: task,
  returnFormat: 'structured' // or just always return structured
});
```

**Benefits:**
- ✅ More reliable than parsing free-form JSON
- ✅ Clearer intent
- ✅ Better error handling

#### 3. **promptputer** (Step 5) - **MODERATE PRIORITY**
**Current:** Natural language prompt asking to enhance prompt
```typescript
const enhancementPrompt = `I need to create a high-quality image generation prompt.
Base concept: "${basePrompt}"
Please enhance this prompt...`;
```

**Recommended Command:**
```typescript
await this.hireAgent('promptputer', 'enhance_prompt', {
  basePrompt: basePrompt,
  qualityModifiers: ['8K', 'cinematic', 'artstation'], // optional
  style: 'artistic' // optional
});
```

**Benefits:**
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

| Agent | Step | Current | Recommended | Priority | Reason |
|-------|------|---------|--------------|----------|--------|
| trendputer | 2 | Prompt | Command | 🔴 High | Fragile JSON parsing, clear parameters |
| briefputer | 1 | Prompt | Command | 🟡 Medium | More reliable than JSON parsing |
| briefputer | 3 | Prompt | Command (optional) | 🟢 Low | Evaluation is open-ended, but could be structured |
| promptputer | 5 | Prompt | Command | 🟡 Medium | More consistent output, easier customization |
| briefputer | 4 | Command | ✅ Keep | - | Already using command |
| pfpputer | 6 | Command | ✅ Keep | - | Already using command |
| imagedescripterputer | 7 | Command | ✅ Keep | - | Already using command |
| captionputer | 8 | Command | ✅ Keep | - | Already using command |
| broadcastputer | 9 | Command | ✅ Keep | - | Already using command |

## Implementation Notes

The `hireAgent()` method automatically detects whether to use `prompt()` or `command()` based on:
- If `payload` is empty AND `command.length > 50` → uses `prompt()`
- Otherwise → uses `command()`

This means converting to commands is straightforward - just pass structured payloads instead of empty objects.

