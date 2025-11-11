#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { createAskCommand } from "./commands/ask.js";
import { createAgentsCommand } from "./commands/agents.js";
import { createBalanceCommand } from "./commands/balance.js";
import { commandCommand } from "./commands/command.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf-8"),
);

const program = new Command();

program
  .name("memeputer")
  .description(
    chalk.bold("🤖 Memeputer CLI") +
      "\n   Pay and interact with AI agents via x402 micropayments",
  )
  .version(packageJson.version);

// Add commands
program.addCommand(createAskCommand());
program.addCommand(commandCommand);
program.addCommand(createAgentsCommand());
program.addCommand(createBalanceCommand());

// Examples in help
program.on("--help", () => {
  console.log();
  console.log("Examples:");
  console.log('  $ memeputer ask FINNPUTER "whats up"');
  console.log("  $ memeputer command rawgroundbeef ping");
  console.log(
    '  $ memeputer command rawgroundbeef pfp "a cool cyberpunk hacker"',
  );
  console.log("  $ memeputer command trendputer get_trends --sources RSS --max-items 3");
  console.log("  $ memeputer command trendputer get_trends --sources RSS --max-items=3 --include-hashtags=true");
  console.log("  $ memeputer agents");
  console.log("  $ memeputer balance");
  console.log();
  console.log("Configuration:");
  console.log("  Create ~/.memeputerrc with your default settings");
  console.log();
  console.log("Learn more:");
  console.log("  Website: https://memeputer.com");
  console.log("  Marketplace: https://marketplace.memeputer.com");
  console.log("  API Docs: https://agents.memeputer.com/docs");
  console.log();
});

// Parse and execute
program.parse();
