import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { registerPrRoutes } from '../src/runs/pr.routes.js';

vi.mock('octokit', () => {
  const create = vi
    .fn()
    .mockResolvedValue({ data: { number: 123, html_url: 'https://gh/pr/123' } });
  const Octokit = vi.fn().mockImplementation(() => ({ rest: { pulls: { create } } }));
  return { Octokit };
});

describe('POST /runs/:id/pr', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, GITHUB_TOKEN: 't' };
  });
  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('creates a PR (mocked)', async () => {
    const app = Fastify();
    registerPrRoutes(app);

    const res = await app.inject({
      method: 'POST',
      url: '/runs/abc/pr',
      payload: {
        repo: 'org/repo',
        head: 'feat/branch',
        base: 'main',
        title: 'Test PR',
        body: 'desc',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ number: 123, url: 'https://gh/pr/123' });
  });

  it('errors when token missing', async () => {
    process.env.GITHUB_TOKEN = '';
    const app = Fastify();
    registerPrRoutes(app);
    const res = await app.inject({
      method: 'POST',
      url: '/runs/abc/pr',
      payload: { repo: 'org/repo', head: 'b', base: 'main', title: 't' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'github_token_missing' });
  });
});
