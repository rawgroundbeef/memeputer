# Trendputer `discover_trends` Command Brief

## Overview

Add a structured command endpoint `discover_trends` to the Trendputer agent to replace the current natural language prompt approach. This will provide more reliable JSON parsing, clearer parameter structure, and better type safety for programmatic use.

## Current Implementation (Prompt-Based)

**Location:** `examples/marketputer/src/orchestrator.ts` (lines 195-244)

**Current Usage:**
```typescript
const trendPrompt = `Investigate the most compelling news stories of the day.${keywordsContext} Context: ${fixedTask}. Return exactly 10 trends as JSON: {"items": [{"title": "...", "summary": "..."}]}`;
const trendsResult = await this.hireAgent('trendputer', trendPrompt, {});
```

**Current Issues:**
- Fragile JSON parsing (lines 207-243) with multiple fallback attempts
- Natural language prompt is ambiguous
- No structured parameter validation
- Response format not guaranteed
- Difficult to extend with filters or options

## Proposed Command Specification

### Command Name
`discover_trends`

### Endpoint
The command should be accessible via the existing x402 command endpoint structure:
- **Route:** `POST /x402/{chain}/{agentId}` (where `agentId` = `trendputer`)
- **Command Format:** JSON payload sent via SDK's `command()` method

### Request Payload

```typescript
interface DiscoverTrendsRequest {
  keywords?: string[];           // Optional: Focus keywords to search for
  context?: string;              // Optional: Task/context description
  maxResults?: number;            // Optional: Maximum number of trends (default: 10)
  sources?: string[];            // Optional: Filter by sources (e.g., ['DEXSCREENER', 'BIRDEYE', 'X', 'RSS'])
  minScore?: number;             // Optional: Minimum relevance score threshold
  includeHashtags?: boolean;     // Optional: Include hashtags in results (default: true)
  includeUrl?: boolean;          // Optional: Include canonical URLs (default: true)
}
```

**Example Request:**
```json
{
  "keywords": ["crypto", "solana", "defi"],
  "context": "Find relevant topics and create a meme about them",
  "maxResults": 10,
  "sources": ["DEXSCREENER", "BIRDEYE", "X"],
  "includeHashtags": true,
  "includeUrl": true
}
```

### Response Format

**Success Response:**
```typescript
interface DiscoverTrendsResponse {
  items: TrendItem[];
  metadata?: {
    totalFound?: number;
    sourcesQueried?: string[];
    queryTime?: number;
  };
}

interface TrendItem {
  id?: string;                   // Unique identifier (if available)
  title: string;                 // Required: Trend title/headline
  summary: string;               // Required: Brief summary/description
  source?: string;               // Optional: Source name (e.g., 'DEXSCREENER', 'BIRDEYE', 'X', 'RSS')
  score?: number;                // Optional: Relevance/quality score
  hashtags?: string[];           // Optional: Related hashtags
  canonicalUrl?: string | null;  // Optional: Source URL (null if not available)
  timestamp?: string;            // Optional: ISO 8601 timestamp
}
```

**Example Response:**
```json
{
  "items": [
    {
      "id": "trend-123",
      "title": "Solana DeFi TVL Hits All-Time High",
      "summary": "Total value locked in Solana DeFi protocols reached $5B, driven by new yield farming opportunities...",
      "source": "DEXSCREENER",
      "score": 8.5,
      "hashtags": ["#Solana", "#DeFi", "#TVL"],
      "canonicalUrl": "https://dexscreener.com/...",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "title": "New Meme Coin Surges 500%",
      "summary": "A new meme coin launched on Solana saw massive gains...",
      "source": "BIRDEYE",
      "score": 7.2,
      "hashtags": ["#MemeCoin", "#Solana"],
      "canonicalUrl": null
    }
  ],
  "metadata": {
    "totalFound": 15,
    "sourcesQueried": ["DEXSCREENER", "BIRDEYE", "X"],
    "queryTime": 1.2
  }
}
```

**Error Response:**
```json
{
  "error": "Invalid request: maxResults must be between 1 and 50",
  "code": "INVALID_PARAMETER"
}
```

## SDK Integration

### Update SDK Command Detection

**File:** `packages/sdk/src/index.ts` (around line 151)

Add `discover_trends` to the list of commands that expect JSON payloads:

```typescript
// Commands that expect JSON payloads (not CLI format)
const jsonPayloadCommands = [
  'describe_image', 
  'generate_captions', 
  'post_telegram',
  'discover_trends'  // ← Add this
];
```

### Usage in Marketputer

**File:** `examples/marketputer/src/orchestrator.ts`

