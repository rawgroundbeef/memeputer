/**
 * Integration Test Suite - Run All Tests
 * 
 * Runs integration tests for all agents and their commands.
 * Verifies end-to-end functionality including payment flow.
 * 
 * Usage:
 *   pnpm test:all
 */

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define test cases (same as test.ts)
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
      qualityModifiers: ["8K", "cinematic", "artstation"],
      style: "artistic",
      detailLevel: "high",
    },
  },
  imagedescripterputer: {
    describe_image: {
      imageUrl: "https://memeputer.com/logo.png",
      detailLevel: "detailed",
    },
  },
  memeputer: {
    ping: undefined,
  },
};

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Testing All Agents and Commands");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const agents = Object.keys(AGENT_TEST_CASES);
  let passed = 0;
  let failed = 0;
  const failures: Array<{ agent: string; command: string; error: string }> = [];

  for (const agentId of agents) {
    const commands = Object.keys(AGENT_TEST_CASES[agentId]);
    console.log(`\n📋 Testing ${agentId} (${commands.length} command${commands.length > 1 ? 's' : ''})`);
    
    for (const command of commands) {
      try {
        console.log(`\n  → ${agentId}.${command}`);
        const params = AGENT_TEST_CASES[agentId][command];
        const paramsArg = params !== undefined ? `'${JSON.stringify(params)}'` : '';
        execSync(`tsx test.ts ${agentId} ${command} ${paramsArg}`, {
          stdio: 'inherit',
          cwd: __dirname,
          shell: '/bin/zsh', // Use zsh to handle quotes properly
        });
        passed++;
        console.log(`  ✅ Passed`);
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        failures.push({ agent: agentId, command, error: errorMsg });
        console.log(`  ❌ Failed: ${errorMsg}`);
      }
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Test Summary");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach(f => {
      console.log(`  ${f.agent}.${f.command}: ${f.error}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});

