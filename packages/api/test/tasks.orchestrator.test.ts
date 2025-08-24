import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../src/server.js';
import { topics } from '../src/bus/topics.js';

describe('Task Orchestrator', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let bus: { publish: (topic: string, payload: unknown) => Promise<void> };
  let workMessages: Array<{ topic: string; payload: unknown }> = [];

  beforeEach(async () => {
    // Reset message tracking
    workMessages = [];

    app = await buildServer();

    // Get the bus and repos from the app
    bus = (app as { _bus?: { publish: (topic: string, payload: unknown) => Promise<void> } })._bus!;

    // Track work messages
    const originalPublish = bus.publish.bind(bus);
    bus.publish = async (topic: string, payload: unknown) => {
      if (topic.startsWith('agents.') && topic.endsWith('.work')) {
        workMessages.push({ topic, payload });
      }
      return originalPublish(topic, payload);
    };
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Spawn on create', () => {
    it('should spawn a run when creating a task with agents', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: 'Test Task',
          goal: 'Test goal',
          targetRepo: 'https://github.com/test/repo.git',
          agents: ['mock'],
        },
      });

      expect(response.statusCode).toBe(201);
      const task = JSON.parse(response.body);
      expect(task.state).toBe('running');
      expect(task.runs).toHaveLength(1);
      expect(task.runs[0].agentId).toBe('mock');

      // Verify work message was published
      expect(workMessages).toHaveLength(1);
      expect(workMessages[0].topic).toBe('agents.mock.work');
      expect(workMessages[0].payload).toMatchObject({
        taskId: task.id,
        runId: task.runs[0].id,
        goal: 'Test goal',
      });
    });

    it('should not spawn a run when creating a task without agents', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: 'Test Task',
          goal: 'Test goal',
          targetRepo: 'https://github.com/test/repo.git',
          agents: [],
        },
      });

      expect(response.statusCode).toBe(201);
      const task = JSON.parse(response.body);
      expect(task.state).toBe('planned');
      expect(task.runs).toBeUndefined();

      // Verify no work message was published
      expect(workMessages).toHaveLength(0);
    });
  });

  describe('Transition to awaiting-approvals when PR appears', () => {
    it('should transition task to awaiting-approvals when run has PR info', async () => {
      // Create task with agent
      const createResponse = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: 'Test Task',
          goal: 'Test goal',
          targetRepo: 'https://github.com/test/repo.git',
          agents: ['mock'],
        },
      });

      const task = JSON.parse(createResponse.body);
      const runId = task.runs[0].id;

      // Simulate composer outcome by updating the run with PR info
      const runsRepo = (
        app as {
          _runsRepo?: { update: (id: string, updater: (run: unknown) => unknown) => unknown };
        }
      )._runsRepo!;
      runsRepo.update(runId, (run: unknown) => ({
        ...(run as Record<string, unknown>),
        pr: { branch: 'feat/run-x', url: 'http://example.com/pr/12', number: 12 },
      }));

      // Publish done status
      await bus.publish(topics.runStatus(runId), { state: 'done' });

      // Wait a bit for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check task state
      const getResponse = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}`,
      });

      const updatedTask = JSON.parse(getResponse.body);
      expect(updatedTask.state).toBe('awaiting-approvals');
      expect(updatedTask.pr).toMatchObject({
        branch: 'feat/run-x',
        url: 'http://example.com/pr/12',
        number: 12,
      });
    });
  });

  describe('Transition to done (no PR)', () => {
    it('should transition task to done when run completes without PR', async () => {
      // Create task with agent
      const createResponse = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: 'Test Task',
          goal: 'Test goal',
          targetRepo: 'https://github.com/test/repo.git',
          agents: ['mock'],
        },
      });

      const task = JSON.parse(createResponse.body);
      const runId = task.runs[0].id;

      // Publish done status without PR
      await bus.publish(topics.runStatus(runId), { state: 'done' });

      // Wait a bit for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check task state
      const getResponse = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}`,
      });

      const updatedTask = JSON.parse(getResponse.body);
      expect(updatedTask.state).toBe('done');
      expect(updatedTask.pr).toBeUndefined();
    });
  });

  describe('Transition to error', () => {
    it('should transition task to error when run fails', async () => {
      // Create task with agent
      const createResponse = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: 'Test Task',
          goal: 'Test goal',
          targetRepo: 'https://github.com/test/repo.git',
          agents: ['mock'],
        },
      });

      const task = JSON.parse(createResponse.body);
      const runId = task.runs[0].id;

      // Publish error status
      await bus.publish(topics.runStatus(runId), {
        state: 'error',
        detail: { message: 'failed' },
      });

      // Wait a bit for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check task state
      const getResponse = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}`,
      });

      const updatedTask = JSON.parse(getResponse.body);
      expect(updatedTask.state).toBe('error');
      expect(updatedTask.error).toContain('failed');
    });

    it('should transition task to error when run is canceled', async () => {
      // Create task with agent
      const createResponse = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: 'Test Task',
          goal: 'Test goal',
          targetRepo: 'https://github.com/test/repo.git',
          agents: ['mock'],
        },
      });

      const task = JSON.parse(createResponse.body);
      const runId = task.runs[0].id;

      // Publish canceled status
      await bus.publish(topics.runStatus(runId), { state: 'canceled' });

      // Wait a bit for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check task state
      const getResponse = await app.inject({
        method: 'GET',
        url: `/tasks/${task.id}`,
      });

      const updatedTask = JSON.parse(getResponse.body);
      expect(updatedTask.state).toBe('error');
      expect(updatedTask.error).toContain('canceled');
    });
  });

  describe('Idempotent spawn', () => {
    it('should not spawn multiple runs for the same task', async () => {
      // Create task with agent
      const createResponse = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: 'Test Task',
          goal: 'Test goal',
          targetRepo: 'https://github.com/test/repo.git',
          agents: ['mock'],
        },
      });

      const task = JSON.parse(createResponse.body);
      expect(task.runs).toHaveLength(1);
      const originalRunId = task.runs[0].id;

      // Clear work messages
      workMessages = [];

      // Try to spawn another run for the same task by calling the orchestrator directly
      const orchestrator = (
        app as {
          _taskOrchestrator?: {
            spawnRunForTask: (task: unknown, agentId: string) => Promise<string>;
          };
        }
      )._taskOrchestrator!;
      const taskRepo = (app as { _taskRepo?: { get: (id: string) => unknown } })._taskRepo!;
      const currentTask = taskRepo.get(task.id);

      // Call spawnRunForTask again on the same task
      const secondRunId = await orchestrator.spawnRunForTask(currentTask, 'mock');

      // Should return the same run ID (idempotent)
      expect(secondRunId).toBe(originalRunId);

      // Get the updated task
      const updatedTask = taskRepo.get(task.id);
      expect(updatedTask.runs).toHaveLength(1);
      expect(updatedTask.runs[0].id).toBe(originalRunId);

      // Verify no additional work messages were published
      expect(workMessages).toHaveLength(0);
    });
  });
});
