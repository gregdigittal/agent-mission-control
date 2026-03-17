---
id: using-the-api
title: Using the API
sidebar_position: 3
---

# Using the API

Agent Mission Control exposes a REST API for programmatic control — CI/CD pipelines, scripts, and third-party integrations.

## Authentication

All API requests require a Bearer token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer $AGENT_MC_API_SECRET" \
     https://your-amc-app.vercel.app/api/sessions
```

Set `AGENT_MC_API_SECRET` in your Vercel environment variables (or `.env` for local development).

## Base URL

| Environment | Base URL |
|-------------|----------|
| Vercel (production) | `https://your-amc-app.vercel.app/api` |
| Local development | `http://localhost:3000/api` |

## Sessions

### List sessions

```bash
GET /api/sessions?limit=20&cursor=<cursor>&status=running
```

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Max results per page (1–100) |
| `cursor` | string | — | Opaque pagination cursor from previous response |
| `status` | string | — | Filter by status: `pending`, `running`, `done`, `error` |

**Response:**

```json
{
  "items": [
    {
      "id": "sess_abc123",
      "title": "feat/add-login-page",
      "status": "running",
      "agentCount": 2,
      "totalCostCents": 1450,
      "created_at": "2026-03-12T10:00:00Z"
    }
  ],
  "nextCursor": "2026-03-12T10:00:00Z",
  "hasMore": true
}
```

### Create a session

```bash
POST /api/sessions
Content-Type: application/json

{
  "title": "feat/add-login-page",
  "repoPath": "/home/user/my-project",
  "agentKey": "backend-1",
  "prompt": "Add a login page component",
  "model": "claude-sonnet-4-6",
  "commitSha": "abc123def456",
  "repoName": "owner/repo"
}
```

**Response:** `201 Created` with the session record.

### Get a session

```bash
GET /api/sessions/:id
```

**Response:**

```json
{
  "id": "sess_abc123",
  "title": "feat/add-login-page",
  "status": "running",
  "agentKey": "backend-1",
  "model": "claude-sonnet-4-6",
  "totalCostCents": 1450,
  "created_at": "2026-03-12T10:00:00Z",
  "updated_at": "2026-03-12T10:05:00Z"
}
```

### Update a session

```bash
PATCH /api/sessions/:id
Content-Type: application/json

{
  "title": "feat/add-login-page-v2",
  "status": "done"
}
```

At least one of `title` or `status` is required.

### Terminate a session

```bash
DELETE /api/sessions/:id
```

Writes a `terminate` command to the bridge. The agent receives a graceful termination signal.

**Response:**

```json
{
  "sessionId": "sess_abc123",
  "commandId": "cmd_xyz789",
  "status": "terminating"
}
```

## Session Tasks

### List tasks for a session

```bash
GET /api/sessions/:id/tasks
```

**Response:**

```json
[
  {
    "id": "task_1",
    "session_id": "sess_abc123",
    "title": "Implement auth middleware",
    "status": "in_progress",
    "assignee": "backend-1"
  }
]
```

### Update a task

```bash
PATCH /api/sessions/:id/tasks
Content-Type: application/json

{
  "id": "task_1",
  "status": "done"
}
```

Valid status transitions: `backlog → todo → in_progress → review → done`.

## Rate Limiting

The API enforces a sliding window rate limit of **60 requests per minute per API key**.

Rate limit headers are included in every response:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Remaining requests in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

When the limit is exceeded, the API returns `429 Too Many Requests`.

## Error Responses

All errors follow this shape:

```json
{
  "error": "Human-readable description",
  "code": "MACHINE_READABLE_CODE"
}
```

| HTTP Status | Code | Meaning |
|------------|------|---------|
| 400 | `BAD_REQUEST` | Missing or invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid Bearer token |
| 404 | `NOT_FOUND` | Session not found |
| 405 | `METHOD_NOT_ALLOWED` | HTTP method not supported |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Content-Type must be `application/json` |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

## CI/CD Integration

The GitHub Actions workflow `.github/workflows/agent-on-pr.yml` demonstrates a complete CI integration:

1. On PR open → spawn a review agent via `POST /api/sessions`
2. Poll `GET /api/sessions/:id` every 2 minutes
3. When done → post findings as a PR comment
4. Set GitHub commit status to `success` or `failure`

See [GitHub Actions Integration](../bridge/overview#command-format) for the full workflow example.

## OpenAPI Spec

A machine-readable OpenAPI 3.1 spec is available at:

```
GET /api/openapi
```

Import it into Postman, Insomnia, or any OpenAPI-compatible client for auto-generated request builders.
