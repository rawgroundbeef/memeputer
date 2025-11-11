# Backend Issue Report: Agent-to-Agent Economy Testing

## Status: ✅ Payment Flow Working, ❌ Parameter Parsing Issue

---

## What's Working ✅

### Agent-to-Agent Payment Flow
The orchestrator agent is successfully paying other agents via x402:

1. **First Payment Success:**
   - Agent: `trendputer`
   - Command: `get_trends`
   - Amount: 0.1 USDC
   - Transaction: `4cnXshGJT6UJdewp1CWtqQqw3XxkWEst6AZuEXJ1Bxi6cjGStfhC5izVDSpu32ttW7YoTH5ZUxcvasi4QcZRN1m5`
   - Status: ✅ **SUCCESS** - Payment went through, received response

2. **Payment Mechanism:**
   - Orchestrator wallet: `G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ`
   - x402 protocol working correctly
   - Payments are on-chain (mainnet)
   - Transaction signatures are being returned

---

## What's Failing ❌

### Second Payment: `briefputer` Command Execution

**Agent:** `briefputer`  
**Command:** `generate_brief`  
**Error:** `Internal server error` (500)  
**Root Cause:** Parameter validation failing - backend not recognizing `brandProfile` parameter

---

## Detailed Error Analysis

### Backend Error Logs (from your logs):

```
[ParameterParser] INFO 📦 Parsing JSON parameters {
  jsonKeys: [ 'command', 'trendItem', 'policy' ],
  schemaParams: [ 'brandAgentId', 'brandProfile', 'trendItem', 'policy' ]
}

[ParameterParser] INFO 📦 JSON parsing complete { parsedKeys: [ 'trendItem', 'policy' ], errors: 0 }
```

**Problem:** The parser only found `trendItem` and `policy`, but **NOT** `brandProfile`, even though it's in the payload.

### Error Message:
```
❌ Invalid parameters:

Either brandAgentId or brandProfile is required for generate_brief
```

---

## Payload Being Sent

### Actual Payload (from debug output):

```json
{
  "command": "generate_brief",
  "brandProfile": {
    "name": "Orchestrator Agent",
    "personality": "fun, crypto-native, memes",
    "targetAudience": "Solana degens",
    "voice": "casual, humorous",
    "denyTerms": [],
    "requireDisclaimer": false
  },
  "trendItem": {
    "id": "twitter-trend-----",
    "title": "Pocky",
    "summary": "Trending on X: Pocky (popular Japanese snack stick) with 253,599 tweets",
    "source": "X",
    "canonicalUrl": "https://twitter.com/search?q=%E3%83%9D%E3%83%83%E3%82%AD%E3%83%BC",
    "score": 0.6304840790744644,
    "hashtags": []
  },
  "policy": {
    "denyTerms": [],
    "requireDisclaimer": false
  }
}
```

### Full Message String (what gets sent to `/x402/interact`):

```json
{
  "agentId": "briefputer",
  "message": "{\"command\":\"generate_brief\",\"brandProfile\":{\"name\":\"Orchestrator Agent\",\"personality\":\"fun, crypto-native, memes\",\"targetAudience\":\"Solana degens\",\"voice\":\"casual, humorous\",\"denyTerms\":[],\"requireDisclaimer\":false},\"trendItem\":{...},\"policy\":{...}}"
}
```

---

## Expected vs Actual

### Expected Behavior:
- Backend should parse `brandProfile` from the JSON message
- Validation should pass (either `brandAgentId` OR `brandProfile` is present)
- Command should execute

### Actual Behavior:
- Backend parser only finds: `command`, `trendItem`, `policy`
- Backend parser **misses**: `brandProfile`
- Validation fails because neither `brandAgentId` nor `brandProfile` is detected
- Returns 500 Internal Server Error

---

## Command Schema (from backend logs):

