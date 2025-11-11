# Memeputer Monorepo

Public monorepo for all Memeputer packages.

## Packages

- **[`memeputer`](./packages/cli)** - CLI for interacting with Memeputer agents

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

```bash
# Install pnpm if you haven't already
npm install -g pnpm

# Install dependencies
pnpm install
```

### Development

```bash
# Build all packages
pnpm build

# Build a specific package
pnpm --filter memeputer build

# Run tests
pnpm test

# Watch mode for development
pnpm --filter memeputer dev
```

## Project Structure

```
memeputer/
├── packages/
│   └── cli/          # memeputer CLI
├── examples/         # Example applications
│   └── marketputer/ # Marketputer example app
├── .github/          # GitHub Actions workflows
└── .changeset/       # Changesets for versioning
```

## Versioning & Publishing

This monorepo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

### Making Changes

1. Make your changes to the relevant package(s)
2. Run `pnpm changeset` to create a changeset file
3. Commit your changes and the changeset file
4. Push to `main` branch

### Publishing

When changesets are merged to `main`, a GitHub Action will:
1. Create a PR with version bumps
2. After merging that PR, automatically publish packages to npm

### Manual Publishing

```bash
# Version packages
pnpm changeset version

# Publish to npm
pnpm changeset publish
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add a changeset (`pnpm changeset`)
5. Submit a pull request

## License

MIT

