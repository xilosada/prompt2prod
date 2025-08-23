import type { FastifyInstance } from 'fastify';
import { getOctokit, createPullRequest } from '../git/gh.js';

export function registerPrRoutes(app: FastifyInstance) {
  app.post(
    '/runs/:id/pr',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['repo', 'head', 'base', 'title'],
          properties: {
            repo: { type: 'string', pattern: '^[^/]+/[^/]+$' },
            head: { type: 'string', minLength: 1 },
            base: { type: 'string', minLength: 1 },
            title: { type: 'string', minLength: 1 },
            body: { type: 'string' },
            draft: { type: 'boolean' },
          },
        },
        response: {
          201: {
            type: 'object',
            required: ['number', 'url'],
            properties: { number: { type: 'number' }, url: { type: 'string' } },
          },
          500: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } },
          502: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } },
        },
      },
    },
    async (req, reply) => {
      const { repo, head, base, title, body, draft } = req.body as {
        repo: string;
        head: string;
        base: string;
        title: string;
        body?: string;
        draft?: boolean;
      };
      try {
        const [owner, name] = repo.split('/');
        const octokit = getOctokit(); // throws if missing
        const { number, url } = await createPullRequest(octokit, {
          owner,
          repo: name,
          head,
          base,
          title,
          body,
          draft,
        });
        reply.code(201).send({ number, url });
      } catch (e: unknown) {
        const error = e as Error;
        reply.code(error?.message === 'github_token_missing' ? 500 : 502).send({
          error:
            error?.message === 'github_token_missing' ? 'github_token_missing' : 'github_api_error',
        });
      }
    },
  );
}
