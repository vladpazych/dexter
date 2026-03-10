## General

- Treat `dexter` as repo workflow and CLI infrastructure.
- Preserve source exports. `packages/dexter/src/**` is the source of truth; do not add a build step or generated source artifacts.
- Keep abstractions small and typed. Use Zod for runtime types and `z.infer` for derived TypeScript types.
- Make command surfaces self-describing. Leaf commands declare `description`, `args`, `options`, and `run`; namespaces declare `description` and nested `commands`.
- Keep CLI output simple. Human-readable CLI is the default; JSON stays machine-consumable.
- Keep package boundaries explicit. `@vladpazych/dexter/cli` owns the repo CLI runtime; `env`, `pipe`, and `terminal` are reusable primitives.
- Keep repo-local tooling one-way. `meta/**` may depend on `packages/dexter/**`; `packages/dexter/**` must not depend on repo-local tooling.
- Use Bun tooling.

## Structure

- `package.json` is the root workspace package and should stay a thin orchestrator.
- `packages/dexter/` is the published package.
- `meta/config/` is the shared private config package. It owns workspace ESLint and shared tsconfig presets.
- `meta/commands/` is the private repo command package consumed by `dexter.config.ts`.
- `packages/dexter/src/meta/` owns command runtime, repo context, adapters, and workspace helpers.
- `packages/dexter/src/env/`, `packages/dexter/src/pipe/`, and `packages/dexter/src/terminal/` own reusable non-CLI primitives.
- `packages/dexter/bin/dexter` is the installed CLI entrypoint.
- `packages/dexter/test/**/*.test.ts` covers package behavior. Keep tests near the subsystem they exercise.
- `dexter.config.ts` is the repo-level runtime contract.
- `eslint.config.ts` should consume `@repo/meta-config/eslint` rather than defining ad hoc rules inline.

## Constraints

- Do not couple core APIs to a specific agent tool, plugin system, or hidden context mechanism.
- Do not add hook systems, governance flows, receipts, or repo-specific policy engines.
- Do not turn the root export into a mixed grab bag. Add public surface through deliberate subpath boundaries.
- Handle `null` and `undefined` explicitly. Do not use `!`.
- Prefer `unknown` with narrowing over `any`. Use `as` only when the type system cannot express a test fixture or boundary.
- Comment non-obvious intent only.
- Ask permission before changing specs, rewriting expectations, or doing branch history operations.
- Validate package changes with `bun run --cwd packages/dexter typecheck` and targeted `bun test` coverage before handoff.
