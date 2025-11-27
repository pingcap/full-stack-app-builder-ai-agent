# Full-Stack App Builder AI Agent

> Think of this as a lean, self-hostable cousin of [Lovable.dev](https://lovable.dev/)—describe an app, watch [Codex (gpt-5.1-codex)](https://openai.com/codex/) and [Claude Code (claude-sonnet-4.5)](https://www.claude.com/product/claude-code) plus [TiDB Cloud](https://www.pingcap.com/tidb/cloud/), Vercel, and [GitHub](https://github.com/) build, test, and deploy it automatically.

## Overview
Imagine describing an app in chat and watching an agent ship it live. This repository hosts that control plane: operators log in with NextAuth, paste a prompt, and the agent provisions GitHub repos, TiDB Cloud branches, Vercel projects + sandboxes, runs Codex through `code-tee`, commits, deploys, and streams transcripts in `/s/:slug`. The stack blends Next.js App Router, shadcn/ui, Tailwind CSS v4, TanStack React Query/Form, Vercel AI SDK, and [Kysely](https://kysely.dev/) so every step—auth, orchestration, execution, visualization—lives in one place. TiDB Cloud sits at the center, acting as both the control-plane database and the per-app, branchable datastore that keeps schema changes isolated yet resumable.

## Architecture Overview
```
[Browser] ⇄ Next.js App Router (auth/session UI)
     │
     ├─ API / actions → GitHub (template repos, commits)
     │                 → TiDB Cloud (clusters + branches)
     │                 → Vercel (projects, [Blob](https://vercel.com/docs/vercel-blob), [Sandbox](https://vercel.com/docs/vercel-sandbox))
     │                 → Codex (gpt-5.1-codex via code-tee) / Claude Code (claude-sonnet-4.5)
     └─ Stream Proxy → `/v2/streams/:session` → UI viewers
```
> Diagram also available in Feishu Docs for richer formatting.

## Key Capabilities
- **Resource orchestration** – `src/actions/projects.ts` provisions GitHub repos from the `634750802/nextjs-tidbcloud-serverless-kysely-template`, creates TiDB Cloud clusters/branches via the serverless API, and registers Vercel projects/team tokens per user.
- **Autonomous coding sessions** – Each `task_revision` (see `migrations/000-first.ts`) spawns a TiDB branch and a Vercel sandbox, writes secrets into `.env.local`, launches `npm run dev`, runs `code-tee codex ...`, pushes commits back to GitHub, uploads Codex traces to Vercel Blob Storage, and reports completion through the webhook at `src/app/hooks/v1/sandboxes/[sandboxId]/route.ts`.
- **Session and streaming UI** – `/s/[slug]` renders longitudinal conversations using AI UI components, reads live message streams via the `STREAM_PROXY_URL` endpoints, and lets reviewers inspect agent output, commits, and branch previews.
- **Protected workspace** – `src/proxy.ts` wraps protected routes with NextAuth middleware so only credentialed operators reach `/projects`, `/settings`, API v1 endpoints, or the customer preview slug.

## How It Works: End-to-End Flow
### Control Plane Credentials
Before the agent codes, operators configure:
- **GitHub token** – create repos, push commits, manage branches.
- **Vercel token** – issue Blob storage credentials and start sandboxes.
- **Codex (gpt-5.1-codex) + Claude Code (claude-sonnet-4.5)** – reasoning + code generation.
- **TiDB Cloud API keys** – spawn clusters, branches, and per-app databases.

These credentials wire infrastructure, code, and data into a single orchestrated loop.

### Agent Workflow
1. **Prompt** – “Build a todo app with auth and migrations.”
2. **Plan** – Codex (via `code-tee`) infers architecture, stack, and dependencies from the repo context.
3. **Provision** – `createProject` ensures TiDB Cloud cluster/branch, GitHub repo, and Vercel project/token exist; `createSandbox` and `createTiDBCloudBranch` ready per-task environments.
4. **Generate** – Codex streams code edits, test hooks, and UI copy while Next.js surfaces live transcripts.
5. **Migrate** – Kysely migrations run inside the sandbox against the TiDB branch so schema changes match each revision.
6. **Deploy** – Commits push to GitHub and trigger Vercel previews tied to that branch + database.
7. **Iterate** – Reviewers chat in `/s/:slug`, triggering new `task_revision`s that reuse prior branches and context.

## Magic Features
Where TiDB Cloud + Vercel + Codex snap together:
- **Checkpointing & Versioning** – TiDB branches mirror Git branches so database state rolls forward/back just like code.
- **Schema migrations via Kysely** – typed SQL builders keep Next.js Server Actions honest and portable.
- **Versioned secrets** – Env material gets stored via user settings (TiDB) and pushed into sandboxes on demand.
- **Scale-to-zero infra** – TiDB Cloud serverless and Vercel sandboxes spin down when idle, perfect for bursty agent workloads.

```ts
// TiDB Cloud branch creation (simplified)
import fetch from "node-fetch";

async function createBranch(clusterId, displayName, publicKey, privateKey) {
  const res = await fetch(
    `https://serverless.tidbapi.com/v1beta1/clusters/${clusterId}/branches`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " + Buffer.from(`${publicKey}:${privateKey}`).toString("base64"),
      },
      body: JSON.stringify({ displayName }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).branchId;
}
```

## Directory Layout
| Path | Purpose |
| --- | --- |
| `src/app/(auth)` | Credential login flow rendered via `LoginForm`. |
| `src/app/(main)` | Internal dashboard (project list, per-project GitHub/Vercel cards, task tables, dialogs). |
| `src/app/(customer)/s/[slug]` | Session replay UI backed by `getSessionData`. |
| `src/app/api` | Versioned REST hooks for projects, tasks, revisions, sandboxes, TiDB Cloud branches, Vercel resources, and debug message streams. |
| `src/actions` | Server actions encapsulating provisioning logic for projects, tasks, revisions, Vercel sandboxes, and TiDB Cloud branches. |
| `src/lib` | Auth, DB, TiDB Cloud client, user setting validators, AI model helpers, utility types, and `generateSessionId`. |
| `src/sandboxes` | Helpers that orchestrate `@vercel/sandbox` lifecycle (install tools, resume sessions from Blob storage, enforce trusted runtimes). |
| `migrations` | Kysely migrations plus schema evolution for `user`, `project`, `task`, `task_revision`, `tidbcloud_branch`, `vercel_sandbox`, and `ui_session`. |
| `scripts` | Local DX helpers (`migrate.ts`, `setup-local-user.js`, `gen-password.js`). |

## Prerequisites & Environment
- Node.js 18.18+ (Next.js 16 requirement) and npm.
- TiDB Serverless account with API keys, organization/project IDs, region, and database endpoint.
- GitHub account with access to install the required template and push commits via Personal Access Token.
- Vercel team token with Blob Storage enabled.
- OpenAI (or CRS) API key to drive Codex sessions and `code-tee`.
- Stream proxy service that exposes `/v2/streams/:session`.
- Required environment variables:
  - `DATABASE_URL`
  - `OPENAI_API_KEY` (and `CRS_OAI_KEY` for `code-tee`)
  - `TIDB_CLOUD_REGION`, `TIDB_CLOUD_DATABASE_ENDPOINT`
  - `STREAM_PROXY_URL`
  - `HOOK_AUTH_TOKEN`, `HOOK_BASE_URL` (defaults to `https://${VERCEL_URL}`)
  - `BCRYPT_SALT`
  - Optional: `VERCEL_URL` when running on Vercel.

