/**
 * Integration Test Script for Agent Commands
 * 
 * Tests agent commands end-to-end, including payment flow and response parsing.
 * 
 * Usage:
 *   pnpm test <agentId> [command] [paramsJson]
 * 
 * Examples:
 *   pnpm test keywordputer                    # Test all keywordputer commands
 *   pnpm test keywordputer keywords   # Test specific command
 *   pnpm test keywordputer keywords '{"text":"test"}'  # Test with params
 *   pnpm test trendputer select_best_trend '{"trendTitles":["NFL","Crypto"],"task":"test"}'
 *   pnpm test memeputer ping                  # Test command without params
 */

import { Memeputer } from "@memeputer/sdk";
import { loadConfig } from "./lib/config";
import { showPaymentDetails } from "./lib/payment";
import { loadWallet } from "./lib/wallet";
import { checkBalance } from "./lib/balance";
import { Connection } from "@solana/web3.js";

const config = loadConfig();

// Define test cases for each agent
const AGENT_TEST_CASES: Record<string, Record<string, any>> = {
  keywordputer: {
    keywords: {
      text: "Find relevant topics and create a meme about them",
      context: "Creating content for Solana community",
      targetAudience: "Solana degens",
      contentGoal: "meme",
      maxKeywords: 10,
    },
  },
  trendputer: {
    discover_trends: {
      keywords: ["crypto", "solana"],
      context: "Find relevant topics and create a meme about them",
      maxResults: 5,
      includeHashtags: true,
      includeUrl: true,
    },
    select_best_trend: {
      trends: ["NFL", "Crypto", "AI"],
      context: "Find relevant topics and create a meme about them",
      includeReasoning: true,
    },
  },
  promptputer: {
    enhance_prompt: {
      basePrompt: "a cyberpunk samurai",
    },
  },
  imagedescripterputer: {
    describe_image: {
      imageUrl: "https://memeputer.com/logo.png",
      detailLevel: "detailed",
    },
  },
  memeputer: {
    ping: undefined, // No params
  },
};

async function main() {
  const agentId = process.argv[2];
  const command = process.argv[3];
  const paramsJson = process.argv[4];

  if (!agentId) {
    console.error("Usage: pnpm test <agentId> [command] [paramsJson]");
    console.error("");
    console.error("Examples:");
    console.error("  pnpm test keywordputer                    # Test base endpoint (chat) + all commands");
    console.error("  pnpm test keywordputer keywords   # Test specific command only");
    console.error("  pnpm test keywordputer keywords '{\"text\":\"test\"}'  # Test with custom params");
    console.error("  pnpm test memeputer ping                  # Test command without params");
    console.error("");
    console.error("Available agents:");
    Object.keys(AGENT_TEST_CASES).forEach(agent => {
      const commands = Object.keys(AGENT_TEST_CASES[agent]);
      console.error(`  ${agent}: ${commands.join(", ")}`);
    });
    process.exit(1);
  }

  const wallet = loadWallet(config.walletPath);
  const connection = new Connection(config.rpcUrl, "confirmed");
  await checkBalance(wallet, connection);

  const memeputer = new Memeputer({
    apiUrl: config.apiUrl,
    chain: config.chain,
    wallet,
    connection,
    verbose: true,
  });

  // Get test cases for this agent
  const agentTests = AGENT_TEST_CASES[agentId];
  if (!agentTests) {
    console.error(`❌ Unknown agent: ${agentId}`);
    console.error(`Available agents: ${Object.keys(AGENT_TEST_CASES).join(", ")}`);
    process.exit(1);
  }

  // If command specified, test only that command
  if (command) {
    await testCommand(memeputer, agentId, command, paramsJson, agentTests[command]);
  } else {
    // Test all commands for this agent + base endpoint (chat)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Testing all commands + chat for: ${agentId}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // First, test base endpoint (chat)
    console.log(`\n[0] Testing: ${agentId} (base endpoint - chat)`);
    console.log("─".repeat(60));
    await testChat(memeputer, agentId);
    console.log("");

    // Then test all commands
    const commands = Object.keys(agentTests);
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      console.log(`\n[${i + 1}/${commands.length}] Testing: ${agentId}.${cmd}`);
      console.log("─".repeat(60));
      
      await testCommand(memeputer, agentId, cmd, undefined, agentTests[cmd]);
      
      if (i < commands.length - 1) {
        console.log(""); // Spacing between tests
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Completed testing all commands + chat for ${agentId}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }
}

async function testChat(
  memeputer: Memeputer,
  agentId: string
) {
  console.log(`\n💬 Testing: ${agentId} (base endpoint - chat)\n`);
  
  // Use a simple chat message to test base endpoint
  const chatMessages: Record<string, string> = {
    keywordputer: "Extract keywords from: create a meme about crypto",
    trendputer: "What are the latest trending topics?",
    promptputer: "Enhance this prompt: a cyberpunk samurai",
    briefputer: "Create a brief for a crypto meme",
    pfpputer: "Generate an image of a cat",
    imagedescripterputer: "Describe this image: https://example.com/image.jpg",
    captionputer: "Write captions for a crypto meme",
    broadcastputer: "Post to Telegram",
    memeputer: "Hello, how are you?",
  };

  const message = chatMessages[agentId] || `Hello ${agentId}, what can you do?`;
  console.log(`📝 Chat message: "${message}"`);
  console.log("");

  try {
    const result = await memeputer.prompt(agentId, message);

    console.log("\n✅ Response received:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(result.response);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    showPaymentDetails(result);

    console.log("\n✅ Chat test completed successfully!");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

async function testCommand(
  memeputer: Memeputer,
  agentId: string,
  command: string,
  customParamsJson: string | undefined,
  defaultParams: any
) {
  console.log(`\n🚀 Testing: ${agentId}.${command}\n`);

  // Determine params: custom JSON > default params > undefined
  let params: any = defaultParams;
  if (customParamsJson) {
    try {
      params = JSON.parse(customParamsJson);
      console.log("📝 Using custom parameters:");
      console.log(JSON.stringify(params, null, 2));
    } catch (error) {
      console.error("❌ Failed to parse custom params JSON:", error);
      console.log("📝 Using default parameters instead");
      params = defaultParams;
    }
  } else if (defaultParams !== undefined) {
    console.log("📝 Using default test parameters:");
    console.log(JSON.stringify(params, null, 2));
  } else {
    console.log("📝 No parameters (command doesn't require any)");
  }
  console.log("");

  try {
    const result = await memeputer.command(agentId, command, params);

    console.log("\n✅ Response received:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Try to parse as JSON for pretty printing
    try {
      const parsed = JSON.parse(result.response);
      console.log(JSON.stringify(parsed, null, 2));

      // Special handling for different response formats
      if (parsed.data) {
        if (parsed.data.keywords) {
          console.log(`\n✅ Extracted ${parsed.data.keywords.length} keywords:`);
          parsed.data.keywords.forEach((kw: string, idx: number) => {
            console.log(`   ${idx + 1}. ${kw}`);
          });
        } else if (parsed.data.selectedIndex !== undefined) {
          console.log(`\n✅ Selected trend index: ${parsed.data.selectedIndex}`);
          if (parsed.data.reasoning) {
            console.log(`💭 Reasoning: ${parsed.data.reasoning}`);
          }
        }
      }
    } catch {
      // Not JSON, print as-is
      console.log(result.response);
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    showPaymentDetails(result);

    console.log("\n✅ Test completed successfully!");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    throw error; // Re-throw so test:all can continue or fail appropriately
  }
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});

