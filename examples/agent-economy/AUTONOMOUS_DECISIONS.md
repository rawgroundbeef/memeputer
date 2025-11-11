# Autonomous Decisions in Orchestrator Agent

This document highlights the specific code areas where the Orchestrator Agent makes **autonomous decisions** - demonstrating it's not just a pipeline, but a true agent-to-agent economy.

---

## 🎯 Decision Point 1: Should I hire TrendPuter?

**Location:** Lines 75-90

```typescript
// Step 1: Find trends (if needed)
let trends: any = null;
if (request.task.toLowerCase().includes('trend') || request.task.toLowerCase().includes('meme')) {
  console.log('📊 Step 1: Hiring TrendPuter to find trends...');
  const trendsResult = await this.hireAgent('trendputer', 'get_trends', {
    sources: ['X'],
    maxItems: 5,
  }, 0.10); // Pay $0.10
```

**Decision:** The agent analyzes the task and decides if it needs trends. It's not told to get trends - it decides based on keywords.

**Why it's autonomous:** The agent could skip this step if the task doesn't mention trends or memes. It's making a judgment call.

---

## 🎯 Decision Point 2: Should I hire BriefPuter?

**Location:** Lines 92-124

```typescript
// Step 2: Create brief (if needed)
let brief: any = null;
if (trends || request.task.toLowerCase().includes('create') || request.task.toLowerCase().includes('meme')) {
  console.log('📝 Step 2: Hiring BriefPuter to create a brief...');
  const trendItem = trends?.items?.[0] || {
    title: request.task,
    summary: request.task,
    source: 'USER',
  };
  const briefResult = await this.hireAgent('briefputer', 'generate_brief', {
    // ... parameters
  }, 0.20); // Pay $0.20
```

**Decision:** The agent decides if it needs a brief. It also decides which trend item to use (picks the first one, but could be smarter).

**Why it's autonomous:** 
- Decides whether brief is needed
- Chooses which trend to use
- Creates fallback data if no trends available

---

## 🎯 Decision Point 3: Should I hire PFPputer? How do I handle async?

**Location:** Lines 126-177

```typescript
// Step 3: Generate image (if needed)
let imageUrl: string | null = null;
if (brief || request.task.toLowerCase().includes('image') || request.task.toLowerCase().includes('meme')) {
  console.log('🎨 Step 3: Hiring PFPputer to generate image...');
  const prompt = brief?.brief?.angle || request.task;  // ← DECISION: Which prompt to use?
  const imageResult = await this.hireAgent('pfpputer', 'pfp', {
    message: `/pfp generate ${prompt}`,
  }, 0.50); // Pay $0.50
  
  // ... extract image URL logic ...
  
  // Check for statusUrl (async image generation) - need to poll
  if (!imageUrl && imageResult.statusUrl) {
    console.log(`   ⏳ Image generation in progress, polling statusUrl...`);
    // Poll for image completion  // ← DECISION: Wait for async operation
    imageUrl = await this.pollImageStatus(imageResult.statusUrl);
  }
}
```

**Decisions:**
1. Should I generate an image? (checks conditions)
2. What prompt should I use? (uses brief angle or falls back to task)
3. Should I wait for async image? (decides to poll statusUrl)

**Why it's autonomous:** The agent handles async operations autonomously - it doesn't give up, it waits and polls until done.

---

## 🎯 Decision Point 4: Should I generate a caption?

**Location:** Lines 179-208

```typescript
// Step 4: Generate caption (if needed)
let caption: string | null = null;
if (brief) {  // ← DECISION: Only if brief exists
  console.log('✍️  Step 4: Hiring BriefPuter to generate caption...');
  const trendItem = trends?.items?.[0] || {  // ← DECISION: Which trend to use?
    title: request.task,
    summary: request.task,
    source: 'USER',
  };
  const captionResult = await this.hireAgent('briefputer', 'generate_captions', {
    // ... parameters
  }, 0.10); // Pay $0.10
}
```

**Decision:** Only generates caption if brief exists. Could skip this step entirely.

**Why it's autonomous:** The agent decides the workflow based on what it has so far.

---

## 🎯 Decision Point 5: Should I post to social media?

**Location:** Lines 210-288

