# Promptputer `enhance_prompt` Command Brief

## Overview

Add a structured command endpoint `enhance_prompt` to the Promptputer agent to replace the current natural language prompt approach. This will provide more consistent output, easier customization of quality modifiers, and better type safety for programmatic use.

**Status:** ⏳ **PENDING** - Awaiting backend implementation

**Agent ID:** (To be confirmed - check Promptputer agent UUID)  
**Command:** `enhance_prompt`  
**Endpoint:** `POST /api/v1/promptputer/enhance_prompt` (or integrated into x402 flow)

---

## Current Implementation (Prompt-Based)

**Location:** `examples/marketputer/src/orchestrator.ts` (lines 1137-1158)

**Current Usage:**
```typescript
const enhancementPrompt = `I need to create a high-quality image generation prompt.

Base concept: "${basePrompt}"

Please enhance this prompt to create a detailed, artistic, high-quality image generation prompt. Add quality modifiers like:
- Highly detailed, 8K render, professional quality
- Cinematic lighting, vibrant colors, sharp focus
- Artistic composition, trending on artstation style
- Award winning, masterpiece quality

Make it compelling and detailed while keeping the core concept. Return ONLY the enhanced prompt, nothing else.`;

const result = await this.memeputer.prompt('promptputer', enhancementPrompt);
```

**Current Issues:**
- Natural language prompt is ambiguous
- No structured parameter validation
- Response format not guaranteed (may include quotes, markdown, etc.)
- Difficult to customize quality modifiers programmatically
- Requires cleanup of response (removing quotes, markdown formatting)

---

## Proposed Command Specification

### Command Name
`enhance_prompt`

### Endpoint
The command should be accessible via the existing x402 command endpoint structure:
- **Route:** `POST /x402/{chain}/{agentId}` (where `agentId` = `promptputer`)
- **Command Format:** JSON payload sent via SDK's `command()` method

### Request Payload

```typescript
interface EnhancePromptRequest {
  basePrompt: string;              // Required: The base prompt/concept to enhance
  qualityModifiers?: string[];     // Optional: Specific quality modifiers to include (e.g., ['8K', 'cinematic', 'artstation'])
  style?: string;                  // Optional: Style preference (e.g., 'artistic', 'photorealistic', 'anime', 'minimalist')
  detailLevel?: 'standard' | 'high' | 'ultra'; // Optional: Level of detail (default: 'high')
  includeTechnicalSpecs?: boolean; // Optional: Include technical specs like resolution, aspect ratio (default: true)
  tone?: string;                   // Optional: Tone/mood (e.g., 'dramatic', 'vibrant', 'muted', 'professional')
  excludeModifiers?: string[];      // Optional: Modifiers to exclude (e.g., ['nsfw', 'violent'])
}
```

**Example Request:**
```json
{
  "basePrompt": "A futuristic cityscape at sunset",
  "qualityModifiers": ["8K", "cinematic", "artstation"],
  "style": "artistic",
  "detailLevel": "high",
  "includeTechnicalSpecs": true,
  "tone": "dramatic"
}
```

### Response Format

**Success Response:**
```typescript
interface EnhancePromptResponse {
  enhancedPrompt: string;          // Required: The enhanced prompt text
  modifiersApplied?: string[];     // Optional: List of modifiers that were applied
  style?: string;                   // Optional: Style used
  detailLevel?: string;             // Optional: Detail level used
}
```

**Example Response:**
```json
{
  "enhancedPrompt": "A futuristic cityscape at sunset, highly detailed, 8K render, professional quality, cinematic lighting, vibrant colors, sharp focus, artistic composition, trending on artstation style, award winning, masterpiece quality",
  "modifiersApplied": ["8K", "cinematic", "artstation", "highly detailed", "professional quality"],
  "style": "artistic",
  "detailLevel": "high"
}
```

**Error Response:**
```json
{
  "error": "Invalid request: basePrompt is required",
  "code": "INVALID_PARAMETER"
}
```

---

## SDK Integration

### Update SDK Command Detection

**File:** `packages/sdk/src/index.ts` (around line 151)

Add `enhance_prompt` to the list of commands that expect JSON payloads:

```typescript
// Commands that expect JSON payloads (not CLI format)
const jsonPayloadCommands = [
  'describe_image', 
  'generate_captions', 
  'post_telegram',
  'discover_trends',
  'enhance_prompt'  // ← Add this
];
```

### Usage in Marketputer

**File:** `examples/marketputer/src/orchestrator.ts` (lines 1137-1158)

**Before (Prompt-Based):**
```typescript
const enhancementPrompt = `I need to create a high-quality image generation prompt.
Base concept: "${basePrompt}"
Please enhance this prompt...`;

const result = await this.memeputer.prompt('promptputer', enhancementPrompt);

// Cleanup required
const enhanced = result.response.trim();
return enhanced.replace(/^["']|["']$/g, '').replace(/^```[\w]*\n?|\n?```$/g, '').trim();
```

**After (Structured Command):**
```typescript
const result = await this.hireAgentWithCommand('promptputer', 'enhance_prompt', {
  basePrompt: basePrompt,
  qualityModifiers: ['8K', 'cinematic', 'artstation'],
  style: 'artistic',
  detailLevel: 'high',
  includeTechnicalSpecs: true,
});

// Simple, reliable parsing
try {
  const parsed = JSON.parse(result.response);
  return parsed.enhancedPrompt || result.response;
} catch (error) {
  this.logger.error(`Failed to parse enhanced prompt: ${error}`);
  return basePrompt; // Fallback to base prompt
}
```

