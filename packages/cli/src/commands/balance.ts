import { Command } from "commander";
import { Connection } from "@solana/web3.js";
import ora from "ora";
import chalk from "chalk";
import { loadConfig, getDefaultWalletPath } from "../lib/config.js";
import { loadWallet, formatPublicKey } from "../lib/wallet.js";
import { getUsdcBalance } from "../lib/x402Client.js";
import {
  formatError,
  formatSuccess,
  formatPrice,
} from "../utils/formatting.js";

export function createBalanceCommand(): Command {
  return new Command("balance")
    .description("Check your wallet's USDC balance")
    .option("-w, --wallet <path>", "Path to Solana wallet keypair")
    .option("--json", "Output in JSON format")
    .action(async (options) => {
      try {
        const config = loadConfig();
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

        // Load wallet
        const spinner = options.json ? null : ora("Loading wallet...").start();
        const wallet = loadWallet(walletPath);

        if (spinner) {
          spinner.text = "Checking USDC balance...";
        }

        // Connect and get balance
        const connection = new Connection(rpcUrl, "confirmed");
        const balance = await getUsdcBalance(connection, wallet);

        if (spinner) {
          spinner.stop();
        }

        // Output results
        if (options.json) {
          console.log(
            JSON.stringify(
              {
                wallet: wallet.publicKey.toBase58(),
                balance,
                currency: "USDC",
              },
              null,
              2,
            ),
          );
        } else {
          console.log();
          console.log(formatSuccess("💰 Wallet Balance"));
          console.log();
          console.log(
            `  Address: ${formatPublicKey(wallet.publicKey.toBase58())}`,
          );
          console.log(`  Balance: ${chalk.bold.green(formatPrice(balance))}`);
          console.log();

          if (balance < 0.1) {
            console.log(
              chalk.yellow(
                "⚠️  Low balance! You may not have enough USDC to interact with agents.",
              ),
            );
            console.log(
              chalk.gray(
                "   Most agents cost between $0.01-$0.10 per interaction.",
              ),
            );
            console.log();
          }
        }
      } catch (error: any) {
        console.error(formatError(error.message || "Failed to check balance"));
        process.exit(1);
      }
    });
}
