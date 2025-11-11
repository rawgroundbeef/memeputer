# Brand B - Pay.ai

This brand uses a manual brand profile (no brand agent ID) for out-of-the-box configuration.

## Configuration

- **Brand Name**: Pay.ai
- **Voice**: professional, trustworthy, innovative, payment-focused
- **Style**: modern, fintech, clean, professional
- **Reference Images**: Place reference images in `reference-images/` folder

## Usage

```bash
yarn start run --brand brands/brand-b/brand.config.json --budget 0.1 --approve
```

## Reference Images

Add reference image URLs to `brand.config.json`:

```json
{
  "referenceImageUrls": [
    "https://example.com/payai-style-1.jpg",
    "https://example.com/payai-style-2.png"
  ]
}
```

**Important:**
- Images must be **publicly accessible URLs** (http:// or https://)
- URLs must be accessible without authentication
- Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
- Use 1-5 reference images for best results
- These will be passed to PFPputer for style reference

