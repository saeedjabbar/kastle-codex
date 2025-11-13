# Repository Guidelines

## Project Structure & Module Organization
The repo currently tracks the production n8n workflow export `Dan-Prod-VisitorAuthorization.json` alongside environment scaffolding (`.env`, `.env.example`). Store additional workflows under `flows/` (create it if absent) and suffix filenames with the environment (`-dev`, `-prod`) to reduce confusion. When the Next.js client is expanded, keep route files under `app/`, shared utilities under `lib/`, and Supabase helpers in `lib/supabase.ts`. Co-locate fixture data under `data/` and add README snippets to every new folder describing its purpose.

## Build, Test, and Development Commands
Use `npm install --global n8n` once to obtain the CLI. Run `npx n8n start --tunnel` to exercise the workflow locally against Calendly webhooks. Import edits with `npx n8n import:workflow --input Dan-Prod-VisitorAuthorization.json` before committing so JSON formatting stays canonical. When the Next.js surface is present, use `npm install` followed by `npm run dev` to launch the frontend and `npm run lint` to check formatting.

## Coding Style & Naming Conventions
Author TypeScript modules with 2-space indentation and Prettier defaults; add a repo-level `.prettierrc` if you introduce new code. Components use PascalCase filenames (`VisitorTable.tsx`), hooks and helpers use camelCase (`useKastleSession.ts`). Mirror Supabase column names in snake_case when mapping within n8n expressions to avoid schema drift. Keep workflow node names action-oriented (“Create Supabase record”) so the exported JSON stays readable.

## Testing Guidelines
Dry-run Calendly payloads through the webhook node using `npx n8n execute --id <workflowId>` and confirm Supabase writes with the SQL editor before shipping updates. For UI code, add unit tests under `__tests__/` alongside the feature and wire them into `npm test` (Vitest or Jest). Aim for meaningful coverage on data parsing and Kastle request builders; include fixtures reflecting production booking examples.

## Commit & Pull Request Guidelines
Start commit subjects with an imperative scope (`feat: add visitor authorization mapping`). Each PR should describe workflow changes, list required environment variable additions, and attach screenshots or execution logs for n8n updates. Link Supabase issue IDs when schema changes, and request review from automations plus frontend owners. Ensure regenerated workflow JSON is included and re-run `npx n8n import` locally before requesting merge.

## Security & Configuration Tips
Store secrets only in `.env` or Supabase dashboard; never commit credentials. Rotate Calendly and Kastle keys after sharing exports, and revoke tunnels when not in use. Document any new configuration toggles inside `.env.example` so downstream agents can bootstrap environments quickly.
