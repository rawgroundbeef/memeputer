import { Command } from "commander";
import ora from "ora";
import { loadConfig } from "../lib/config.js";
import { AgentsApiClient } from "@memeputer/sdk";
import {
  formatError,
  formatTable,
  formatPrice,
  formatAgent,
} from "../utils/formatting.js";

export function createAgentsCommand(): Command {
  return new Command("agents")
    .description("List all available AI agents")
    .option("--json", "Output in JSON format")
    .action(async (options) => {
      try {
        const config = loadConfig();
        const apiUrl = config.apiUrl!;

        const spinner = options.json ? null : ora("Fetching agents...").start();
        const client = new AgentsApiClient(apiUrl);
        const agents = await client.listAgents();

        if (spinner) {
          spinner.stop();
        }

        if (options.json) {
          console.log(JSON.stringify(agents, null, 2));
        } else {
          console.log();
          console.log("🤖 Available Memeputer Agents");
          console.log();

          formatTable(
            ["Agent", "Description", "Price", "Category"],
            agents.map((agent) => [
              formatAgent(agent.name),
              agent.description.slice(0, 50) +
                (agent.description.length > 50 ? "..." : ""),
              formatPrice(agent.price),
              agent.category,
            ]),
          );

          console.log();
          console.log("💡 Usage:");
          console.log(
            '  memeputer pfp "your prompt" --wallet ~/.config/solana/id.json',
          );
          console.log('  memeputer prompt veOputer "your message"');
          console.log();
        }
      } catch (error: any) {
        console.error(formatError(error.message || "Failed to fetch agents"));
        process.exit(1);
      }
    });
}
