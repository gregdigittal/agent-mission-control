# Handoff Note for agent-docs: GitHub Actions Integration

<!-- TODO[agent-api]: Add the content below to infra/README.md as a new section
     titled "GitHub Actions Integration". This documents the agent-on-pr.yml
     workflow, required secrets, and deployment configuration. -->

---

## GitHub Actions Integration

The `agent-on-pr.yml` workflow (`.github/workflows/agent-on-pr.yml`) automatically
spawns a Claude Code review agent whenever a pull request is opened, synchronised,
or reopened.

### What it does

1. Computes the PR diff (`git diff origin/$BASE_REF...HEAD`)
2. Truncates the diff to 500 lines and calls `POST /api/sessions` on the deployed
   Agent Mission Control instance
3. Posts a PR comment with a link to the review session in the dashboard
4. Falls back to a plain "unavailable" comment if the API call fails (the workflow
   does NOT fail the PR — `continue-on-error: true`)

### Required repository secrets

| Secret | Description |
|--------|-------------|
| `AGENT_MC_API_URL` | Base URL of your deployed Agent Mission Control (e.g. `https://yourapp.vercel.app`) |
| `AGENT_MC_API_SECRET` | Bearer token matching `AGENT_MC_API_SECRET` in your Vercel environment |

Configure these at: **Repository → Settings → Secrets and variables → Actions**

### Configuring AGENT_MC_API_URL

Set this to the Vercel deployment URL for your Agent Mission Control instance.
You can find it in the Vercel dashboard under your project's Deployments tab,
or from the `deploy` job output in the CI workflow.

### Security notes

- The PR diff is passed via an environment variable (`PR_DIFF`), never interpolated
  directly into shell commands. This prevents shell injection from malicious branch
  names or diff content.
- `jq --arg` is used to construct the JSON payload, ensuring proper escaping.
- The `AGENT_MC_API_SECRET` value is never echoed or logged.
