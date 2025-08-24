import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server.js';

describe('Tasks API', () => {
  it('POST /tasks - creates task with valid payload', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Refactor CI',
      goal: 'Speed up checks',
      targetRepo: 'file:///tmp/remote.git',
      agents: ['qa', 'infra'],
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(201);
    const task = JSON.parse(response.body);

    expect(task).toMatchObject({
      title: 'Refactor CI',
      goal: 'Speed up checks',
      targetRepo: 'file:///tmp/remote.git',
      agents: ['qa', 'infra'],
      state: 'planned',
    });

    expect(task.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(task.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(task.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // Check Location header
    expect(response.headers.location).toBe(`/tasks/${task.id}`);
  });

  it('POST /tasks - creates task with minimal payload', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: 'https://github.com/owner/repo',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(201);
    const task = JSON.parse(response.body);

    expect(task).toMatchObject({
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: 'https://github.com/owner/repo',
      agents: [],
      state: 'planned',
    });
  });

  it('POST /tasks - trims whitespace from inputs', async () => {
    const app = await buildServer();

    const payload = {
      title: '  Test Task  ',
      goal: '  Test goal  ',
      targetRepo: '  https://github.com/owner/repo  ',
      agents: ['  qa  ', '  infra  '],
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(201);
    const task = JSON.parse(response.body);

    expect(task).toMatchObject({
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: 'https://github.com/owner/repo',
      agents: ['qa', 'infra'],
      state: 'planned',
    });
  });

  it('POST /tasks - filters out empty agent entries', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: 'https://github.com/owner/repo',
      agents: ['qa', '', '  ', 'infra', null, undefined],
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(201);
    const task = JSON.parse(response.body);

    expect(task.agents).toEqual(['qa', 'infra']);
  });

  it('POST /tasks - accepts GitHub HTTPS format for targetRepo', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: 'https://github.com/owner/repo',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(201);
  });

  it('POST /tasks - accepts file URL format for targetRepo', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: 'file:///tmp/remote.git',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(201);
  });

  it('POST /tasks - accepts GitHub SSH format for targetRepo', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: 'git@github.com:owner/repo.git',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(201);
  });

  it('POST /tasks - accepts GitHub HTTPS with .git suffix for targetRepo', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: 'https://github.com/owner/repo.git',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(201);
  });

  it('POST /tasks - returns 400 for invalid targetRepo format', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: 'invalid-format',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /tasks - returns 400 for empty targetRepo after trimming', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: '   ',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(400);
    const result = JSON.parse(response.body);
    expect(result.error).toContain('Target repository is required');
    expect(result.details).toEqual({ field: 'validation' });
  });

  it('POST /tasks - returns 400 for invalid title (too short)', async () => {
    const app = await buildServer();

    const payload = {
      title: '',
      goal: 'Test goal',
      targetRepo: 'owner/repo',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /tasks - returns 400 for invalid title (too long)', async () => {
    const app = await buildServer();

    const payload = {
      title: 'a'.repeat(121),
      goal: 'Test goal',
      targetRepo: 'owner/repo',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /tasks - returns 400 for invalid goal (too short)', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: '',
      targetRepo: 'owner/repo',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /tasks - returns 400 for invalid goal (too long)', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: 'a'.repeat(2001),
      targetRepo: 'owner/repo',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /tasks - returns 400 for missing targetRepo', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: 'Test goal',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /tasks - returns 400 for too many agents', async () => {
    const app = await buildServer();

    const payload = {
      title: 'Test Task',
      goal: 'Test goal',
      targetRepo: 'owner/repo',
      agents: Array.from({ length: 17 }, (_, i) => `agent${i}`),
    };

    const response = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /tasks - returns empty list initially', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'GET',
      url: '/tasks',
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);

    expect(result).toEqual({
      items: [],
      total: 0,
    });
  });

  it('GET /tasks - returns tasks in newest-first order by default', async () => {
    const app = await buildServer();

    // Create two tasks with a small delay to ensure different timestamps
    await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: {
        title: 'First Task',
        goal: 'First goal',
        targetRepo: 'https://github.com/owner/repo1',
      },
    });

    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));

    await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: {
        title: 'Second Task',
        goal: 'Second goal',
        targetRepo: 'https://github.com/owner/repo2',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/tasks',
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('Second Task');
    expect(result.items[1].title).toBe('First Task');
  });

  it('GET /tasks - supports sort=createdAt:asc', async () => {
    const app = await buildServer();

    // Create two tasks with a small delay to ensure different timestamps
    await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: {
        title: 'First Task',
        goal: 'First goal',
        targetRepo: 'https://github.com/owner/repo1',
      },
    });

    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));

    await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: {
        title: 'Second Task',
        goal: 'Second goal',
        targetRepo: 'https://github.com/owner/repo2',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/tasks?sort=createdAt:asc',
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('First Task');
    expect(result.items[1].title).toBe('Second Task');
  });

  it('GET /tasks - includes Link headers for pagination', async () => {
    const app = await buildServer();

    // Create three tasks
    for (let i = 1; i <= 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: `Task ${i}`,
          goal: `Goal ${i}`,
          targetRepo: `https://github.com/owner/repo${i}`,
        },
      });
      if (i < 3) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    const response = await app.inject({
      method: 'GET',
      url: '/tasks?limit=1&offset=1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers.link).toBeDefined();
    expect(response.headers.link).toContain('rel="next"');
    expect(response.headers.link).toContain('rel="prev"');
  });

  it('GET /tasks - respects limit parameter', async () => {
    const app = await buildServer();

    // Create three tasks
    for (let i = 1; i <= 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: `Task ${i}`,
          goal: `Goal ${i}`,
          targetRepo: `https://github.com/owner/repo${i}`,
        },
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: '/tasks?limit=2',
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);

    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(2);
  });

  it('GET /tasks - respects offset parameter', async () => {
    const app = await buildServer();

    // Create three tasks with small delays to ensure different timestamps
    for (let i = 1; i <= 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          title: `Task ${i}`,
          goal: `Goal ${i}`,
          targetRepo: `https://github.com/owner/repo${i}`,
        },
      });
      // Small delay between tasks to ensure different timestamps
      if (i < 3) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    const response = await app.inject({
      method: 'GET',
      url: '/tasks?offset=1&limit=2',
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);

    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('Task 2');
    expect(result.items[1].title).toBe('Task 1');
  });

  it('GET /tasks - returns 400 for invalid limit', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'GET',
      url: '/tasks?limit=0',
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /tasks - returns 400 for invalid offset', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'GET',
      url: '/tasks?offset=-1',
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /tasks/:id - returns task for valid id', async () => {
    const app = await buildServer();

    // Create a task
    const createResponse = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: {
        title: 'Test Task',
        goal: 'Test goal',
        targetRepo: 'https://github.com/owner/repo',
      },
    });

    const createdTask = JSON.parse(createResponse.body);

    // Get the task by id
    const response = await app.inject({
      method: 'GET',
      url: `/tasks/${createdTask.id}`,
    });

    expect(response.statusCode).toBe(200);
    const task = JSON.parse(response.body);

    expect(task).toEqual(createdTask);
  });

  it('GET /tasks/:id - returns 404 for non-existent id', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'GET',
      url: '/tasks/12345678-1234-1234-1234-123456789abc',
    });

    expect(response.statusCode).toBe(404);
    const result = JSON.parse(response.body);
    expect(result.error).toBe('Task not found');
    expect(result.details).toEqual({ id: '12345678-1234-1234-1234-123456789abc' });
  });

  it('GET /tasks/:id - returns 400 for invalid id format', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'GET',
      url: '/tasks/invalid-id',
    });

    expect(response.statusCode).toBe(400);
  });
});