## Setup
```bash
npm install

# Bootstrap TiDB schema (creates the schema + tables and regenerates typed bindings)
npm run migrate:init       # one-time schema creation
npm run migrate:up         # run pending migrations

# Create your first local operator seeded with GitHub + password credentials
node scripts/setup-local-user.js
# (Use scripts/gen-password.js if you only need to hash a password with BCRYPT_SALT)

# Launch the workspace
npm run dev
```
Visit `http://localhost:3000/login`, authenticate with the user you just created, and start creating projects or sessions.

## Core npm Scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Starts the App Router dev server with live reload. |
| `npm run build` / `npm run start` | Compile and serve the production bundle. |
| `npm run lint` | Run Biome lint rules (Next/React presets). |
| `npm run format` | Apply Biome formatting in-place. |
| `npm run migrate:init|up|down` | Execute the TiDB schema bootstrap/migration workflow in `scripts/migrate.ts` and regenerate `src/lib/db/schema.d.ts`. |
| `npm run install-shadcn-components` | Re-sync shadcn/ui components based on `components.json`. |

## Operational Workflows
### Provisioning Projects
`POST /api/v1/projects` accepts a name + Vercel team ID. `createProject` validates GitHub/TiDB/Vercel credentials, clones the template repo, waits for the `main` branch, builds a TiDB cluster (`createCluster` → `prepareCluster`), allocates a Vercel project/token, and marks the project `ready`. Secrets stay server-side until sandboxes request them.

