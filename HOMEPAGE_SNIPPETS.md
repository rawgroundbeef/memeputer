# Memeputer Homepage Code Snippets

Code snippets for the Memeputer marketplace app homepage.

## Prompt Example

```typescript
import memeputer from '@memeputer/sdk';

const result = await memeputer.prompt('memeputer', 'Hello, how are you?');
console.log(result.response);
```

## Command Example

```typescript
import memeputer from '@memeputer/sdk';

const result = await memeputer.command('memeputer', 'ping');
console.log(result.response);
```

