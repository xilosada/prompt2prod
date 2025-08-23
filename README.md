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

````bash
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

## Message Bus — NATS (optional)
Default driver is **memory**. To use NATS locally:

```bash
# Copy environment template (optional)
cp .env.example .env

# Start NATS
docker compose -f docker-compose.nats.yml up -d
export BUS_DRIVER=nats NATS_URL=nats://localhost:4222
pnpm --filter @prompt2prod/api build && node packages/api/dist/index.js
# In another shell:
curl -N http://localhost:3000/runs/abc/logs/stream &
curl -X POST http://localhost:3000/runs/abc/logs/test
````

### Tests (run locally before pushing)

```bash
docker compose -f docker-compose.nats.yml up -d
export BUS_DRIVER=nats NATS_URL=nats://localhost:4222
pnpm check
```

## Agent SDK (Node)

Install & run the mock agent locally (memory transport):

```bash
pnpm --filter @prompt2prod/sdk-agent-node build
pnpm --filter @prompt2prod/sdk-agent-node example
```

Or run directly:

```bash
pnpm --filter @prompt2prod/sdk-agent-node build
node examples/agents/mock/index.ts
```

Set `BUS_DRIVER=nats NATS_URL=...` to use NATS transport (optional).

## API — Runs

Create a run and dispatch work to an agent:

```bash
curl -s -X POST http://localhost:3000/runs \
  -H 'content-type: application/json' \
  -d '{"agentId":"agent-1","repo":"org/repo","base":"main","prompt":"hello"}'
# → {"id":"<uuid>"}
```

Fetch run metadata:

```bash
curl -s http://localhost:3000/runs/<uuid>
```

### Run Lifecycle

Runs automatically transition through statuses via bus messages:

- **queued** → **dispatched** → **running** (on first log) → **done**|**error**|**canceled**

The API subscribes to `runs.<id>.logs` and `runs.<id>.status` topics when a run is created. Agents can emit status updates:

```json
{"state": "done", "detail": {"result": "success"}}
{"state": "error", "detail": "Something went wrong"}
{"state": "canceled", "detail": "User requested cancellation"}
```

## Code Style

- Language: TypeScript (Node ESM)
- Formatter: Prettier (singleQuote, semi, trailingComma=all, printWidth=100)
- Linter: eslint + @typescript-eslint (non type-aware)
- Commit style: Conventional Commits (feat|fix|chore)
- Run all checks: `pnpm check`

## Patch Apply Engine (internal)

Apply a patch into a workspace directory:

```ts
import { applyPatch } from '@prompt2prod/api/src/patch/apply';

await applyPatch(
  {
    files: [{ path: 'README.generated.md', content: '# Hello' }],
  },
  { rootDir: '/tmp/work', normalizeEol: 'lf' },
);
```

Security: paths are validated; traversal is rejected. Deterministic ordering for reproducible builds.

#### Patch Apply Engine — Production mode

- **Ops**: supports `write`, `delete`, `rename` (back-compat: `{ files: [...] }`).
- **Atomic**: writes use temp+rename by default (`atomic: true`).
- **Dry-run**: set `dryRun: true` to get an auditable `plan` without touching disk.
- **Per-file EOL**: override with `eol: 'lf' | 'crlf' | 'none'`; global default is `'lf'`.

Example (ops):

```ts
await applyPatch(
  {
    ops: [
      { kind: 'delete', path: 'old/file.txt' },
      { kind: 'rename', from: 'docs/draft.md', to: 'docs/final.md' },
      { kind: 'write', path: 'README.generated.md', content: '# Hello', eol: 'lf' },
    ],
  },
  { rootDir: workdir, atomic: true, overwrite: true },
);
```

#### Local Git Plumbing (internal)

Child-process wrappers around system `git` for local repository operations:

```ts
import {
  initBareRemote,
  initWorkspace,
  ensureBranch,
  stageAll,
  commit,
  push,
} from '@prompt2prod/api/src/git/local';

const remoteUrl = await initBareRemote('/tmp/remote.git');
await initWorkspace('/tmp/work', remoteUrl);
await ensureBranch('/tmp/work', 'feat/patch');
await stageAll('/tmp/work');
const sha = await commit('/tmp/work', 'feat: add changes', { name: 'bot', email: 'bot@local' });
await push('/tmp/work', 'feat/patch');
```

Supports bare remote creation, workspace initialization, branch management, staging, committing, and pushing to local file-based remotes.

## GitHub PR (PAT)

Set a PAT with `repo` scope:

```bash
export GITHUB_TOKEN=ghp_***
```

Create a PR:

```bash
curl -X POST http://localhost:3000/runs/<id>/pr \
 -H 'content-type: application/json' \
 -d '{"repo":"org/repo","head":"feat/branch","base":"main","title":"Automated PR"}'
```

**Note:** For cross-repo PRs, the `head` parameter may need to be in `owner:branch` format (GitHub API nuance).

```

```
