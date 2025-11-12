import ora, { Ora } from 'ora';

/**
 * Clean, consistent logging system for the agent economy
 * Provides only a few log types: section titles, results, and payment details
 */
export class CleanLogger {
  private currentSpinner: Ora | null = null;

  /**
   * Check if stdin is available for spinner (can change during shutdown)
   */
  private isTTYAvailable(): boolean {
    try {
      return process.stdin.isTTY && process.stdin.readable && !process.stdin.destroyed;
    } catch {
      return false;
    }
  }

  /**
   * Log a section title (step header)
   * Example: "Step 1: Getting focus plan"
   * Agent name is shown separately
   */
  section(title: string, agent?: string): void {
    // Stop any existing spinner
    if (this.currentSpinner) {
      try {
        this.currentSpinner.stop();
      } catch (e) {
        // Ignore errors when stopping spinner (e.g., stdin unavailable)
      }
      this.currentSpinner = null;
    }
    
    // Add spacing before new section
    console.log('');
    console.log(`\x1b[1m${title}\x1b[0m`); // Bold
    if (agent) {
      console.log(`   Agent: ${agent}`);
    }
  }

  /**
   * Start a loading spinner for a section
   * Returns the spinner so it can be stopped later
   */
  startLoading(text: string): Ora | null {
    // Stop any existing spinner
    if (this.currentSpinner) {
      try {
        this.currentSpinner.stop();
      } catch (e) {
        // Ignore errors when stopping spinner (e.g., stdin unavailable)
      }
    }
    
    // Only use spinner if stdin is available (TTY)
    if (!this.isTTYAvailable()) {
      console.log(`   ${text}...`);
      return null;
    }
    
    try {
      this.currentSpinner = ora({
        text: `   ${text}`,
        spinner: 'dots',
        stream: process.stdout, // Explicitly use stdout
      }).start();
      
      return this.currentSpinner;
    } catch (e) {
      // If spinner fails (e.g., EIO error), fall back to plain text
      console.log(`   ${text}...`);
      return null;
    }
  }

  /**
   * Stop the current spinner and show success
   */
  stopLoading(successText?: string): void {
    if (this.currentSpinner) {
      try {
        if (successText) {
          this.currentSpinner.succeed(`   ${successText}`);
        } else {
          this.currentSpinner.stop();
        }
      } catch (e) {
        // Ignore errors when stopping spinner (e.g., stdin unavailable)
        if (successText) {
          console.log(`   ✅ ${successText}`);
        }
      }
      this.currentSpinner = null;
    }
  }

  /**
   * Stop the current spinner and show failure
   */
  failLoading(failText: string): void {
    if (this.currentSpinner) {
      try {
        this.currentSpinner.fail(`   ${failText}`);
      } catch (e) {
        // Ignore errors when stopping spinner (e.g., stdin unavailable)
        console.log(`   ❌ ${failText}`);
      }
      this.currentSpinner = null;
    }
  }

  /**
   * Log a result (single line output)
   * Example: "✅ Got focus plan: 3 keywords identified"
   */
  result(icon: string, message: string): void {
    // Stop any spinner first
    if (this.currentSpinner) {
      try {
        this.currentSpinner.stop();
      } catch (e) {
        // Ignore errors when stopping spinner (e.g., stdin unavailable)
      }
      this.currentSpinner = null;
    }
    
    console.log(`   ${icon} ${message}`);
  }

  /**
   * Log payment details in a concise format
   */
  payment(details: {
    agentId: string;
    amount: number;
    transactionSignature: string;
    txUrl: string;
    fromWallet?: string;
    fromWalletUrl?: string;
    toWallet?: string;
    toWalletUrl?: string;
    receiptAmount?: number;
  }): void {
    // Stop any spinner first
    if (this.currentSpinner) {
      try {
        this.currentSpinner.stop();
      } catch (e) {
        // Ignore errors when stopping spinner (e.g., stdin unavailable)
      }
      this.currentSpinner = null;
    }
    
    console.log(`   💸 ${details.amount.toFixed(4)} USDC → ${details.agentId}`);
    console.log(`      🔗 ${details.txUrl}`);
  }

  /**
   * Log an info message (for additional context)
   */
  info(message: string): void {
    console.log(`   ℹ️  ${message}`);
  }

  /**
   * Log a warning
   */
  warn(message: string): void {
    console.log(`   ⚠️  ${message}`);
  }

  /**
   * Log an error
   */
  error(message: string): void {
    console.log(`   ❌ ${message}`);
  }

  /**
   * Add spacing between major sections
   */
  spacer(): void {
    console.log('');
  }
}

