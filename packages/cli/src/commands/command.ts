import { Command } from "commander";
import { Connection } from "@solana/web3.js";
import ora, { Ora } from "ora";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { Memeputer, StatusCheckResult } from "@memeputer/sdk";
import { loadConfig, getDefaultWalletPath } from "../lib/config.js";
import { loadWallet, formatPublicKey } from "../lib/wallet.js";
import { formatInfo } from "../utils/formatting.js";

export const commandCommand = new Command("command")
  .description("Execute a custom command on an agent")
  .argument("<agent>", "Agent username or ID")
  .argument("<command>", "Command name (without the / prefix)")
  .allowUnknownOption() // Allow command-specific options like --sources, --max-items, etc.
  .option("-w, --wallet <path>", "Path to Solana wallet keypair")
  .option(
    "-d, --download <path>",
    "Download media to specified path (for async commands)",
  )
  .option("--json", "Output in JSON format")
  .option("-q, --quiet", "Suppress progress output")
  .action(
    async (
      agentName: string,
      command: string,
      options: {
        wallet?: string;
        download?: string;
        json?: boolean;
        quiet?: boolean;
        [key: string]: any; // Allow dynamic options
      },
    ) => {
      const quiet = options.quiet || options.json;
      let spinner: Ora | null = null;

      try {
        const config = loadConfig();
        const apiUrl = config.apiUrl!;
        const rpcUrl = config.rpcUrl!;
        const walletPath =
          options.wallet || config.wallet || getDefaultWalletPath();

        if (!walletPath) {
          console.error(
            chalk.red(
              "No wallet specified. Use --wallet or set MEMEPUTER_WALLET",
            ),
          );
          process.exit(1);
        }

        const agentId = agentName.toLowerCase();

        // Load wallet
        spinner = quiet ? null : ora("Loading wallet...").start();
        const wallet = loadWallet(walletPath);
        if (spinner) {
          spinner.succeed(
            `Wallet loaded: ${formatPublicKey(wallet.publicKey.toBase58())}`,
          );
        }

        // Connect to Solana
        spinner = quiet ? null : ora("Connecting to Solana...").start();
        const connection = new Connection(rpcUrl, "confirmed");
        if (spinner) {
          spinner.succeed("Connected to Solana");
        }

        // Extract command-specific options from process.argv
        // Format: memeputer command agent command-name --param1 value1 --param2 value2
        const cliOptionNames = ['wallet', 'w', 'download', 'd', 'json', 'quiet', 'q'];
        const commandParams: string[] = [];
        
        // Get the raw args after 'command agent command-name'
        const args = process.argv.slice(process.argv.indexOf(command) + 1);
        
        // Parse named parameters: --param value or --param=value
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          
          // Skip CLI options (handled by Commander)
          if (cliOptionNames.some(opt => arg === `--${opt}` || arg === `-${opt}`)) {
            i++; // Skip the value too
            continue;
          }
          
          // Handle --param=value format
          if (arg.startsWith('--') && arg.includes('=')) {
            const [key, value] = arg.substring(2).split('=');
            if (!cliOptionNames.includes(key)) {
              commandParams.push(value);
            }
          }
          // Handle --param value format
          else if (arg.startsWith('--') && !arg.includes('=')) {
            const key = arg.substring(2);
            if (!cliOptionNames.includes(key) && i + 1 < args.length) {
              const value = args[i + 1];
              // Check if next arg is not another option
              if (!value.startsWith('-')) {
                commandParams.push(value);
                i++; // Skip the value
              }
            }
          }
          // Handle positional arguments (for backward compatibility)
          else if (!arg.startsWith('-')) {
            commandParams.push(arg);
          }
        }
        
        // Build the message with slash prefix
        // Format: /command param1 param2 param3
        const message = commandParams.length > 0
          ? `/${command} ${commandParams.join(" ")}`
          : `/${command}`;

        spinner = quiet
          ? null
          : ora(`Executing /${command} on ${agentId}...`).start();

        const memeputer = new Memeputer({
          apiUrl,
          rpcUrl,
          wallet,
          connection,
        });

        const result = await memeputer.command({
          agentId,
          command,
          params: commandParams,
        });

        // Check if this is an async operation
        if (result.statusUrl) {
          if (spinner) {
            spinner.text = `Operation started. Waiting for completion...`;
          }

          // Poll for completion
          const finalResult = await memeputer.pollStatus(result.statusUrl, {
            intervalMs: 5000,
            maxAttempts: 60,
            onProgress: (attempt: number, status: StatusCheckResult) => {
              if (spinner && attempt > 1) {
                const elapsed = attempt * 5;
                spinner.text = `Waiting... (${elapsed}s, status: ${status.status})`;
              }
            },
          });

          if (spinner) {
            if (finalResult.status === "completed") {
              spinner.succeed("Operation completed!");
            } else {
              spinner.fail(
                `Operation ${finalResult.status}: ${finalResult.error || "Unknown error"}`,
              );
            }
          }

          // Update result with final data
          result.response = finalResult.message || result.response;
          result.imageUrl = finalResult.imageUrl || result.imageUrl;
          result.mediaUrl = finalResult.mediaUrl || result.mediaUrl;

          // Download if requested
          if (options.download && (result.imageUrl || result.mediaUrl)) {
            spinner = quiet ? null : ora("Downloading media...").start();
            const mediaUrl = result.imageUrl || result.mediaUrl;

            const response = await fetch(mediaUrl!);
            const buffer = await response.arrayBuffer();

            // Add timestamp to filename to prevent overwriting
            const timestamp = new Date()
              .toISOString()
              .replace(/[:.]/g, "-")
              .slice(0, -5);
            const ext = path.extname(mediaUrl!) || ".png";
            const basename = path.basename(options.download, ext);
            const dirname = path.dirname(options.download);
            const timestampedPath = path.join(
              dirname,
              `${basename}-${timestamp}${ext}`,
            );

            fs.writeFileSync(timestampedPath, Buffer.from(buffer));
            if (spinner) {
              spinner.succeed(
                chalk.green(`✓ Media downloaded to: ${timestampedPath}`),
              );
            }
          }
        } else if (spinner) {
          spinner.succeed(chalk.green("✓ Command executed"));
        }

        // Display result
        if (!quiet) {
          console.log("");
          console.log(chalk.bold("Response:"));
          console.log(result.response);

          if (result.imageUrl) {
            console.log("");
            console.log(chalk.blue(`🖼️  Image: ${result.imageUrl}`));
          }

          if (result.mediaUrl) {
            console.log("");
            console.log(chalk.blue(`📁 Media: ${result.mediaUrl}`));
          }

          if (result.transactionSignature) {
            console.log("");
            console.log(
              formatInfo(
                `💳 Transaction: ${chalk.underline(`https://solscan.io/tx/${result.transactionSignature}`)}`,
              ),
            );
            console.log(
              chalk.green(
                "💚 You paid $0 in gas fees (PayAI Facilitator covered it)!",
              ),
            );
          }

          console.log("");
        } else if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        }
      } catch (error: any) {
        if (spinner) {
          spinner.fail(chalk.red("✗ Command failed"));
        }

        if (!quiet) {
          console.error("");
          console.error(chalk.red("Error:"), error.message);

          if (error.response?.data) {
            console.error(
              chalk.gray(JSON.stringify(error.response.data, null, 2)),
            );
          }
        }

        process.exit(1);
      }
    },
  );
