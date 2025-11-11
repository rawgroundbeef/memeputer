# Agent Economy Demo Script

## Setup (Before Demo)

```bash
cd examples/agent-economy
pnpm memeputer
# or
pnpm payai
```

---

## Demo Script

### Opening Hook

"Alright, so I'm going to show you something pretty cool - an **agent-to-agent economy** where agents autonomously pay other agents to complete tasks. This isn't a pipeline where your wallet pays everyone sequentially. This is an orchestrator agent with its own wallet, making its own decisions about who to hire and paying them from its own funds."

---

### Step 1: The Task

**What you'll see:**
```
🤖 Orchestrator Agent analyzing task...
   Task: "Create a meme about Solana"
   Budget: 1.0 USDC
   Wallet: [FULL WALLET ADDRESS]

💭 Decision: I'll analyze the task and decide which agents to hire.
   Each agent will be paid from MY wallet (not yours).
```

**What to say:**
"First, I give the orchestrator agent a task: 'Create a meme about Solana' with a budget of 1 USDC. Notice this wallet address - that's the orchestrator agent's own wallet. Not mine, not yours - the agent's wallet. It has USDC in it, and it's going to spend that money to hire other agents."

---

### Step 2: First Decision - Hiring TrendPuter

**What you'll see:**
```
📊 Step 1: Deciding to hire TrendPuter for market trends...
   💭 Reasoning: Task mentions trends/memes, so I need market data

   💸 💸 💸 PAYING AGENT FROM MY WALLET 💸 💸 💸
      Agent: trendputer
      Command: get_trends
      Amount: 0.1 USDC
      From: [ORCHESTRATOR WALLET ADDRESS]
```

**What to say:**
"The agent analyzes the task and decides: 'This mentions memes, so I need market trends.' It autonomously decides to hire TrendPuter. Watch this - it's paying TrendPuter 0.1 USDC from its own wallet. That transaction is on-chain, on Solana mainnet. The orchestrator agent just spent its own money."

---

### Step 3: Second Decision - Hiring BriefPuter

**What you'll see:**
```
📝 Step 2: Deciding to hire BriefPuter for creative strategy...
   💭 Reasoning: Need creative direction before generating content
   🎨 Using brand agent: [BRAND AGENT ID]

   💸 💸 💸 PAYING AGENT FROM MY WALLET 💸 💸 💸
      Agent: briefputer
      Command: generate_brief
      Amount: 0.2 USDC
      From: [ORCHESTRATOR WALLET ADDRESS]
```

**What to say:**
"Now it's making another decision: 'I have trends, so I need a creative brief.' It hires BriefPuter and pays 0.2 USDC. Notice it's also using a brand profile - in this case, it's using the Memeputer brand agent, so the content will match that voice and style. The agent is making these decisions autonomously - I'm not telling it which agents to hire."

---

### Step 4: Third Decision - Hiring PFPputer

**What you'll see:**
```
🎨 Step 3: Deciding to hire PFPputer for image generation...
   💭 Reasoning: Need visual content to complete the task
   🖼️  Using 3 reference image(s) from brand

   💸 💸 💸 PAYING AGENT FROM MY WALLET 💸 💸 💸
      Agent: pfpputer
      Command: pfp
      Amount: 0.5 USDC
      From: [ORCHESTRATOR WALLET ADDRESS]

   ⏳ Image generation in progress, polling statusUrl...
   ✅ Image generated successfully!
```

**What to say:**
"Next decision: 'I need an image.' It hires PFPputer - the most expensive agent at 0.5 USDC. Notice it's using reference images from the brand - so the image will match the brand style. Also cool - PFPputer returns a status URL because image generation takes time. The orchestrator agent autonomously polls that URL until the image is ready. It's handling async operations on its own."

---

### Step 5: Fourth Decision - Caption Generation