**Before:**
```typescript
const trendPrompt = `Investigate the most compelling news stories of the day.${keywordsContext} Context: ${fixedTask}. Return exactly 10 trends as JSON: {"items": [{"title": "...", "summary": "..."}]}`;
const trendsResult = await this.hireAgent('trendputer', trendPrompt, {});
```

**After:**
```typescript
const trendsResult = await this.hireAgent('trendputer', 'discover_trends', {
  keywords: keywords.length > 0 ? keywords : undefined,
  context: fixedTask,
  maxResults: 10,
  sources: ['DEXSCREENER', 'BIRDEYE', 'X', 'RSS'],
  includeHashtags: true,
  includeUrl: true,
});
```

**Simplified Parsing:**
```typescript
// Remove all the fragile JSON parsing logic (lines 207-243)
// Replace with simple, reliable parsing:
try {
  const trends = JSON.parse(trendsResult.response);
  // Response is guaranteed to be valid JSON in the expected format
  this.logger.result('✅', `Got ${trends?.items?.length || 0} trends`);
  return trends;
} catch (error) {
  this.logger.error(`Failed to parse trends: ${error}`);
  return { items: [] };
}
```

## Backend Implementation Requirements

### 1. Command Handler Registration

The backend should recognize `discover_trends` as a valid command for the `trendputer` agent and route it to the appropriate handler.

### 2. Parameter Validation

- Validate `maxResults` is between 1 and 50 (default: 10)
- Validate `sources` array contains only valid source names
- Validate `minScore` is a positive number if provided
- All other parameters are optional

### 3. Response Format Guarantee

- **Always** return valid JSON matching `DiscoverTrendsResponse` interface
- **Never** wrap response in markdown code blocks
- **Never** include explanatory text outside the JSON structure
- **Always** include `items` array (even if empty)

### 4. Error Handling

- Return structured error responses for invalid parameters
- Handle source failures gracefully (if one source fails, continue with others)
- Return empty `items: []` if no trends found (not an error)

### 5. Backward Compatibility

- Keep existing prompt-based endpoint working for now
- New command endpoint should be additive, not breaking

## Testing Requirements

### Unit Tests
- Test with various parameter combinations
- Test with empty keywords array
- Test with invalid parameters (should return error)
- Test with no results (should return empty items array)

### Integration Tests
- Test from SDK `command()` method
- Test from Marketputer orchestrator
- Verify response format matches specification exactly

### Example Test Cases

```typescript
// Test 1: Basic usage
const result = await memeputer.command('trendputer', 'discover_trends', {
  keywords: ['crypto'],
  maxResults: 5
});
expect(result.response).toMatchObject({ items: expect.any(Array) });

// Test 2: Empty keywords
const result = await memeputer.command('trendputer', 'discover_trends', {
  context: 'Find trending topics',
  maxResults: 10
});
expect(result.response.items.length).toBeLessThanOrEqual(10);

// Test 3: Invalid maxResults
const result = await memeputer.command('trendputer', 'discover_trends', {
  maxResults: 100  // Should fail validation
});
expect(result.response.error).toBeDefined();
```

## Migration Plan

1. **Phase 1:** Implement backend endpoint (this brief)
2. **Phase 2:** Update SDK to include `discover_trends` in `jsonPayloadCommands`
3. **Phase 3:** Update Marketputer orchestrator to use command instead of prompt
4. **Phase 4:** Remove old prompt-based parsing logic
5. **Phase 5:** (Optional) Deprecate prompt-based approach

## Benefits

✅ **Reliable Parsing:** No more fragile JSON extraction from markdown  
✅ **Type Safety:** Structured request/response interfaces  
✅ **Extensibility:** Easy to add new parameters (filters, sorting, etc.)  
✅ **Better Error Handling:** Clear error messages for invalid inputs  
✅ **Consistency:** Matches pattern used by other commands (`generate_brief`, `describe_image`, etc.)  
✅ **Performance:** Can optimize backend query logic based on structured parameters  

## Related Files

- **SDK:** `packages/sdk/src/index.ts` (line 151 - add to `jsonPayloadCommands`)
- **Marketputer:** `examples/marketputer/src/orchestrator.ts` (lines 195-244 - replace prompt with command)
- **Types:** `examples/marketputer/src/types.ts` (TrendItem interface already exists)

## Questions for Backend Team

1. What sources are currently available? (DEXSCREENER, BIRDEYE, X, RSS confirmed?)
2. How is scoring calculated? (for `score` field)
3. Are there rate limits per source?
4. Should we support pagination for large result sets?
5. Can we add filtering by date range in future?

