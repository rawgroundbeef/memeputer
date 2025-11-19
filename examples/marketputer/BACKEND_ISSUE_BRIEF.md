# Backend Issue: 404 Errors on Command Requests

## Problem Summary

All agent command requests are returning **404 Not Found** errors, causing the Marketputer orchestrator to fail. The SDK is correctly sending command requests through the x402 endpoint, but the backend is not routing them properly.

**Status:** 🔴 **BLOCKING** - Marketputer cannot execute any agent commands

---

## Symptoms

### Error Messages
```
📡 HTTP Response Status: 404
❌ Failed to parse trends: Unexpected end of JSON input
```

### What's Happening
- **All agents** are returning 404 (not just trendputer)
- Response body is empty (causing JSON parse error)
- No payment flow initiated (402 response never received)
- Commands fail silently with empty responses

---

## SDK Behavior (Expected)

### Request Flow
The SDK sends command requests through the standard x402 endpoint:

**Endpoint:** `POST /x402/{chain}/{agentId}`

**Example Request:**
```http
POST http://localhost:3007/solana/trendputer
Content-Type: application/json

{
  "message": "{\"command\":\"discover_trends\",\"keywords\":[\"crypto\"],\"context\":\"Find relevant topics\",\"maxResults\":10,\"includeHashtags\":true,\"includeUrl\":true}"
}
```

**Expected Flow:**
1. SDK sends request → Backend returns `402 Payment Required`
2. SDK creates payment transaction → Signs with wallet
3. SDK retries with `X-PAYMENT` header → Backend returns `200 OK` with response

**Actual Flow:**
1. SDK sends request → Backend returns `404 Not Found` ❌
2. No payment flow initiated
3. Empty response body causes JSON parse error

---

## Command Format

### JSON Payload Commands
For commands like `discover_trends`, `generate_brief`, `describe_image`, etc., the SDK sends:

```json
{
  "command": "discover_trends",
  "keywords": ["crypto", "solana"],
  "context": "Find relevant topics",
  "maxResults": 10,
  "includeHashtags": true,
  "includeUrl": true
}
```

This is stringified and sent as the `message` field in the request body.

### CLI Format Commands
For simple commands, the SDK sends:
```
/ping
/pfp generate a cat
```

---

## Root Cause Analysis

### Issue 1: Command Detection Not Working
The backend's `/x402/{chain}/{agentId}` endpoint is not detecting commands in the message body and routing them to the appropriate handler.

**Expected Behavior:**
- Backend receives `{ "message": "{\"command\":\"discover_trends\",...}" }`
- Backend parses the message JSON
- Backend detects `command: "discover_trends"`
- Backend routes to `discover_trends` handler (via webhook or internal routing)
- Backend returns proper x402 response (402 → payment → 200)

**Actual Behavior:**
- Backend receives request
- Backend returns 404 immediately
- No command detection/routing occurs

### Issue 2: Separate API Endpoint Not Integrated
The backend has a separate endpoint `/api/v1/trendputer/discover_trends`, but this is not integrated into the x402 flow. Commands need to be routed through the x402 endpoint to enable payment processing.

---

## What Needs to Be Fixed

### Option 1: Integrate Command Detection into x402 Endpoint (Recommended)

**Location:** `POST /x402/{chain}/{agentId}` handler

**Implementation:**
1. Parse the `message` field from request body
2. Check if message is JSON and contains `command` field
3. If command exists, look up registered command webhook/handler
4. Route to command handler (maintaining x402 flow)
5. Return proper x402 response (402 → payment → 200)

**Example Pseudo-Code:**
```typescript
// In /x402/{chain}/{agentId} handler
const { message } = req.body;

// Try to parse message as JSON
let parsedMessage;
try {
  parsedMessage = JSON.parse(message);
} catch {
  // Not JSON, treat as plain text prompt
  parsedMessage = { text: message };
}

// Check if it's a command
if (parsedMessage.command) {
  const commandName = parsedMessage.command;
  const agentId = req.params.agentId;
  
  // Look up command registration
  const command = await getCommandRegistration(agentId, commandName);
  
  if (command) {
    // Route to command handler (webhook or internal)
    return await handleCommand(command, parsedMessage, req, res);
  } else {
    return res.status(404).json({ error: `Command ${commandName} not found for agent ${agentId}` });
  }
}

// Otherwise, treat as regular prompt
// ... existing prompt handling ...
```

