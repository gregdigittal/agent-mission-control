/**
 * GET /api/openapi
 *
 * Returns the OpenAPI 3.1 specification for the Agent Mission Control REST API.
 * No authentication required — the spec itself contains no secrets.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Agent Mission Control API',
    version: '1.0.0',
    description: 'REST API for orchestrating Claude Code agent sessions via the bridge daemon.',
  },
  servers: [
    { url: 'https://your-deployment.vercel.app/api', description: 'Production' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Value of the AGENT_MC_API_SECRET environment variable.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string' } },
      },
      SessionQueued: {
        type: 'object',
        required: ['sessionId', 'commandId', 'status'],
        properties: {
          sessionId: { type: 'string' },
          commandId: { type: 'string' },
          status: { type: 'string', enum: ['queued'] },
        },
      },
      SessionList: {
        type: 'object',
        required: ['items', 'hasMore'],
        properties: {
          items: { type: 'array', items: { type: 'object' } },
          nextCursor: { type: 'string', nullable: true },
          hasMore: { type: 'boolean' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/sessions': {
      get: {
        summary: 'List agent sessions',
        operationId: 'listSessions',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'Pagination cursor (created_at of last seen row)' },
          { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter by session status' },
        ],
        responses: {
          '200': { description: 'Paginated session list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionList' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      post: {
        summary: 'Create (spawn) a new agent session',
        operationId: 'createSession',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['objective', 'repoPath'],
                properties: {
                  objective: { type: 'string', description: 'What the agent should accomplish' },
                  repoPath:  { type: 'string', description: 'Absolute path to the git repository on the VPS' },
                  model:     { type: 'string', description: 'Claude model identifier (optional, uses bridge default)' },
                  maxTurns:  { type: 'integer', description: 'Max agent turns (optional)' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Session queued', content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionQueued' } } } },
          '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '415': { description: 'Unsupported media type', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/sessions/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Session ID' },
      ],
      get: {
        summary: 'Get a session by ID',
        operationId: 'getSession',
        responses: {
          '200': { description: 'Session data', content: { 'application/json': { schema: { type: 'object' } } } },
          '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      patch: {
        summary: 'Update session metadata',
        operationId: 'updateSession',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status:    { type: 'string' },
                  objective: { type: 'string' },
                },
                minProperties: 1,
              },
            },
          },
        },
        responses: {
          '200': { description: 'Updated session', content: { 'application/json': { schema: { type: 'object' } } } },
          '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      delete: {
        summary: 'Terminate a session',
        operationId: 'deleteSession',
        responses: {
          '200': { description: 'Termination queued', content: { 'application/json': { schema: { type: 'object', properties: { sessionId: { type: 'string' }, commandId: { type: 'string' }, status: { type: 'string', enum: ['terminating'] } } } } } },
          '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/sessions/{id}/tasks': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
      ],
      post: {
        summary: 'Create a task for an existing session',
        operationId: 'createTask',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title:       { type: 'string' },
                  description: { type: 'string' },
                  priority:    { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Task queued' },
          '400': { description: 'Bad request' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
  },
};

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(spec);
}
