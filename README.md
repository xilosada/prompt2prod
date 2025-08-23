# prompt2prod (v2)

TypeScript monorepo with Fastify API and shared packages.

## Quick Start

```bash
pnpm i && pnpm -w build && pnpm --filter @prompt2prod/api dev
```

This will:

1. Install all dependencies
2. Build all packages
3. Start the API server on http://localhost:3000

## Development

- `pnpm dev` - Start the API server
- `pnpm build` - Build all packages
- `pnpm test` - Run all tests
- `pnpm lint` - Run ESLint
- `pnpm format:check` - Check Prettier formatting
