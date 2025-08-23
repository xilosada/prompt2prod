import type { FastifyInstance } from 'fastify';
import { orchestrateRunToPr } from '../orchestrator/runToPr.js';
import type { Patch } from '../patch/apply.js';

export function registerPrComposeRoutes(app: FastifyInstance) {
  app.post(
    '/runs/:id/pr/compose',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['repo', 'base', 'title', 'remoteUrl'],
          properties: {
            repo: { type: 'string', pattern: '^[^/]+/[^/]+$' },
            base: { type: 'string', minLength: 1 },
            head: { type: 'string' },
            title: { type: 'string', minLength: 1 },
            body: { type: 'string' },
            draft: { type: 'boolean' },
            remoteUrl: { type: 'string', minLength: 1 },
            patch: {
              type: 'object',
              oneOf: [
                {
                  properties: {
                    files: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['path', 'content'],
                        properties: {
                          path: { type: 'string' },
                          content: { type: 'string' },
                          eol: { type: 'string', enum: ['lf', 'crlf', 'none'] },
                        },
                      },
                    },
                  },
                  required: ['files'],
                },
                {
                  properties: {
                    ops: {
                      type: 'array',
                      items: {
                        type: 'object',
                        oneOf: [
                          {
                            properties: {
                              kind: { const: 'write' },
                              path: { type: 'string' },
                              content: { type: 'string' },
                              eol: { type: 'string', enum: ['lf', 'crlf', 'none'] },
                            },
                            required: ['kind', 'path', 'content'],
                          },
                          {
                            properties: { kind: { const: 'delete' }, path: { type: 'string' } },
                            required: ['kind', 'path'],
                          },
                          {
                            properties: {
                              kind: { const: 'rename' },
                              from: { type: 'string' },
                              to: { type: 'string' },
                            },
                            required: ['kind', 'from', 'to'],
                          },
                        ],
                      },
                    },
                  },
                  required: ['ops'],
                },
              ],
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              head: { type: 'string' },
              sha: { type: 'string' },
              pr: {
                type: 'object',
                properties: { number: { type: 'number' }, url: { type: 'string' } },
                required: ['number', 'url'],
              },
            },
            required: ['head', 'sha', 'pr'],
          },
          500: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } },
          502: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } },
        },
      },
    },
    async (req, reply) => {
      const id = (req.params as { id: string }).id;
      const { repo, base, head, title, body, draft, remoteUrl, patch } = req.body as {
        repo: string;
        base: string;
        head?: string;
        title: string;
        body?: string;
        draft?: boolean;
        remoteUrl: string;
        patch: Patch;
      };

      // Trim and normalize user inputs
      const trimmedRepo = repo.trim();
      const trimmedBase = base.trim();
      const trimmedTitle = title.trim();
      const trimmedHead = head?.trim();

      // Validate branch name if provided
      const finalHead =
        trimmedHead && trimmedHead.length > 0 && !/\s/.test(trimmedHead) ? trimmedHead : undefined; // Will use default in orchestrator

      try {
        const res = await orchestrateRunToPr({
          runId: id,
          repo: trimmedRepo,
          base: trimmedBase,
          head: finalHead,
          title: trimmedTitle,
          body,
          draft,
          remoteUrl,
          patch,
        });
        reply.code(201).send({ head: res.head, sha: res.sha, pr: res.pr });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const code = msg === 'github_token_missing' ? 500 : 502;
        reply.code(code).send({
          error: msg === 'github_token_missing' ? 'github_token_missing' : 'orchestrate_error',
        });
      }
    },
  );
}
