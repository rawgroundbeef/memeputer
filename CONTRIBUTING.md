# Contributing to Memeputer

Thank you for your interest in contributing to Memeputer! 🎉

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/memeputer/memeputer-oss.git
   cd memeputer-oss
   ```

2. **Install pnpm** (if not already installed)
   ```bash
   npm install -g pnpm
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Build all packages**
   ```bash
   pnpm build
   ```

## Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following the existing style
   - Add tests if applicable
   - Update documentation as needed

3. **Add a changeset**
   ```bash
   pnpm changeset
   ```
   This will prompt you to describe your changes and select which packages are affected.

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: your change description"
   ```

5. **Push and create a PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Package-Specific Development

### Working on the CLI

```bash
# Build the CLI
pnpm --filter memeputer build

# Watch mode
pnpm --filter memeputer dev

# Test locally (after building)
node packages/cli/dist/cli.js --help
```

### Working on the SDK

```bash
# Build the SDK
pnpm --filter @memeputer/sdk build

# Watch mode
pnpm --filter @memeputer/sdk dev
```

## Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Run `pnpm lint` before committing (when linting is set up)
- Use meaningful variable and function names

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter memeputer test
```

## Questions?

Feel free to open an issue or reach out to the maintainers!

