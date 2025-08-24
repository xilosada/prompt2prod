# API Package

Fastify server providing the backend API for the prompt2prod system. Handles run management, agent registry, live logs via SSE, and orchestrates patch application to repositories.

## Endpoints (copy-paste ready)

### Create Run

Create a new run and dispatch work to an agent:

```bash
curl -s -X POST http://localhost:3000/runs \
  -H 'content-type: application/json' \
  -d '{"agentId":"demo-agent","repo":"org/repo","base":"main","prompt":"hello","payload":{"task":"hello"}}'
```

Response: `{"id":"<uuid>"}`

### Get Run

Fetch run metadata and status:

```bash
curl -s http://localhost:3000/runs/<id> | jq .
```

Or without `jq` (optional):

```bash
curl -s http://localhost:3000/runs/<id>
```

Response includes: `id`, `agentId`, `repo`, `base`, `prompt`, `payload`, `status`, `createdAt`, `updatedAt`

### Logs (SSE)

Stream live logs for a run:

```bash
curl -N http://localhost:3000/runs/<id>/logs/stream
```

> Use `-N` (no buffer) for proper streaming. On Windows/PowerShell, prefer Git Bash or WSL for `curl -N`.

**Dev helper** - emit a test log line:

```bash
curl -X POST http://localhost:3000/runs/<id>/logs/test
```

### Compose PR (patch → git → GitHub PR)

Apply a patch to a repository and optionally create a GitHub PR:

```bash
# Local bare remote (no GitHub needed)
curl -s -X POST http://localhost:3000/runs/<id>/pr/compose \
  -H 'content-type: application/json' \
  -d '{
    "repo":"org/repo",
    "base":"main",
    "title":"local e2e",
    "remoteUrl":"file:///tmp/remote.git",
    "patch":{
      "files":[{"path":"x.txt","content":"y"}]
    }
  }'
```

> For GitHub PRs set **`GITHUB_TOKEN`** (PAT with `repo` scope) and `remoteUrl` = `https://github.com/<owner>/<repo>.git`.

### Agents

List all agents with status:

```bash
curl -s http://localhost:3000/agents | jq .
```

Or without `jq`:

```bash
curl -s http://localhost:3000/agents
```

Get specific agent:

```bash
curl -s http://localhost:3000/agents/<agentId> | jq .
```

Or without `jq`:

```bash
curl -s http://localhost:3000/agents/<agentId>
```

**Status policy**: **online**: `now - lastSeen ≤ 15s` • **stale**: `15s < now - lastSeen ≤ 60s` • **offline**: `> 60s`

Returned shape: `{ id, lastSeen, status, caps? }` (`lastSeen`: ms epoch).

### Test-only (E2E)

Enable test endpoints for end-to-end testing:

```bash
# Enable only for tests
ENABLE_TEST_ENDPOINTS=1 node packages/api/dist/index.js

# Send test heartbeat
curl -s -X POST http://localhost:3000/__test/agents/qa-agent/heartbeat \
  -H 'content-type: application/json' \
  -d '{"caps":{"lang":"node"}}'
```

> **Never enable `ENABLE_TEST_ENDPOINTS=1` in production.** These routes bypass auth and are CI-only.

Verify test endpoints are disabled by default:

```bash
# Should return 404 when not enabled
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/__test/agents/qa-agent/heartbeat
```

### Health Check

```bash
curl -s http://localhost:3000/health | jq .
```

Or without `jq`:

```bash
curl -s http://localhost:3000/health
```

Returns system status including agent registry configuration.

## Environment Variables

- `PORT` (default 3000)
- `GITHUB_TOKEN` (for GitHub PRs) - requires **repo** scope (private repos too)
- `AGENTS_ONLINE_MS`, `AGENTS_STALE_MS` — override status thresholds for CI
- Bus selection (if using NATS): `BUS_DRIVER=nats`, `NATS_URL=...`
- `ENABLE_TEST_ENDPOINTS=1` — enable test-only endpoints (dev only)

### Headless PR Composer

