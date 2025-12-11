# Repository Guidelines

## Project Structure & Module Organization
Next.js App Router screens live in `src/app`, with each route folder owning its layouts, loaders, and metadata. Shared actions sit in `src/actions`, UI primitives in `src/components`, reusable hooks in `src/hooks`, and service clients plus schema helpers in `src/lib`. Agent sandboxes live in `src/sandboxes`, migrations in `migrations/`, and the helper runner in `scripts/migrate.ts`. Keep static assets inside `public/` and colocate feature-specific code to keep ownership obvious.

## Build, Test, and Development Commands
- `npm run dev`: Starts the live-reload dev server on `http://localhost:3000`.
- `npm run build`: Produces the optimized production bundle.
- `npm run start`: Serves the latest build to mimic the Vercel runtime.
- `npm run lint`: Runs Biome’s linter (type-aware checks, import hygiene, unused code).
- `npm run format`: Applies Biome formatting in place; run before committing.
- `npm run migrate:init|up|down`: Executes the Kysely/TiDB migration script in `scripts/`.

## Tech Stack & Libraries
- Runtime: Next.js App Router (v16) on React 19 with TypeScript 5 ESM; strict mode stays on (`tsconfig.json` sets `strict: true`, `moduleResolution: bundler`).
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss`; merge utilities with `tailwind-merge` and keep primitives in `src/components/ui` (Radix + shadcn patterns powered by `class-variance-authority`, `clsx`).
- Data & state: TanStack Query for server data, TanStack React Form for inputs, Kysely against TiDB with `kysely-codegen`-backed schemas; prefer `@/lib` clients and `src/actions` for server mutations.
- Auth & sessions: `better-auth` with theme handling via `next-themes`; cache/session helpers live in `src/lib`.
- AI & DX: Vercel AI SDK (`ai` + `@ai-sdk/openai`/`@anthropic-ai/sdk`) for model calls, shiki for syntax, framer-motion/motion for animation, xyflow/embla for canvas/flows, and Upstash Redis for lightweight persistence.

## Coding Style & Naming Conventions
TypeScript + ESM are required. Use PascalCase for components (`BuilderPanel.tsx`), camelCase for hooks (`useBuilderStore.ts`), and kebab-case for utility files. Add `use client`/`use server` directives as the first statement when needed. Keep code type-safe (React 19 + TS strict), prefer `zod` schemas for validation, and colocate helpers with features. Use Tailwind utility classes; extract reusable variants with `class-variance-authority` under `src/components/ui`. Imports should leverage the `@/*` alias instead of long relative paths. Prefer `async`/`await` with server actions in `src/actions`, and keep React Query/TanStack Form hooks colocated with the components that consume them. Always run `npm run lint` followed by `npm run format`; never commit generated output.

## Testing Guidelines
There is no automated harness yet, so document manual verification steps for every PR (builder canvas flow, migrations, auth). When adding tests, colocate them as `*.test.ts(x)` siblings, use React Testing Library with Vitest (preferred stack), and aim for ≥80 % line coverage on new or changed modules. Exercise migration updates against a disposable TiDB instance via `npm run migrate:up` before review.

## Commit & Pull Request Guidelines
Git history currently uses concise, lower-case summaries (`first commit`). Keep the same tone: imperative subject ≤72 chars (`add builder diff panel`) and an optional rationale body referencing tickets (`Refs #123`). PRs must include a short description, screenshots or GIFs for UI tweaks, migration/env callouts, and a manual QA checklist. Request at least one maintainer review and squash once CI + checks pass.

## Security & Configuration Tips
Store secrets in `.env`/`.env.local` only, and never commit them. Regenerate credentials touched inside `src/lib` helpers if they leak during logging. Sandbox integrations must run with least privilege and avoid persisting user code outside approved storage buckets.