```javascript
[
  {
    "name": "brandAgentId",
    "type": "string",
    "required": false,
    "description": "Brand agent ID to fetch personality from (optional if brandProfile provided)"
  },
  {
    "name": "brandProfile",
    "type": "object",
    "required": false,
    "description": "Brand profile with name, voice, style, etc. (optional if brandAgentId provided)"
  },
  {
    "name": "trendItem",
    "type": "object",
    "required": true,
    "description": "Trend item from TrendPuter"
  },
  {
    "name": "policy",
    "type": "object",
    "required": true,
    "description": "Policy with denyTerms and requireDisclaimer"
  }
]
```

**Validation Rule:** At least one of `brandAgentId` OR `brandProfile` must be provided.

---

## Root Cause Hypothesis

The backend parameter parser (`ParameterParser`) is:
1. ✅ Successfully parsing `trendItem` (object)
2. ✅ Successfully parsing `policy` (object)
3. ❌ **NOT parsing `brandProfile` (object)** - This is the bug

**Possible causes:**
1. Parameter parser might have issues with nested objects at the top level
2. Parameter parser might be case-sensitive or have naming issues
3. Parameter parser might be stopping after finding required parameters
4. JSON parsing might be failing silently for `brandProfile`

---

## Test Cases to Verify

### Test 1: Verify brandProfile is in the message
```bash
# Check if brandProfile exists in the parsed message
console.log('Full message:', message);
console.log('Parsed JSON:', JSON.parse(message));
```

### Test 2: Test with brandAgentId instead
```json
{
  "command": "generate_brief",
  "brandAgentId": "some-brand-id",
  "trendItem": {...},
  "policy": {...}
}
```

### Test 3: Test with both brandAgentId and brandProfile
```json
{
  "command": "generate_brief",
  "brandAgentId": "some-brand-id",
  "brandProfile": {...},
  "trendItem": {...},
  "policy": {...}
}
```

---

## Files to Check

1. **Parameter Parser:**
   - `apps/agents-api/src/services/ParameterParser.ts` (or similar)
   - Check how it extracts parameters from JSON messages
   - Check if it handles nested objects correctly

2. **Command Handler:**
   - `apps/agents-api/src/services/AgentGatewayService.ts`
   - Line ~517 (where validation happens)
   - Check validation logic for `brandAgentId` vs `brandProfile`

3. **JSON Parsing:**
   - Check if JSON.parse is being called correctly
   - Check if nested objects are being flattened or lost

---

## Workaround (Temporary)

Until backend is fixed, we can test with `brandAgentId` instead:

```typescript
// Instead of brandProfile object
const briefResult = await this.hireAgent('briefputer', 'generate_brief', {
  brandAgentId: 'some-existing-brand-id', // Use existing brand agent
  trendItem,
  policy: {...}
}, 0.20);
```

**But this requires knowing an existing brandAgentId**, which defeats the purpose of the orchestrator being autonomous.

---

## Summary

✅ **Working:**
- Agent-to-agent x402 payments
- Transaction creation and settlement
- First agent call (`trendputer`) succeeds completely

❌ **Broken:**
- Parameter parser not detecting `brandProfile` in payload
- Validation fails even though `brandProfile` is present
- Second agent call (`briefputer`) fails with 500 error

**Action Required:**
Backend needs to fix parameter parser to correctly detect `brandProfile` object in the JSON payload.

---

## Additional Context

- **Network:** Mainnet
- **API Endpoint:** `http://localhost:3006/x402/interact`
- **Orchestrator Agent ID:** `1e7d0044-10c6-4036-9903-6ea995be82ec` (not used in this test - using client-side simulation)
- **Wallet:** `G31J8ZeVKo6j6xkxkjCcHENhQGNQid575MRvyixxNUJQ`

---

## Next Steps

1. **Backend:** Fix parameter parser to detect `brandProfile`
2. **Backend:** Add better error logging to show what parameters were actually parsed
3. **Backend:** Verify parameter validation logic handles optional parameters correctly
4. **Test:** Re-run the orchestrator agent test once fixed

---

## Questions for Backend Team

1. Why is the parameter parser only finding `trendItem` and `policy` but not `brandProfile`?
2. Is there a limit on nested object depth in the parameter parser?
3. Should `brandProfile` be sent differently (e.g., as a stringified JSON)?
4. Can we add debug logging to see exactly what the parser receives vs what it extracts?

