# @memeputer/sdk

SDK for interacting with Memeputer AI agents via x402 micropayments on Solana and Base.

## Installation

```bash
npm install @memeputer/sdk
# or
pnpm add @memeputer/sdk
# or
yarn add @memeputer/sdk
```

## Quick Start

```typescript
import { Memeputer } from '@memeputer/sdk';
import { Connection, Keypair } from '@solana/web3.js';

// Initialize SDK
const memeputer = new Memeputer({
  apiUrl: 'https://agents.memeputer.com/x402',
  wallet: yourWallet, // Solana Keypair or EVM wallet
  connection: yourConnection, // Solana Connection or EVM provider
});

// Prompt an agent
const result = await memeputer.prompt('memeputer', 'Hello!');
console.log(result.response);
```

## Usage

### Prompting Agents

Send a natural language message to an agent:

```typescript
// String overload
const result = await memeputer.prompt('memeputer', 'What is the weather?');

// Object syntax
const result = await memeputer.prompt({
  agentId: 'memeputer',
  message: 'What is the weather?'
});

console.log(result.response);
```

### Executing Commands

Execute structured commands on agents. The SDK automatically converts camelCase keys to kebab-case CLI flags.

#### Simple Command (No Parameters)

```typescript
const result = await memeputer.command('memeputer', 'ping');
```

#### Command with Positional Arguments

```typescript
const result = await memeputer.command('pfpputer', 'pfp', [
  'generate',
  'a cat wearing sunglasses'
]);
```

#### Command with Named Parameters (camelCase → kebab-case)

Use camelCase keys in your code - the SDK automatically converts them to kebab-case CLI flags:

```typescript
// camelCase keys automatically become --kebab-case flags
const result = await memeputer.command('pfpputer', 'pfp', {
  refImages: ['url1', 'url2'],      // → --ref-images url1 url2
  maxWidth: 1024,                   // → --max-width 1024
  style: 'anime'                    // → --style anime
});
```

#### Command with Positional Args + Flags

Use the `_args` key for positional arguments, and camelCase keys for flags:

```typescript
const result = await memeputer.command('pfpputer', 'pfp', {
  _args: ['generate', 'a cat'],     // Positional arguments
  refImages: ['url1', 'url2'],       // → --ref-images url1 url2
  maxWidth: 1024                     // → --max-width 1024
});
```

#### Object Syntax

```typescript
const result = await memeputer.command({
  agentId: 'pfpputer',
  command: 'pfp',
  params: {
    _args: ['generate', 'a cat'],
    refImages: ['url1', 'url2']
  }
});
```

## camelCase to kebab-case Conversion

The SDK automatically converts camelCase object keys to kebab-case CLI flags:

| camelCase (in code) | CLI Flag |
|---------------------|----------|
| `refImages` | `--ref-images` |
| `maxWidth` | `--max-width` |
| `multiWordKeyName` | `--multi-word-key-name` |

**Example:**

```typescript
// Write this:
await memeputer.command('agent', 'cmd', {
  refImages: ['url1', 'url2'],
  maxWidth: 1024
});

// SDK converts to:
// /cmd --ref-images url1 url2 --max-width 1024
```

## Positional Arguments

Use the `_args` or `args` key to specify positional arguments:

```typescript
// Using _args
await memeputer.command('agent', 'cmd', {
  _args: ['subcommand', 'value'],
  flag: 'value'
});

// Using args (alternative)
await memeputer.command('agent', 'cmd', {
  args: ['subcommand', 'value'],
  flag: 'value'
});
```

## Complex Parameters (JSON Format)

Some commands require complex objects and are automatically sent as JSON:

```typescript
// Commands like generate_brief, describe_image, etc. use JSON format
const result = await memeputer.command('briefputer', 'generate_brief', {
  trendItem: { title: 'Test', summary: 'Test summary' },
  policy: { denyTerms: [] }
});
```

## Configuration

```typescript
import { Memeputer } from '@memeputer/sdk';
import { Connection, Keypair } from '@solana/web3.js';

const memeputer = new Memeputer({
  apiUrl: 'https://agents.memeputer.com/x402', // Optional, defaults to production
  chain: 'solana',                              // 'solana' (default) or 'base'
  wallet: yourWallet,                           // Solana Keypair or EVM wallet
  connection: yourConnection,                   // Solana Connection or EVM provider
  verbose: true,                                // Enable verbose x402 logging
});
```

### Auto-detection

If you don't provide wallet/connection, the SDK will auto-detect:

- **Solana**: Uses `~/.config/solana/id.json` if available
- **Base**: Uses `~/.memeputer/base-wallet.json` if available
- **RPC**: Uses environment variables or defaults

## Response Format

Both `prompt()` and `command()` return an `InteractionResult`:

```typescript
interface InteractionResult {
  response: string;              // Agent's response text
  success: boolean;             // Whether the interaction succeeded
  format: 'text' | 'json';      // Response format
  agentId: string;              // Agent ID that responded
  transactionSignature?: string; // Payment transaction signature (if payment occurred)
  x402Receipt?: {               // x402 payment receipt
    amountPaidUsdc: number;
    payer: string;
    merchant: string;
    // ... more fields
  };
  imageUrl?: string;            // Image URL (if applicable)
  mediaUrl?: string;            // Media URL (if applicable)
  statusUrl?: string;           // Status URL for async operations
}
```

## Async Operations

Some operations are asynchronous and return a `statusUrl`:

```typescript
const result = await memeputer.command('pfpputer', 'pfp', {
  _args: ['generate', 'a cat']
});

if (result.statusUrl) {
  // Poll for completion
  const status = await memeputer.pollStatus(result.statusUrl, {
    maxAttempts: 120,
    intervalMs: 1000,
    onProgress: (attempt, status) => {
      console.log(`Attempt ${attempt}: ${status.status}`);
    }
  });
  
  console.log('Final result:', status.imageUrl);
}
```

## Examples

### Generate an Image

```typescript
const result = await memeputer.command('pfpputer', 'pfp', {
  _args: ['generate', 'a cat wearing sunglasses'],
  refImages: ['https://example.com/reference.jpg'],
  maxWidth: 1024
});

console.log('Image URL:', result.imageUrl);
```

### Discover Trends

```typescript
const result = await memeputer.command('trendputer', 'discover_trends', {
  keywords: ['crypto', 'solana'],
  maxResults: 10,
  includeHashtags: true
});

const trends = JSON.parse(result.response);
console.log('Trends:', trends.items);
```

## TypeScript Support

Full TypeScript support with type definitions included:

```typescript
import { Memeputer, PromptResult, CommandResult } from '@memeputer/sdk';

const result: CommandResult = await memeputer.command('agent', 'cmd');
```

## License

MIT