### Authoring Tasks & Agent Revisions
- `CreateTaskDialog` posts to `/api/v1/projects/:projectId/tasks`, fetching the base branch SHA and storing `git_revision_ref` + target branch.
- `POST /api/v1/projects/:p/tasks/:t/revisions` or `/api/v1/sessions` kicks off `createTaskRevision`.
- Each revision creates a TiDB branch, resumes a Vercel sandbox, injects `.env.local` with branch credentials, runs `npm run dev` + `code-tee`, commits/pushes back to GitHub, uploads `.codex` artifacts to Blob storage, and fires the sandbox webhook.

### Sessions, Streams, Webhooks
- `/s/:slug` pulls `ui_session` via `getSessionData`, renders AI conversations, and streams assistant output through `/api/v1/projects/:p/tasks/:t/revisions/:r/message-stream`.
- Sandboxes POST to `/hooks/v1/sandboxes/:id`, authenticated by `HOOK_AUTH_TOKEN`, which captures stdout/stderr, updates revision status, persists AI message JSON, and stops the sandbox.
- `/api/v1/debug/streams/:sessionId` mirrors the underlying UI stream for troubleshooting.

### API Surface
- `/api/v1/projects`, `/tasks`, `/revisions`, `/vercel-sandboxes`, `/tidbcloud-branches`, `/sessions`, `/vercel/teams`, etc., power the React UI and external automations.
- `src/proxy.ts` enforces NextAuth guards for all privileged routes.

## Database & Migrations
TiDB Serverless hosts the relational core. Tables cover users, per-user cloud credentials (`user_setting`), projects, tasks, task revisions, TiDB branches, Vercel sandboxes, and UI sessions. Migrations are written in TypeScript with Kysely’s schema builder. Running any migration regenerates `src/lib/db/schema.d.ts` via `kysely-codegen`, ensuring type-safe query builders throughout `src/lib` and `src/app`. Branch connection URLs are derived from `TIDB_CLOUD_DATABASE_ENDPOINT` plus the branch-specific `userPrefix`.

## Testing & QA
Automated unit/integration tests are not yet scaffolded. Before opening a PR:
1. Assert that provisioning still works by creating a disposable project and verifying the TiDB/Vercel/GitHub assets.
2. Drive at least one `task_revision` through completion and confirm that commits land on the right branch, codex artifacts upload, and `/s/:slug` streams render.
3. Smoke-test migrations (`npm run migrate:up && npm run migrate:down`) against a throwaway TiDB cluster.
4. Capture manual verification notes (see `AGENTS.md` for expectations) covering builder UI, session view, and webhooks.

## Contributing & Further Reading
- Follow the contributor playbook in [AGENTS.md](./AGENTS.md) for coding style, naming, PR, and security guidelines.
- Keep secrets in `.env.local` files only; never commit credentials.
- Use the helper scripts for creating operators and hashing passwords instead of writing directly to TiDB.
- Explore `src/lib/user-settings/*` when adjusting provider requirements, and propagate changes to provisioning actions.
- When extending features (new sandbox types, auth providers, or model backends), mirror the existing server action + API route pattern so telemetry and streaming continue to work.

Use this repo as your reference template for building your own AI app builder—fork it, run it locally, or adapt it to your infra stack. Together with `AGENTS.md`, the README should equip you to operate, extend, and ship improvements confidently.
