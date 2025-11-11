# Backend To-Do: BroadcastPuter Commands

## Issue
BroadcastPuter commands (`post_telegram`, `post_farcaster`, `post_multi`) are not registered in the database, causing 404 errors when called.

**Error:** `Command "post_telegram" not found or not enabled for agent-api integration`

---

## To-Do

### 1. Register BroadcastPuter Commands in Database

**Agent ID:** `d8582864-da79-4d9b-8fa3-26df9ce7de06`

Register these 3 commands with `integration: "agent-api"`:

#### Command: `post_telegram`
- Handler: `BroadcastPuterCommandHandlers.post_telegram`
- Integration: `agent-api`
- Parameters: `chatId` (required), `caption` (required), `imageUrl` (required), `botToken` (optional - agent has its own)

#### Command: `post_farcaster`
- Handler: `BroadcastPuterCommandHandlers.post_farcaster`
- Integration: `agent-api`
- Parameters: `fid` (required), `caption` (required), `imageUrl` (required), `neynarApiKey` (optional - agent may have its own)

#### Command: `post_multi`
- Handler: `BroadcastPuterCommandHandlers.post_multi`
- Integration: `agent-api`
- Parameters: `platforms` (required), `caption` (required), `imageUrl` (required), `telegram` (object, optional), `farcaster` (object, optional)

---

### 2. Fix Telegram API Response Parsing

**CRITICAL ISSUE:** Telegram API response is failing to parse as JSON.

**Current Error:**
```
Unexpected end of JSON input
at JSON.parse
at BroadcastPuterCommandHandlers.handlePostTelegram (line 110)
```

**Fix Required:**
1. **Add error handling for empty/invalid responses:**
   ```typescript
   try {
     const response = await fetch(telegramApiUrl, ...);
     const responseText = await response.text();
     
     // Log raw response for debugging
     console.log('Telegram API raw response:', responseText);
     
     if (!responseText || responseText.trim() === '') {
       throw new Error('Empty response from Telegram API');
     }
     
     const data = JSON.parse(responseText);
     // ... handle response
   } catch (error) {
     if (error instanceof SyntaxError) {
       // Log the raw response that failed to parse
       console.error('Failed to parse Telegram response:', responseText);
       throw new Error(`Telegram API returned invalid JSON: ${error.message}`);
     }
     throw error;
   }
   ```

2. **Check Telegram API error responses:**
   - Telegram might be returning an error that's not JSON
   - Check `response.status` before parsing
   - Handle non-200 status codes properly

3. **Verify image download:**
   - Ensure image is downloaded successfully before uploading to Telegram
   - Check if image URL is accessible
   - Handle image download failures gracefully

---

### 3. Test

After registration, test:
```bash
# Should work via API
curl -X POST http://localhost:3006/x402/interact \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "d8582864-da79-4d9b-8fa3-26df9ce7de06",
    "message": "{\"command\":\"post_telegram\",\"chatId\":\"-1003085293333\",\"caption\":\"Test\",\"imageUrl\":\"https://example.com/image.png\"}"
  }'
```

---

## Quick SQL Reference

Commands should be registered in `agent_custom_commands` table with:
- `agent_id`: `d8582864-da79-4d9b-8fa3-26df9ce7de06`
- `command`: `post_telegram`, `post_farcaster`, `post_multi`
- `handler_type`: `built_in`
- `built_in_handler`: Match handler method name
- `integrations`: `["agent-api"]` (for API calls, not just Telegram)

---

## Status

- ✅ Payment flow working (x402 payments succeed)
- ✅ Commands registered in database
- ✅ Parameter parsing working (`chatId`, `caption`, `imageUrl` parsed correctly)
- ✅ **Bot token from agent config working** - handler now uses agent's configured token
- ❌ **Telegram API response parsing failing** - JSON parse error

## Current Error

```
Unexpected end of JSON input
at JSON.parse
at BroadcastPuterCommandHandlers.handlePostTelegram (line 110)
```

**What's working:**
- ✅ Parameters parsed correctly
- ✅ Bot token loaded from agent config: `d8582864-da79-4d9b-8fa3-26df9ce7de06`
- ✅ Request being sent to Telegram API

**What's failing:**
- ❌ Telegram API response is empty or not valid JSON
- ❌ Response parsing fails at `JSON.parse()`

**Fix needed:**
1. Check Telegram API response handling in `BroadcastPuterCommandHandlers.ts` line 110
2. Handle empty responses or non-JSON responses gracefully
3. Log the raw response before parsing to debug
4. Check if Telegram API is returning an error that's not being caught

