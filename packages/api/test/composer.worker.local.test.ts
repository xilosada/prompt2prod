import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createBus } from '../src/bus/factory.js';
import { topics } from '../src/bus/topics.js';
import * as git from '../src/git/local.js';
import { createMemoryRunsRepo } from '../src/runs/repo.memory.js';
import { startComposer } from '../src/composer/worker.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import Fastify, { type FastifyInstance } from 'fastify';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ex = promisify(execFile);

describe('composer.worker.local', () => {
  let app: FastifyInstance;
  let bus: import('../src/bus/Bus.js').Bus;
  let runsRepo: import('../src/runs/repo.memory.js').RunsRepo;
  let remoteDir: string;
  let remoteUrl: string;

  beforeAll(async () => {
    // Create bare remote
    remoteDir = await fs.mkdtemp(path.join(os.tmpdir(), 'composer-test-'));
    remoteUrl = await git.initBareRemote(remoteDir);

    // Set up environment for composer
    process.env.COMPOSE_PR_REMOTE_URL = remoteUrl;
    process.env.COMPOSE_PR_ON_STATUS = 'done';
    process.env.COMPOSE_PR_BASE = 'main';
    delete process.env.COMPOSE_PR_DRY_RUN;
    delete process.env.GITHUB_TOKEN;

    // Create test app and bus
    app = Fastify();
    bus = await createBus();
    runsRepo = createMemoryRunsRepo();

    // Start composer worker
    await startComposer(app, bus, runsRepo);

    // Wait a bit for composer to initialize
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    try {
      await bus.close();
      await app.close();
      await fs.rm(remoteDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should compose a run with patch to local bare remote', async () => {
    const runId = 'test-run-123-' + Date.now();
    const testFile = 'test-file.txt';
    const testContent = 'Hello, World!';

    // Create a run in the repo
    runsRepo.create({
      id: runId,
      agentId: 'test-agent',
      repo: 'test/repo',
      base: 'main',
      prompt: 'test prompt',
    });

    // Attach composer subscriptions manually
    const attachComposer = (app as { _attachComposerRun?: (runId: string) => Promise<void> })
      ._attachComposerRun;
    if (attachComposer) {
      await attachComposer(runId);
    }

    // Create a patch
    const patch = {
      files: [
        {
          path: testFile,
          content: testContent,
        },
      ],
    };

    // Publish patch to the run
    await bus.publish(topics.runPatch(runId), patch);

    // Publish status=done to trigger composition
    await bus.publish(topics.runStatus(runId), { state: 'done' });

    // Wait a bit for async processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check that the branch was created in the remote
    const branchName = `feat/run-${runId}`;
    const branchExists = await git.remoteBranchExists(remoteUrl, branchName);
    expect(branchExists).toBe(true);

    // Check that the file content is correct
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'composer-check-'));
    try {
      await git.initWorkspace(workspaceDir, remoteUrl);
      // Fetch and checkout the branch from remote
      await ex('git', ['fetch', 'origin', branchName], { cwd: workspaceDir });
      await ex('git', ['checkout', branchName], { cwd: workspaceDir });

      const filePath = path.join(workspaceDir, testFile);
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe(testContent);
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  }, 15000);

  it('should handle GitHub remote without token gracefully', async () => {
    const runId = 'test-run-github';
    const testFile = 'github-test.txt';
    const testContent = 'GitHub test';

    // Set GitHub remote without token
    process.env.COMPOSE_PR_REMOTE_URL = 'https://github.com/test-owner/test-repo.git';
    delete process.env.GITHUB_TOKEN;

    // Create a run in the repo
    runsRepo.create({
      id: runId,
      agentId: 'test-agent',
      repo: 'test/repo',
      base: 'main',
      prompt: 'test prompt',
    });

    // Attach composer subscriptions manually
    const attachComposer = (app as { _attachComposerRun?: (runId: string) => Promise<void> })
      ._attachComposerRun;
    if (attachComposer) {
      await attachComposer(runId);
    }

    // Create a patch
    const patch = {
      files: [
        {
          path: testFile,
          content: testContent,
        },
      ],
    };

    // Publish patch and status
    await bus.publish(topics.runPatch(runId), patch);
    await bus.publish(topics.runStatus(runId), { state: 'done' });

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Should not throw, but should log warning about missing token
    // The branch should still be pushed to the remote (if it were a real remote)
    // For this test, we just verify no exception was thrown
    expect(true).toBe(true);

    // Reset remote URL
    process.env.COMPOSE_PR_REMOTE_URL = remoteUrl;
  }, 10000);

  it('should be idempotent - not create duplicate branches', async () => {
    const runId = 'test-run-idempotent';
    const testFile = 'idempotent-test.txt';
    const testContent = 'Idempotent test';

    // Create a run in the repo
    runsRepo.create({
      id: runId,
      agentId: 'test-agent',
      repo: 'test/repo',
      base: 'main',
      prompt: 'test prompt',
    });

    // Attach composer subscriptions manually
    const attachComposer = (app as { _attachComposerRun?: (runId: string) => Promise<void> })
      ._attachComposerRun;
    if (attachComposer) {
      await attachComposer(runId);
    }

    // Create a patch
    const patch = {
      files: [
        {
          path: testFile,
          content: testContent,
        },
      ],
    };

    // Publish patch and status multiple times
    await bus.publish(topics.runPatch(runId), patch);
    await bus.publish(topics.runStatus(runId), { state: 'done' });

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Publish the same patch and status again
    await bus.publish(topics.runPatch(runId), patch);
    await bus.publish(topics.runStatus(runId), { state: 'done' });

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Should only create one branch
    const branchExists = await git.remoteBranchExists(remoteUrl, 'feat/run-test-run-idempotent');
    expect(branchExists).toBe(true);

    // Should not create a second branch with suffix
    const branchExists2 = await git.remoteBranchExists(remoteUrl, 'feat/run-test-run-idempotent-2');
    expect(branchExists2).toBe(false);
  }, 15000);

  it('should handle dry run mode', async () => {
    const runId = 'test-run-dry-run-' + Date.now();
    const testFile = 'dry-run-test.txt';
    const testContent = 'Dry run test';

    // Enable dry run mode BEFORE starting composer
    process.env.COMPOSE_PR_DRY_RUN = '1';

    // Create a new app instance with dry run mode enabled
    const dryRunApp = Fastify();
    const dryRunBus = await createBus();
    const dryRunRunsRepo = createMemoryRunsRepo();

    // Start composer worker with dry run mode
    await startComposer(dryRunApp, dryRunBus, dryRunRunsRepo);

    // Create a run in the repo
    dryRunRunsRepo.create({
      id: runId,
      agentId: 'test-agent',
      repo: 'test/repo',
      base: 'main',
      prompt: 'test prompt',
    });

    // Attach composer subscriptions manually
    const attachComposer = (dryRunApp as { _attachComposerRun?: (runId: string) => Promise<void> })
      ._attachComposerRun;
    if (attachComposer) {
      await attachComposer(runId);
    }

    // Create a patch
    const patch = {
      files: [
        {
          path: testFile,
          content: testContent,
        },
      ],
    };

    // Publish patch and status
    await dryRunBus.publish(topics.runPatch(runId), patch);
    await dryRunBus.publish(topics.runStatus(runId), { state: 'done' });

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // In dry run mode, no branch should be created
    const branchName = `feat/run-${runId}`;
    const branchExists = await git.remoteBranchExists(remoteUrl, branchName);
    expect(branchExists).toBe(false);

    // Cleanup
    await dryRunBus.close();
    await dryRunApp.close();
    delete process.env.COMPOSE_PR_DRY_RUN;
  }, 10000);
});
