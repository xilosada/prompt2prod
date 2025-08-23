# prompt2prod (v2)

TypeScript monorepo with Fastify API and shared packages.

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

# Run all checks (lint, format, typecheck, test, build)
pnpm check
```

## Code Style

- Language: TypeScript (Node ESM)
- Formatter: Prettier (singleQuote, semi, trailingComma=all, printWidth=100)
- Linter: eslint + @typescript-eslint (non type-aware)
- Commit style: Conventional Commits (feat|fix|chore)
- Run all checks: `pnpm check`
