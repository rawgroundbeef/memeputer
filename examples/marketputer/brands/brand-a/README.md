# Brand A - Memeputer

This brand uses Memeputer's brand agent ID for personality and includes reference images for PFPputer.

## Configuration

- **Brand Agent ID**: `5ca90eb4-dda0-400f-bb90-898dcf467d4c`
- **Reference Images**: Place 5 Memeputer reference images in `reference-images/` folder

## Usage

```bash
yarn start run --brand brands/brand-a/brand.config.json --budget 0.1 --approve
```

## Reference Images

Add reference image URLs to `brand.config.json`:

```json
{
  "brandAgentId": "5ca90eb4-dda0-400f-bb90-898dcf467d4c",
  "referenceImageUrls": [
    "https://example.com/memeputer-style-1.jpg",
    "https://example.com/memeputer-style-2.png",
    "https://example.com/memeputer-style-3.jpg",
    "https://example.com/memeputer-style-4.png",
    "https://example.com/memeputer-style-5.jpg"
  ]
}
```

**Important:**
- Images must be **publicly accessible URLs** (http:// or https://)
- URLs must be accessible without authentication
- Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
- Use 1-5 reference images for best results
- These will be passed to PFPputer for style reference