### Option 2: Ensure Command Webhooks Are Properly Registered

**Check:**
- Command `discover_trends` is registered for agent `trendputer` (or UUID)
- Webhook URL is correct and accessible
- Command registration includes proper routing logic

**Database Check:**
```sql
SELECT * FROM agent_custom_commands 
WHERE agent_id = 'trendputer' OR agent_id = '<trendputer-uuid>'
AND command_name = 'discover_trends';
```

---

## Agent ID Format

### Question: String vs UUID
The SDK is using agent ID `"trendputer"` (string), but the backend might expect:
- UUID: `ce7078e8-dd90-49e2-b232-2b362704ccd7`
- Slug: `trendputer`
- Other format?

**Need to confirm:** What format does the backend expect for `agentId` in `/x402/{chain}/{agentId}`?

---

## Testing

### Test Case 1: Direct Endpoint Test
```bash
curl -X POST http://localhost:3007/solana/trendputer \
  -H "Content-Type: application/json" \
  -d '{
    "message": "{\"command\":\"discover_trends\",\"keywords\":[\"crypto\"],\"maxResults\":5}"
  }'
```

**Expected:** 402 Payment Required response  
**Actual:** 404 Not Found

### Test Case 2: Check Agent Exists
```bash
curl http://localhost:3007/solana/resources
```

**Check:** Does `trendputer` appear in the resources list?

### Test Case 3: Check Command Registration
```bash
# Check if command is registered
curl http://localhost:3007/api/v1/agents/trendputer/commands
# or
curl http://localhost:3007/api/v1/agents/ce7078e8-dd90-49e2-b232-2b362704ccd7/commands
```

---

## Files Involved

### SDK Side (Working Correctly)
- `packages/sdk/src/index.ts` - Command formatting
- `packages/sdk/src/api.ts` - x402 request handling
- `examples/marketputer/src/orchestrator.ts` - Command usage

### Backend Side (Needs Fix)
- `/x402/{chain}/{agentId}` endpoint handler - Command detection/routing
- Command registration system - Webhook lookup
- `/api/v1/trendputer/discover_trends` - Separate endpoint (may need integration)

---

## Priority

**🔴 HIGH PRIORITY** - This blocks all command-based agent interactions:
- `discover_trends` (trendputer)
- `generate_brief` (briefputer)
- `describe_image` (imagedescripterputer)
- `generate_captions` (captionputer)
- `post_telegram` (broadcastputer)

---

## Questions for Backend Team

1. **Agent ID Format:** Does `/x402/{chain}/{agentId}` expect UUID or string slug?
2. **Command Detection:** Is command detection implemented in the x402 endpoint handler?
3. **Command Registration:** How are custom commands registered and looked up?
4. **Webhook Integration:** Are command webhooks integrated into the x402 payment flow?
5. **Separate Endpoint:** Should `/api/v1/trendputer/discover_trends` be integrated into x402 flow, or is it separate?

---

## Additional Context

### SDK Command Detection Logic
The SDK determines if a command needs JSON payload based on:
```typescript
const jsonPayloadCommands = [
  'describe_image', 
  'generate_captions', 
  'post_telegram', 
  'discover_trends'
];

// If command is in list OR params are complex objects:
const message = JSON.stringify({ command: cmd, ...params });
// Otherwise:
const message = `/${cmd} ${params.join(' ')}`;
```

### Current Request Format
```json
{
  "message": "{\"command\":\"discover_trends\",\"keywords\":[\"crypto\"],\"maxResults\":10}"
}
```

The `message` field contains a JSON-stringified command object.

---

## Next Steps

1. **Backend:** Implement command detection in `/x402/{chain}/{agentId}` handler
2. **Backend:** Ensure command webhooks are properly routed through x402 flow
3. **Backend:** Verify agent ID format (UUID vs string)
4. **Testing:** Test command routing with `discover_trends`
5. **SDK:** No changes needed (working correctly)

---

**Reported:** 2024-01-XX  
**Status:** Awaiting backend fix  
**Impact:** All command-based agent interactions blocked

