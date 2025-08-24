# prompt2prod

A TypeScript monorepo for orchestrating AI agents that can create, modify, and submit code changes as pull requests. The system consists of a Fastify API server, Node.js agent SDK, and React web interface for monitoring and management.

## What is prompt2prod?

prompt2prod is a platform that enables AI agents to work on code repositories by providing a complete workflow from task assignment to pull request creation. Agents receive work items, process them, and can automatically generate patches that get applied to repositories and submitted as PRs. The system includes real-time monitoring, agent heartbeats, and both local and GitHub integration.

## Prerequisites

| Tool       | Version | Notes          |
| ---------- | ------- | -------------- |
| Node       | ≥ 20    | required       |
| pnpm       | 10.x    | workspace      |
| TypeScript | 5.x     | pinned in repo |
| Playwright | latest  | CI installs    |

## Packages

- **[API](./packages/api/README.md)** — Fastify server with endpoints for runs, logs/SSE, agents, compose PR, and test-only routes
- **[SDK Agent Node](./packages/sdk-agent-node/README.md)** — Node.js SDK for creating agents that can receive work, publish logs, and submit patches
- **[Web UI](./packages/web/README.md)** — React interface for monitoring runs, agents, and managing the system

## Quickstart (local)

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm -w build

# Start API server (default port 3000)
node packages/api/dist/index.js

# In another terminal, start web UI
pnpm --filter @prompt2prod/web dev
```

The API will be available at `http://localhost:3000` and the web interface at `http://localhost:5173`.

## End-to-End Demos

### Memory Bus (default)

The system works out-of-the-box with an in-memory message bus:

```bash
# Start API and web UI as above
# Run a mock agent
pnpm --filter @prompt2prod/sdk-agent-node example
```

### Orchestrator to Local Bare Repository

Test the complete workflow with a local bare repository:

```bash
# Create a bare repository
git init --bare /tmp/remote.git

# Create a run and compose PR
curl -s -X POST http://localhost:3000/runs/demo/pr/compose \
  -H 'content-type: application/json' \
  -d '{
    "repo":"org/repo",
    "base":"main",
    "title":"local e2e",
    "remoteUrl":"file:///tmp/remote.git",
    "patch":{
      "files":[{"path":"README.generated.md","content":"# hi\n"}]
    }
  }'
```

### Orchestrator to GitHub (requires GITHUB_TOKEN)

Create actual GitHub pull requests:

```bash
# Set up GitHub token (Personal Access Token with 'repo' scope)
export GITHUB_TOKEN=ghp_...; OWNER=you; REPO=repo

# Create a run and compose PR
curl -s -X POST http://localhost:3000/runs/demo/pr/compose \
  -H 'content-type: application/json' \
  -d "{
    \"repo\":\"$OWNER/$REPO\",
    \"base\":\"main\",
    \"title\":\"Automated PR\",
    \"remoteUrl\":\"https://github.com/$OWNER/$REPO.git\",
    \"patch\":{
      \"files\":[{\"path\":\"docs/demo.md\",\"content\":\"# hi\\n\"}]
    }
  }"
```

> **Security**: Store `GITHUB_TOKEN` in Actions secrets or local environment variables, never commit it to version control. The token requires **repo** scope (for both public and private repositories).

## CI Overview

- **Orchestrator E2E**: Tests the complete workflow from run creation to PR composition
- **Web E2E**: Playwright tests verify the web interface functionality including agent monitoring and run management

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

## Message Bus — NATS (optional)

Default driver is **memory**. To use NATS locally:

```bash
# Start NATS
docker compose -f docker-compose.nats.yml up -d

# Set environment variables
export BUS_DRIVER=nats NATS_URL=nats://localhost:4222

# Start API with NATS
node packages/api/dist/index.js
```

## Code Style

- Language: TypeScript (Node ESM)
- Formatter: Prettier (singleQuote, semi, trailingComma=all, printWidth=100)
- Linter: eslint + @typescript-eslint (non type-aware)
- Commit style: Conventional Commits (feat|fix|chore)
- Run all checks: `pnpm check`