```typescript
// Step 5: Post to social media (if image and caption are ready)
let postedLinks: { telegram?: string; farcaster?: string } = {};
if (imageUrl && caption) {  // ← DECISION: Only post if both exist
  const telegramChatId = process.env.TELEGRAM_CHAT_ID || process.env.MEMEPUTER_TELEGRAM_CHAT_ID;
  
  if (telegramChatId) {  // ← DECISION: Post to Telegram?
    console.log('📱 Step 5: Hiring BroadcastPuter to post to Telegram...');
    const telegramResult = await this.hireAgent('broadcastputer', 'post_telegram', {
      chatId: telegramChatId,
      caption: caption,
      imageUrl: imageUrl,
    }, 0.10); // Pay $0.10
  } else {
    console.log('📱 Step 5: Skipping Telegram post (chat ID not configured)');
  }
  
  // ... Farcaster logic ...
} else {
  if (!imageUrl) {
    console.log('📱 Step 5: Skipping social media post (no image generated)');
  }
  if (!caption) {
    console.log('📱 Step 5: Skipping social media post (no caption generated)');
  }
}
```

**Decisions:**
1. Should I post? (only if image AND caption exist)
2. Should I post to Telegram? (checks if chat ID configured)
3. Should I post to Farcaster? (checks if credentials available)
4. Should I skip posting? (if prerequisites missing)

**Why it's autonomous:** The agent decides whether to post based on what it has accomplished. It won't post incomplete work.

---

## 🎯 Decision Point 6: THE KEY ONE - Paying from its own wallet

**Location:** Lines 330-360 (`hireAgent` method)

```typescript
private async hireAgent(
  agentId: string,
  command: string,
  payload: any,
  maxBudgetUsdc: number  // ← DECISION: How much am I willing to pay?
): Promise<InteractionResult> {
  console.log(`\n   💸 Paying ${agentId} up to ${maxBudgetUsdc} USDC...`);
  console.log(`      Command: ${command}`);
  console.log(`      From wallet: ${this.wallet.publicKey.toString().slice(0, 8)}...`);

  const message = JSON.stringify({
    command,
    ...payload,
  });

  // Call the agent using x402 - the orchestrator agent pays!
  const result = await this.apiClient.interact(
    agentId,
    message,
    this.wallet, // ← THIS IS THE KEY: Orchestrator's wallet pays the agent
    this.connection
  );

  // Track payment
  if (result.transactionSignature) {
    const estimatedAmount = maxBudgetUsdc;
    this.totalSpent += estimatedAmount;  // ← DECISION: Track spending
    this.agentsHired.push(agentId);
    this.payments.push({
      agentId,
      amount: estimatedAmount,
      txId: result.transactionSignature,
    });
  }

  return result;
}
```

**This is THE KEY difference:**

1. **`this.wallet`** - Uses Orchestrator's OWN wallet (not user's wallet)
2. **`maxBudgetUsdc`** - Decides how much to pay each agent
3. **`this.totalSpent`** - Tracks its own spending
4. **`this.agentsHired`** - Tracks which agents it hired

**Why it's autonomous:** The agent is spending its own money. It's not a proxy - it's an economic actor.

---

## 🎯 Decision Point 7: Budget Management

**Location:** Throughout, but especially lines 304-306

```typescript
console.log(`\n✅ Task completed!`);
console.log(`   Total spent: ${this.totalSpent.toFixed(4)} USDC`);
console.log(`   Remaining budget: ${(request.budgetUsdc - this.totalSpent).toFixed(4)} USDC`);
```

**Decision:** The agent tracks its spending against the budget. In a more advanced version, it could:
- Decide to stop if budget runs low
- Choose cheaper agents if budget is tight
- Save money for future tasks

**Why it's autonomous:** The agent is managing its own finances, not just executing commands.

---

## Summary: What Makes It Autonomous

1. **Conditional Logic** - Decides which agents to hire based on task analysis
2. **Fallback Handling** - Creates fallback data if agents don't return expected results
3. **Async Handling** - Waits for long-running operations (image generation)
4. **Budget Tracking** - Tracks its own spending
5. **Error Handling** - Decides whether to continue or skip steps
6. **Own Wallet** - Pays from `this.wallet` (its own wallet, not user's)

**The key line:** `this.wallet` in `hireAgent` - that's the Orchestrator Agent's own wallet paying other agents. That's what makes it agent-to-agent, not a pipeline.

