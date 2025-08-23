# prompt2prod (v2)

Fresh reset. CI is green by design; we'll add real packages and tooling in small PRs.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev

# Or specify a custom port
PORT=3000 pnpm dev
```

The API server will be available at `http://localhost:3000` (or your custom port).

## Development

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint code
pnpm lint

# Check formatting
pnpm format:check

# Build all packages
pnpm build
```
