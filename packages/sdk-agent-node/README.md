# SDK Agent Node

Node.js SDK for creating agents that can receive work, publish logs, and submit patches to the prompt2prod system.

## Install & Create Client

### Memory Transport (default)

```ts
import { AgentClient, createMemoryTransport } from '@prompt2prod/sdk-agent-node';

const client = new AgentClient({
  agentId: 'demo-agent',
  transport: createMemoryTransport(),
});

client.onWork(async (job) => {
  await client.publishLog(job.runId, 'starting');
  // ...do work...
  await client.markDone(job.runId);
});

// heartbeats (recommended every 2–5s)
setInterval(() => client.heartbeat({ caps: { lang: 'node', ver: process.version } }), 2000);
```

### NATS Transport (optional)

For distributed deployments with NATS message bus:

```ts
import { AgentClient, createNatsTransport } from '@prompt2prod/sdk-agent-node';

const client = new AgentClient({
  agentId: 'prod-agent',
  transport: await createNatsTransport({ url: 'nats://localhost:4222' }),
});
```

## API Surface

### Work Handling

- `onWork(cb)` — Register handler for incoming work items
- `onControl(cb)` — Register handler for control messages (cancel, pause, resume)

### Logging & Status

- `publishLog(runId, line)` — Send a log line to the run
- `publishPatch(runId, patch)` — Submit a patch with file changes
- `markDone(runId)` — Mark run as completed successfully
- `markError(runId, err)` — Mark run as failed with error
- `markCanceled(runId)` — Mark run as canceled

### Heartbeats

- `heartbeat(payload?)` — Send heartbeat with optional capabilities

## Complete Example

```ts
import { AgentClient, createMemoryTransport } from '@prompt2prod/sdk-agent-node';

async function main() {
  const agent = new AgentClient({
    agentId: process.env.AGENT_ID ?? 'demo-agent',
    transport: createMemoryTransport(),
  });

  // Start heartbeats (every 5 seconds)
  const hb = agent.heartbeat(5000);

  // Handle incoming work
  await agent.onWork(async (job) => {
    console.log(`Starting work on ${job.repo} ${job.base}`);

    // Publish logs
    await agent.publishLog(job.runId, `Processing ${job.prompt}`);

    // Do some work...
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Submit a patch
    await agent.publishPatch(job.runId, {
      files: [
        {
          path: 'README.generated.md',
          content: `# Generated for ${job.runId}\n\n${job.prompt}`,
        },
      ],
    });

    // Mark as done
    await agent.markDone(job.runId, { result: 'success' });
  });

  // Handle control messages
  await agent.onControl(async (msg) => {
    if (msg.action === 'cancel') {
      console.log('Received cancel request');
      // Handle cancellation
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    hb.stop(); // Clear heartbeat interval
    await agent.close?.(); // Close transport if supported
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

## Work Item Structure

```ts
type WorkItem = {
  runId: string;
  repo: string; // e.g., "org/repo"
  base: string; // e.g., "main"
  prompt: string; // task description
  payload?: unknown; // additional data
};
```

## Patch Structure

```ts
type Patch = {
  files: Array<{
    path: string; // file path relative to repo root
    content: string; // new file content
  }>;
};
```

## Heartbeat Capabilities

Agents can include capabilities in heartbeats:

```ts
client.heartbeat({
  caps: {
    lang: 'node',
    version: process.version,
    features: ['git', 'docker'],
    env: process.env.NODE_ENV,
  },
});
```

## Agent Status

The API computes agent status based on heartbeat frequency:

- **online**: last heartbeat ≤ 15 seconds ago
- **stale**: last heartbeat 15-60 seconds ago
- **offline**: last heartbeat > 60 seconds ago or never seen

## Environment Variables

- `AGENT_ID` — Agent identifier (defaults to hostname)
- `BUS_DRIVER` — Message bus driver (`memory` or `nats`)
- `NATS_URL` — NATS server URL (when using NATS transport)

## Development

```bash
# Build the package
pnpm build

# Run the example agent
pnpm example

# Run tests
pnpm test
```

## Transport Options

### Memory Transport

In-memory transport for development and testing. All communication happens within the same process.

```ts
import { createMemoryTransport } from '@prompt2prod/sdk-agent-node';
const transport = createMemoryTransport();
```

### NATS Transport

Distributed transport using NATS message bus for production deployments.

```ts
import { createNatsTransport } from '@prompt2prod/sdk-agent-node';
const transport = await createNatsTransport({
  url: 'nats://localhost:4222',
});
```

Requires the `nats` package as an optional dependency.
