# Brand Configurations

Brand configs define the voice, style, and personality for content generation.

## Supported Formats

### Option 1: Brand Agent ID (Recommended)
```json
{
  "brandAgentId": "5ca90eb4-dda0-400f-bb90-898dcf467d4c",
  "referenceImageUrls": []
}
```
Uses the brand agent's configured profile from Memeputer.

### Option 2: Brand Profile Object
```json
{
  "brandName": "Pay.ai",
  "voice": "professional, trustworthy, innovative",
  "personality": "professional, payment-focused",
  "targetAudience": "fintech professionals",
  "denyTerms": ["nsfw", "scam"],
  "referenceImageUrls": ["https://..."]
}
```

## Available Brands

- `memeputer.json` - Memeputer brand (uses brandAgentId)
- `payai.json` - Pay.ai brand (full profile)

## Usage

```bash
# Use Memeputer brand
pnpm go --brand brands/memeputer.json

# Use Pay.ai brand
pnpm go --brand brands/payai.json

# Use custom brand
pnpm go --brand /path/to/custom-brand.json
```