**Benefits:**
- ✅ No more cleanup of quotes/markdown
- ✅ Guaranteed response format
- ✅ Type-safe parameter handling
- ✅ Easy to customize quality modifiers
- ✅ Clear error messages

---

## Backend Implementation Requirements

### 1. Command Handler Registration

The backend should recognize `enhance_prompt` as a valid command for the `promptputer` agent and route it to the appropriate handler.

### 2. Parameter Validation

- Validate `basePrompt` is required and non-empty string
- Validate `qualityModifiers` is an array of strings if provided
- Validate `style` is one of allowed values if provided
- Validate `detailLevel` is one of: 'standard', 'high', 'ultra'
- All other parameters are optional

### 3. Response Format Guarantee

- **Always** return valid JSON matching `EnhancePromptResponse` interface
- **Never** wrap response in markdown code blocks
- **Never** include explanatory text outside the JSON structure
- **Always** include `enhancedPrompt` field with the enhanced prompt text

### 4. Prompt Enhancement Logic

The backend should:
- Take the `basePrompt` as the core concept
- Apply quality modifiers (either provided or default set)
- Apply style preferences if specified
- Apply detail level (affects verbosity and specificity)
- Include technical specs if `includeTechnicalSpecs` is true
- Apply tone/mood if specified
- Exclude any modifiers in `excludeModifiers` array
- Return a single, cohesive enhanced prompt string

### 5. Default Quality Modifiers

If `qualityModifiers` is not provided, use a sensible default set:
- "highly detailed"
- "professional quality"
- "sharp focus"
- "award winning"
- "masterpiece quality"

### 6. Error Handling

- Return structured error responses for invalid parameters
- Handle prompt enhancement failures gracefully
- Return base prompt if enhancement fails (not an error, just fallback)

### 7. Backward Compatibility

- Keep existing prompt-based endpoint working for now
- New command endpoint should be additive, not breaking

---

## Testing Requirements

### Unit Tests
- Test with various parameter combinations
- Test with empty basePrompt (should return error)
- Test with invalid parameters (should return error)
- Test with minimal parameters (should use defaults)

### Integration Tests
- Test from SDK `command()` method
- Test from Marketputer orchestrator
- Verify response format matches specification exactly
- Verify enhanced prompt is actually enhanced (not just base prompt)

### Example Test Cases

```typescript
// Test 1: Basic usage
const result = await memeputer.command('promptputer', 'enhance_prompt', {
  basePrompt: 'a cat'
});
expect(result.response).toMatchObject({ enhancedPrompt: expect.any(String) });
expect(result.response.enhancedPrompt.length).toBeGreaterThan('a cat'.length);

// Test 2: With custom modifiers
const result = await memeputer.command('promptputer', 'enhance_prompt', {
  basePrompt: 'a futuristic city',
  qualityModifiers: ['8K', 'cinematic'],
  style: 'artistic'
});
expect(result.response.enhancedPrompt).toContain('8K');
expect(result.response.enhancedPrompt).toContain('cinematic');

// Test 3: Invalid basePrompt
const result = await memeputer.command('promptputer', 'enhance_prompt', {
  basePrompt: ''
});
expect(result.response.error).toBeDefined();
expect(result.response.code).toBe('INVALID_PARAMETER');
```

---

## Migration Plan

1. **Phase 1:** Implement backend endpoint (this brief)
2. **Phase 2:** Update SDK to include `enhance_prompt` in `jsonPayloadCommands`
3. **Phase 3:** Update Marketputer orchestrator to use command instead of prompt
4. **Phase 4:** Remove old prompt-based cleanup logic
5. **Phase 5:** (Optional) Deprecate prompt-based approach

---

## Benefits

✅ **Consistent Output:** No more variation in response format  
✅ **No Cleanup Needed:** Response is guaranteed to be clean text, no quotes/markdown  
✅ **Type Safety:** Structured request/response interfaces  
✅ **Customization:** Easy to add/remove quality modifiers programmatically  
✅ **Better Error Handling:** Clear error messages for invalid inputs  
✅ **Consistency:** Matches pattern used by other commands (`discover_trends`, `generate_brief`, etc.)  
✅ **Extensibility:** Easy to add new parameters (style presets, aspect ratio, etc.)  

---

## Related Files

- **SDK:** `packages/sdk/src/index.ts` (line 151 - add to `jsonPayloadCommands`)
- **Marketputer:** `examples/marketputer/src/orchestrator.ts` (lines 1137-1158 - replace prompt with command)
- **Reference:** `examples/marketputer/TRENDPUTER_COMMAND_BRIEF.md` - Similar implementation pattern

---

## Questions for Backend Team

1. What is the Promptputer agent ID/UUID?
2. Should quality modifiers be additive or replace defaults?
3. Are there predefined style presets available?
4. Should we support aspect ratio specifications in the future?
5. Can we add negative prompts (what to avoid) in future?

---

## Example Implementation Flow

### Request Flow
```
SDK → POST /x402/solana/promptputer
Body: { "message": "{\"command\":\"enhance_prompt\",\"basePrompt\":\"...\",...}" }
↓
Backend detects command → Routes to enhance_prompt handler
↓
Handler enhances prompt → Returns JSON response
↓
SDK parses JSON → Returns enhancedPrompt string
```

### Response Flow
```
Backend → { "enhancedPrompt": "...", "modifiersApplied": [...] }
↓
SDK → Parses JSON, extracts enhancedPrompt
↓
Marketputer → Uses enhancedPrompt for image generation
```

---

**Implementation Date:** TBD  
**Status:** Ready for backend implementation

