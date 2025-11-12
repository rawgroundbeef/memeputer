import { Command } from "commander";
import { Connection } from "@solana/web3.js";
import ora from "ora";
import chalk from "chalk";
import { loadConfig, getDefaultWalletPath } from "../lib/config.js";
import { loadWallet, formatPublicKey } from "../lib/wallet.js";
import { Memeputer } from "@memeputer/sdk";
import {
  formatSuccess,
  formatError,
  formatInfo,
  formatAgent,
} from "../utils/formatting.js";

export function createPromptCommand(): Command {
  return new Command("prompt")
    .description("Prompt any agent with a message (pays via x402 with $0 gas fees!)")
    .argument("<agent>", "Agent ID (e.g., memeputer, tradeputer, pfpputer)")
    .argument("<message>", "Your message or question")
    .option("-w, --wallet <path>", "Path to Solana wallet keypair")
    .option("--json", "Output in JSON format")
    .option("-q, --quiet", "Suppress progress output")
    .option("--download <path>", "Download media to specified path")
    .action(async (agentName: string, message: string, options) => {
      try {
        const config = loadConfig();
        const apiUrl = config.apiUrl!;
        const rpcUrl = config.rpcUrl!;
        const walletPath =
          options.wallet || config.wallet || getDefaultWalletPath();

        if (!walletPath) {
          console.error(
            formatError(
              "No wallet specified. Use --wallet or set MEMEPUTER_WALLET",
            ),
          );
          process.exit(1);
        }

        const quiet = options.quiet || options.json;
        const agentId = agentName.toLowerCase();

        // Load wallet
        let spinner = quiet ? null : ora("Loading wallet...").start();
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

        // Create SDK instance
        const memeputer = new Memeputer({
          apiUrl,
          rpcUrl,
          wallet,
          connection,
        });

        // Call agent with prompt
        spinner = quiet
          ? null
          : ora(
              `Prompting ${formatAgent(agentName)}... (processing payment via x402)`,
            ).start();

        const result = await memeputer.prompt({
          agentId,
          message,
        });

        if (spinner) {
          spinner.succeed(`Response received from ${formatAgent(agentName)}`);
        }

        // Handle async operations - automatically wait if statusUrl is present
        if (result.statusUrl) {
          spinner = quiet
            ? null
            : ora("Waiting for operation to complete...").start();

          const statusResult = await memeputer.pollStatus(result.statusUrl, {
            intervalMs: 5000,
            maxAttempts: 60,
            onProgress: (attempt, status) => {
              if (spinner && attempt > 1) {
                const elapsed = attempt * 5;
                spinner.text = `Waiting... (${elapsed}s, status: ${status.status})`;
              }
            },
          });

          if (spinner) {
            if (statusResult.status === "completed") {
              spinner.succeed("Operation completed!");
            } else {
              spinner.fail(
                `Operation ${statusResult.status}: ${statusResult.error || "Unknown error"}`,
              );
            }
          }

          // Update result with completed data
          if (statusResult.imageUrl) {
            result.imageUrl = statusResult.imageUrl;
          }
          if (statusResult.mediaUrl) {
            result.mediaUrl = statusResult.mediaUrl;
          }
          if (statusResult.message) {
            result.response = statusResult.message;
          }

          // Handle download if requested
          if (options.download && (result.imageUrl || result.mediaUrl)) {
            const downloadUrl = result.imageUrl || result.mediaUrl;

            // Generate unique filename with timestamp if downloading to avoid overwriting
            const path = await import("path");
            const downloadPath = options.download;
            const ext = path.extname(downloadPath);
            const base = path.basename(downloadPath, ext);
            const dir = path.dirname(downloadPath);
            const timestamp = new Date()
              .toISOString()
              .replace(/[:.]/g, "-")
              .slice(0, -5);
            const uniquePath = path.join(dir, `${base}-${timestamp}${ext}`);

            spinner = quiet ? null : ora(`Downloading...`).start();

            try {
              const axios = (await import("axios")).default;
              const fs = (await import("fs")).default;
              const response = await axios.get(downloadUrl!, {
                responseType: "arraybuffer",
              });
              fs.writeFileSync(uniquePath, response.data);

              if (spinner) {
                spinner.succeed(`Downloaded to ${uniquePath}`);
              }
            } catch (downloadError: any) {
              if (spinner) {
                spinner.fail(`Download failed: ${downloadError.message}`);
              }
            }
          }
        }

        // Output results
        if (options.json) {
          console.log(
            JSON.stringify(
              {
                success: result.success,
                response: result.response,
                format: result.format,
                mediaUrl: result.mediaUrl,
                imageUrl: result.imageUrl,
                statusUrl: result.statusUrl,
                etaSeconds: result.etaSeconds,
                signature: result.transactionSignature,
                agent: agentName,
              },
              null,
              2,
            ),
          );
        } else {
          console.log();
          console.log(formatSuccess(`${agentName} says:`));
          console.log();
          console.log(chalk.white(result.response));
          console.log();

          if (result.imageUrl) {
            console.log(
              formatInfo(`🖼️  Image: ${chalk.underline(result.imageUrl)}`),
            );
          }

          if (result.mediaUrl && !result.imageUrl) {
            console.log(
              formatInfo(`📎 Media: ${chalk.underline(result.mediaUrl)}`),
            );
          }

          if (result.transactionSignature) {
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
          console.log();
        }
      } catch (error: any) {
        console.error(formatError(error.message || "Failed to get response"));
        process.exit(1);
      }
    });
}
