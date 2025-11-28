import { Connection, Keypair } from "@solana/web3.js";
import { AgentsApiClient, InteractionResult, StatusCheckResult } from "./api";
import { autoDetectWallet, autoDetectRpcUrl, autoDetectApiUrl, autoDetectChain, autoDetectBaseWallet, BaseWallet } from "./utils";

export interface MemeputerConfig {
  apiUrl?: string;
  rpcUrl?: string;
  chain?: 'solana' | 'base' | string; // Blockchain to use (default: 'solana')
  wallet?: Keypair | any; // Solana Keypair or EVM Wallet
  connection?: Connection | any; // Solana Connection or EVM Provider
  verbose?: boolean; // Enable verbose logging to show x402 protocol details
}

export interface PromptOptions {
  agentId: string;
  message: string;
}

export interface CommandOptions {
  agentId: string;
  command: string;
  params?: string[] | Record<string, any>;
}

export interface PromptResult extends InteractionResult {}
export interface CommandResult extends InteractionResult {}

/**
 * Memeputer SDK - Simple interface for interacting with AI agents via x402
 */
export class Memeputer {
  private apiClient: AgentsApiClient;
  private wallet?: Keypair | any;
  private connection?: Connection | any;
  private rpcUrl?: string;
  private apiUrl: string;
  private chain: string;

  constructor(config: MemeputerConfig = {}) {
    this.chain = config.chain || autoDetectChain(); // Auto-detect or default to Solana
    this.apiUrl = config.apiUrl || autoDetectApiUrl();
    this.apiClient = new AgentsApiClient(this.apiUrl, this.chain);
    
    // Enable verbose logging if requested
    if (config.verbose) {
      this.apiClient.enableVerbose();
    }
    
    // Store config - lazy initialize wallet/connection on first use
    this.wallet = config.wallet;
    this.connection = config.connection;
    this.rpcUrl = config.rpcUrl;
  }

  /**
   * Initialize wallet and connection (called automatically on first use)
   */
  private ensureInitialized() {
    if (!this.wallet) {
      this.wallet = autoDetectWallet();
    }
    if (!this.connection) {
      const rpc = this.rpcUrl || autoDetectRpcUrl();
      this.connection = new Connection(rpc, "confirmed");
    }
  }

  /**
   * Prompt an agent with a natural language message
   * 
   * @example
   * ```ts
   * import memeputer from '@memeputer/sdk';
   * 
   * // Simple string overload
   * const result = await memeputer.prompt("memeputer", "Hello, how are you?");
   * 
   * // Or object syntax
   * const result = await memeputer.prompt({
   *   agentId: "memeputer",
   *   message: "Hello, how are you?"
   * });
   * 
   * console.log(result.response);
   * ```
   */
  async prompt(options: PromptOptions | string, message?: string): Promise<PromptResult> {
    this.ensureInitialized();
    
    // Support both object and string overloads
    const agentId = typeof options === 'string' ? options : options.agentId;
    const msg = typeof options === 'string' ? (message || '') : options.message;
    
    return this.apiClient.interact(
      agentId,
      msg,
      this.wallet!,
      this.connection!,
    );
  }

  /**
   * Execute a command on an agent
   * 
   * @example
   * ```ts
   * import memeputer from '@memeputer/sdk';
   * 
   * // Simple string overload (matches prompt signature)
   * const result = await memeputer.command("memeputer", "ping");
   * 
   * // With positional params
   * const result = await memeputer.command("pfpputer", "pfp", ["generate", "a cat"]);
   * 
   * // With named params (object)
   * const result = await memeputer.command("pfpputer", "pfp", { style: "anime", subject: "cat" });
   * 
   * // Or object syntax
   * const result = await memeputer.command({
   *   agentId: "pfpputer",
   *   command: "pfp",
   *   params: ["generate", "a cat wearing sunglasses"]
   * });
   * ```
   */
  async command(
    options: CommandOptions | string,
    command?: string,
    params?: string[] | Record<string, any>
  ): Promise<CommandResult> {
    this.ensureInitialized();
    
    let agentId: string;
    let cmd: string;
    let paramsObj: Record<string, any> | undefined;
    
    if (typeof options === 'string') {
      // String overload: command(agentId, command, params?)
      // Matches prompt signature: prompt(agentId, message)
      agentId = options;
      cmd = command || '';
      paramsObj = Array.isArray(params) ? undefined : params;
    } else {
      // Object syntax
      agentId = options.agentId;
      cmd = options.command;
      paramsObj = Array.isArray(options.params) ? undefined : options.params;
    }
    
    // Commands that expect JSON payloads (not CLI format) - only for commands that need JSON even with simple params
    const jsonPayloadCommands = ['describe_image', 'generate_captions', 'post_telegram', 'discover_trends', 'enhance_prompt', 'keywords', 'select_best_trend'];
    const needsJsonPayload = jsonPayloadCommands.includes(cmd);
    
    // Check if params contain complex objects (not just primitives)
    // Arrays of primitives are considered simple and can be converted to CLI format
    const hasComplexParams = paramsObj && Object.values(paramsObj).some(value => {
      if (value === null || value === undefined) return false;
      if (Array.isArray(value)) {
        // Arrays are simple if they only contain primitives
        return value.some(item => 
          typeof item !== 'string' && 
          typeof item !== 'number' && 
          typeof item !== 'boolean' && 
          item !== null
        );
      }
      // Non-array values are complex if they're not primitives
      return typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean';
    });
    
    // If command needs JSON or params are complex, use command-specific endpoint
    if (needsJsonPayload || hasComplexParams) {
      // Use command-specific endpoint for structured commands
      // Don't include command in message - it's in the URL
      const message = ''; // Empty message for command-specific endpoint
      return this.apiClient.interact(
        agentId,
        message,
        this.wallet!,
        this.connection!,
        cmd, // Pass command name for command-specific endpoint
        paramsObj, // Pass structured params
      );
    }
    
    // Otherwise, use CLI format
    let cmdParams: string[] = [];
    
    if (typeof options === 'string') {
      if (params) {
        if (Array.isArray(params)) {
          cmdParams = params;
        } else {
          // Convert named params object to CLI format: --key value
          cmdParams = this.convertParamsToCliArgs(params);
        }
      }
    } else {
      if (options.params) {
        if (Array.isArray(options.params)) {
          cmdParams = options.params;
        } else {
          // Convert named params object to CLI format: --key value
          cmdParams = this.convertParamsToCliArgs(options.params);
        }
      }
    }
    
    // Build command message with slash prefix
    const message = cmdParams.length > 0
      ? `/${cmd} ${cmdParams.join(" ")}`
      : `/${cmd}`;

    return this.apiClient.interact(
      agentId,
      message,
      this.wallet!,
      this.connection!,
    );
  }