**What you'll see:**
```
✍️  Step 4: Deciding to hire BriefPuter for caption generation...
   💭 Reasoning: Have brief, so I should create matching caption

   💸 💸 💸 PAYING AGENT FROM MY WALLET 💸 💸 💸
      Agent: briefputer
      Command: generate_captions
      Amount: 0.1 USDC
      From: [ORCHESTRATOR WALLET ADDRESS]
```

**What to say:**
"Another decision: 'I have a brief, so I should create a matching caption.' It hires BriefPuter again - same agent, different command. Another 0.1 USDC spent. The agent is managing its workflow based on what it has accomplished so far."

---

### Step 6: Final Decision - Social Media Posting

**What you'll see:**
```
📱 Step 5: Deciding to hire BroadcastPuter for social media posting...
   💭 Reasoning: Have complete content (image + caption), ready to publish

   💸 💸 💸 PAYING AGENT FROM MY WALLET 💸 💸 💸
      Agent: broadcastputer
      Command: post_telegram
      Amount: 0.1 USDC
      From: [ORCHESTRATOR WALLET ADDRESS]
```

**What to say:**
"Final decision: 'I have complete content - image and caption - so I should post it.' It hires BroadcastPuter to post to Telegram. Another 0.1 USDC. Notice BroadcastPuter uses its own configured bot token - the orchestrator doesn't need to provide credentials, just the chat ID."

---

### The Big Reveal - Economic Summary

**What you'll see:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ TASK COMPLETED BY AUTONOMOUS AGENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 ECONOMIC SUMMARY:
   Total spent: 1.0000 USDC
   Remaining budget: 0.0000 USDC
   Agents hired: 4
   Payments made: 5

🎯 This was NOT a pipeline - each agent was paid by the Orchestrator Agent
   from its own wallet: [ORCHESTRATOR WALLET ADDRESS]
```

**What to say:**
"Here's the key part - look at this summary. The orchestrator agent spent 1 USDC total, hired 4 different agents, made 5 payments. And notice this line: 'This was NOT a pipeline - each agent was paid by the Orchestrator Agent from its own wallet.' 

This is fundamentally different from a pipeline. In a pipeline, your wallet pays Agent 1, then Agent 2, then Agent 3 - you're paying for everything sequentially. Here, the orchestrator agent has its own wallet, makes its own decisions, and pays other agents autonomously. That's an agent-to-agent economy."

---

### Key Points to Emphasize

1. **Autonomous Decisions**: "The agent decides which agents to hire based on the task. I'm not scripting this - it's making judgment calls."

2. **Own Wallet**: "Every payment comes from the orchestrator agent's wallet. You can see the wallet address in every payment - it's the same one, the agent's wallet."

3. **Economic Actor**: "The agent is tracking its spending, managing its budget. It's not a proxy - it's an economic actor making financial decisions."

4. **Future Enhancement**: "Right now it uses simple keyword matching, but you can see the TODO comments - it could use LLM reasoning to make more sophisticated decisions. The architecture supports it."

5. **Brand Support**: "Notice it's using brand profiles - Memeputer or Pay.ai. The agent respects brand voice and style when generating content."

---

### Closing

"This is a working example of agents paying agents. Each transaction is on-chain, verifiable. The orchestrator agent is autonomous - it has its own wallet, makes its own decisions, and spends its own money. That's the future of agent economies."

---

## Quick Reference: What Makes This Different

### Pipeline (Old Way)
- User wallet → pays Agent 1 → pays Agent 2 → pays Agent 3
- Sequential, user pays for everything
- User controls the flow

### Agent Economy (New Way)
- Orchestrator wallet → pays Agent 1 → pays Agent 2 → pays Agent 3
- Autonomous, agent pays from its own wallet
- Agent controls the flow

---

## Troubleshooting Tips

If something fails:
- "The agent is handling errors autonomously - it will skip steps if prerequisites aren't met"
- "Notice it tracks spending even if steps fail - that's real economic behavior"
- "Each payment is on-chain - you can verify the transactions on Solana Explorer"