The API includes a headless PR composer worker that automatically creates git branches and GitHub PRs from run patches based on policy configuration:

| Variable                | Default      | Description                                                   |
| ----------------------- | ------------ | ------------------------------------------------------------- |
| `COMPOSE_PR_ON_STATUS`  | `done`       | CSV of statuses that trigger composition (e.g., `done,error`) |
| `COMPOSE_PR_REMOTE_URL` | **required** | Git remote URL to push branches to                            |
| `COMPOSE_PR_BASE`       | `main`       | Base branch for PRs and initial branch point                  |
| `COMPOSE_PR_DRY_RUN`    | `false`      | Set to `1` to log plan only (no git/push/PR)                  |

**Local demo with bare remote:**

```bash
# Create bare remote
git init --bare /tmp/remote.git

# Configure composer
export COMPOSE_PR_REMOTE_URL=file:///tmp/remote.git
export COMPOSE_PR_ON_STATUS=done

# Start API
node packages/api/dist/index.js

# Create a run, send patch, set status=done -> branch appears in /tmp/remote.git
```

**GitHub integration:**

- Set `COMPOSE_PR_REMOTE_URL=https://github.com/owner/repo.git`
- Set `GITHUB_TOKEN` with `repo` scope for PR creation
- Token must be in environment/Actions secrets; never commit it

> **Security**: Store `GITHUB_TOKEN` in Actions secrets or local environment variables, never commit it to version control.

### Operational Notes

The composer worker provides internal metrics for monitoring and debugging:

**Metrics counters** (logged on shutdown):

- `composedTotal`: Number of successful branch/PR compositions
- `failedTotal`: Number of failed composition attempts
- `githubTokenMissingTotal`: Number of GitHub PR attempts without valid token

**Log examples**:

```
[composer] successfully pushed feat/run-123 (files: 2) for run-123, PR: https://github.com/owner/repo/pull/456
[composer] shutdown metrics: {"composedTotal":5,"failedTotal":1,"githubTokenMissingTotal":2}
```

**Debugging tips**:

- Check `composeError` field in run records for composition failures
- Monitor `githubTokenMissingTotal` to detect token configuration issues
- Use `COMPOSE_PR_DRY_RUN=1` to test composition without creating branches

## Agent Registry

The API maintains an in-memory registry of agents based on heartbeat messages. Agent status is computed dynamically:

**online**: `now - lastSeen ≤ 15s` • **stale**: `15s < now - lastSeen ≤ 60s` • **offline**: `> 60s`

### Configuration

Status thresholds and rate limiting can be configured:

```bash
# Status thresholds (milliseconds)
AGENT_ONLINE_TTL_MS=15000    # Default: 15 seconds
AGENT_STALE_TTL_MS=60000     # Default: 60 seconds

# Rate limiting (milliseconds)
AGENT_MIN_HEARTBEAT_INTERVAL_MS=250  # Default: 250ms
```

### Example Heartbeat Payload

Agents send heartbeats with optional capabilities:

```json
{
  "at": 1703123456789,
  "caps": {
    "lang": "node",
    "version": "1.0.0",
    "features": ["git", "docker"]
  }
}
```

The `caps` field is optional and can contain any JSON object (max 32KB).

## Run Lifecycle

Runs automatically transition through statuses via bus messages:

- **queued** → **dispatched** → **running** (on first log) → **done**|**error**|**canceled**

The API subscribes to `runs.<id>.logs` and `runs.<id>.status` topics when a run is created. Agents can emit status updates:

```json
{"state": "done", "detail": {"result": "success"}}
{"state": "error", "detail": "Something went wrong"}
{"state": "canceled", "detail": "User requested cancellation"}
```

## Message Bus

The API supports two message bus drivers:

- **Memory** (default): In-memory bus for development and testing
- **NATS**: Distributed message bus for production deployments

To use NATS:

```bash
export BUS_DRIVER=nats NATS_URL=nats://localhost:4222
node packages/api/dist/index.js
```

## Development

```bash
# Build the package
pnpm build

# Start development server
pnpm dev

# Run tests
pnpm test
```