  /**
   * Helper to convert params object to CLI args array
   * Handles camelCase to kebab-case conversion for keys
   * Supports positional args via special '_args' or 'args' key
   * 
   * @example
   * // Pure flags
   * { refImages: ['url1', 'url2'] } -> ['--ref-images', 'url1 url2']
   * 
   * // Positional args + flags
   * { _args: ['generate', 'prompt'], refImages: ['url1'] } -> ['generate', 'prompt', '--ref-images', 'url1']
   */
  private convertParamsToCliArgs(params: Record<string, any>): string[] {
    const positionalArgs: string[] = [];
    const flags: string[] = [];
    
    // Extract positional arguments if present
    if ('_args' in params && Array.isArray(params._args)) {
      positionalArgs.push(...params._args.map(String));
    } else if ('args' in params && Array.isArray(params.args)) {
      positionalArgs.push(...params.args.map(String));
    }
    
    // Convert all other keys to flags
    for (const [key, value] of Object.entries(params)) {
      // Skip special keys used for positional args
      if (key === '_args' || key === 'args') {
        continue;
      }
      
      // Convert camelCase to kebab-case for CLI flags
      // e.g. refImages -> --ref-images
      const kebabKey = key.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
      const flag = `--${kebabKey}`;
      
      // Handle array values - spread them as separate arguments after the flag
      // e.g. { refImages: ['url1', 'url2'] } -> ['--ref-images', 'url1', 'url2']
      if (Array.isArray(value)) {
        flags.push(flag, ...value.map(String));
      } else {
        flags.push(flag, String(value));
      }
    }
    
    // Combine: positional args first, then flags
    return [...positionalArgs, ...flags];
  }

  /**
   * Check status of an async operation
   */
  async checkStatus(statusUrl: string): Promise<StatusCheckResult> {
    return this.apiClient.checkStatus(statusUrl);
  }

  /**
   * Poll status URL until completion or timeout
   * Uses retryAfterSeconds from initial HTTP 202 response if available
   */
  async pollStatus(
    statusUrl: string,
    options?: {
      maxAttempts?: number;
      intervalMs?: number;
      retryAfterSeconds?: number; // Polling interval from HTTP 202 response (default: 2s)
      onProgress?: (attempt: number, status: StatusCheckResult) => void;
    },
  ): Promise<StatusCheckResult> {
    return this.apiClient.pollStatus(statusUrl, options);
  }

  /**
   * List all available agents
   */
  async listAgents() {
    return this.apiClient.listAgents();
  }

  /**
   * Enable verbose logging to show x402 protocol details
   */
  enableVerbose() {
    this.apiClient.enableVerbose();
  }

  /**
   * Disable verbose logging
   */
  disableVerbose() {
    this.apiClient.disableVerbose();
  }
}

// Export types
export type {
  InteractionResult,
  StatusCheckResult,
  AgentInfo,
  X402Receipt,
} from "./api";

// PromptResult and CommandResult are already exported as interfaces above

export { AgentsApiClient } from "./api";
export { getUsdcBalance, getBaseUsdcBalance } from "./x402Client";
export { autoDetectBaseWallet, BaseWallet } from "./utils";

// Default export - auto-detects wallet and connection
const memeputer = new Memeputer();

export default memeputer;
