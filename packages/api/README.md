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

### Tasks API (Core)

Create and manage work plans for AI agents:

```bash
# Create a new task
curl -s -X POST http://localhost:3000/tasks \
  -H 'content-type: application/json' \
  -d '{"title":"Refactor CI","goal":"Speed up checks","targetRepo":"file:///tmp/remote.git","agents":["qa","infra"]}'
```

List tasks with pagination:

```bash
curl -s http://localhost:3000/tasks?limit=5
```

Get specific task:

```bash
curl -s http://localhost:3000/tasks/<id>
```

**Task states**: `planned` (initial) → `running` → `awaiting-approvals` → `done`/`error`/`canceled`

### Task Orchestrator (MVP)

The Task Orchestrator automatically manages the lifecycle of tasks by spawning runs and advancing task state based on run status:

**Auto-spawn behavior**:

- When a task is created with agents, the orchestrator automatically spawns a run to the first agent
- The task state transitions from `planned` to `running`
- A `runs` array is attached to the task containing the run reference

**State transitions**:

- **`running`** → **`awaiting-approvals`**: When the run completes with PR information (composer populates `run.pr`)
- **`running`** → **`done`**: When the run completes without PR information
- **`running`** → **`error`**: When the run fails or is canceled

**Idempotency**: If a task already has runs, no additional runs are spawned.

**Note**: Moving to `awaiting-approvals` requires that the **composer** has populated `run.pr` with branch, URL, and number information.

### Coordinator Intake

Create a task via coordinator submission with strict validation:

```bash
# Create a task via coordinator intake
curl -s -X POST http://localhost:3000/coordinator/intake \
  -H 'content-type: application/json' \
  -d '{
    "title":"Speed up CI",
    "goal":"Reduce end-to-end build time by 30%",
    "targetRepo":"file:///tmp/remote.git",
    "agents":["qa","infra","qa"],  // duplicates OK, will be de-duped
    "policy":{"priority":"high"},
    "plan":"## Plan Proposal\\n**Goal:** ... (raw text kept for audit)"
  }' | jq .
```

**Validation rules**:

- `title`: 1-120 chars, trimmed
- `goal`: 1-2000 chars, trimmed
- `targetRepo`: GitHub slug (`owner/repo`) or file URL (`file:///path`)
- `agents`: ≤16 unique, pattern `[A-Za-z0-9_.-]+`, trimmed
- `policy`: ≤50 keys, ≤32KB serialized
- `plan`: optional raw text stored under `policy.__plan` (truncated to 64KB)

**Response**: 201 with canonical Task + `Location: /tasks/{id}` header

### Approval Policy (Core)

The API supports task-specific approval policies that define conditions for task execution. Approval policies are validated at intake and can be evaluated later by the approval gate.

**Policy Structure**:

```json
{
  "mode": "allOf" | "anyOf",
  "rules": [
    {
      "provider": "provider-name",
      "customField": "customValue"
    }
  ]
}
```

**Validation Rules**:

- `mode`: Must be either `"allOf"` or `"anyOf"`
- `rules`: Array with 1-16 rules
- Each rule must have a `provider` field (string, 1-64 chars, pattern `[A-Za-z0-9._-]+`)
- Provider-specific fields are allowed (no schema validation yet)

**Usage in Intake**:

```bash
curl -s -X POST http://localhost:3000/coordinator/intake \
  -H 'content-type: application/json' \
  -d '{
    "title":"Security-sensitive change",
    "goal":"Update authentication system",
    "targetRepo":"owner/repo",
    "policy":{
      "approvals":{
        "mode":"allOf",
        "rules":[
          {"provider":"manual-approval"},
          {"provider":"security-scan","threshold":"high"}
        ]
      }
    }
  }'
```

**STRICT Mode Behavior**:

The evaluator implements strict aggregation semantics:

| Mode    | Rule Verdicts                     | Result      | Notes                            |
| ------- | --------------------------------- | ----------- | -------------------------------- |
| `allOf` | Any `fail`                        | `error`     | Fast-fail on definitive negative |
| `allOf` | Any `unsupported` (strict)        | `error`     | Fast-fail on missing capability  |
| `allOf` | All `satisfied`                   | `satisfied` | All conditions met               |
| `allOf` | Some `pending`                    | `pending`   | Waiting for conditions           |
| `anyOf` | Any `satisfied`                   | `satisfied` | At least one condition met       |
| `anyOf` | All `{fail,unsupported}` (strict) | `error`     | No conditions can be met         |
| `anyOf` | At least one `pending`            | `pending`   | Waiting for conditions           |

Provider verdicts:

- `satisfied`: Condition met
- `pending`: Condition not met yet, but could be later
- `fail`: Condition cannot be met (definitive negative)
- `unsupported`: Provider not available in this deployment

**Error Response**:

Invalid approval policies return 400 with specific error details:

```json
{
  "error": "invalid_approval_policy",
  "details": "mode must be either \"allOf\" or \"anyOf\""
}
```

### Approvals API

Get approval status for tasks and runs:

```bash
# Get approval status for a task
curl -s http://localhost:3000/tasks/<task-id>/approvals | jq .

# Get approval status for a run (via its task)
curl -s http://localhost:3000/runs/<run-id>/approvals | jq .

# Use non-strict mode (treats unsupported providers as pending)
curl -s http://localhost:3000/tasks/<task-id>/approvals?strict=false | jq .
```

**Response Shape**:

```json
{
  "taskId": "task-123",
  "strict": true,
  "aggregate": "pending",
  "rules": [
    {
      "provider": "manual",
      "verdict": "pending"
    },
    {
      "provider": "checks",
      "verdict": "satisfied"
    }
  ]
}
```

**Query Parameters**:

- `strict` (optional): `true` (default) or `false` - Controls how unsupported providers are handled

**Response Fields**:

- `taskId`: The task identifier
- `strict`: Whether strict mode was used for evaluation
- `aggregate`: Overall approval status (`satisfied`, `pending`, `fail`, `error`)
- `rules`: Array of individual rule results with provider names and verdicts

**Error Responses**:

- `404`: Task or run not found
- `400`: Task has no approval policy or invalid policy structure

#### GitHub Checks Provider (Feature Flag)

The system includes a scaffold for a future GitHub Checks provider that would integrate with GitHub's Checks API to verify CI status. This provider is controlled by the `APPROVALS_GITHUB_CHECKS` environment variable:

```bash
# Enable GitHub Checks provider (default: off)
APPROVALS_GITHUB_CHECKS=on node packages/api/dist/index.js
```

**Current Status**: The provider is scaffolded but not yet implemented. When enabled, it returns `unsupported` verdicts.

**Future Implementation**: When fully implemented, this provider will:

- Query GitHub's Checks API for CI status
- Support configurable check names and required statuses
- Handle authentication via `GITHUB_TOKEN`
- Return appropriate verdicts based on CI results

**Security Note**: Environment variables are automatically redacted in logs and health endpoints to prevent secret leakage.

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
- `APPROVALS_GITHUB_CHECKS` (default: `off`) — enable GitHub Checks provider for approvals

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
