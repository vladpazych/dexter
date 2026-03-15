## General

- Treat `dexter` as a tiny library of primitives for repo-level tooling.
- Preserve source exports. `packages/dexter/src/**` is the source of truth; do not add a build step or generated source artifacts.
- Keep abstractions small and typed. Use Zod for runtime types and `z.infer` for derived TypeScript types.
- Keep the public API root-only. `@vladpazych/dexter` exports `env`, `files`, `pipe`, `terminal`, and `version`.
- Prefer namespaced objects with optional `.with(...)` binding over classes or framework-style factories.
- Keep repo-local tooling one-way. `scripts/**` may depend on `packages/dexter/**`; `packages/dexter/**` must not depend on repo-local tooling.
- Use Bun tooling.

## Structure

- `package.json` is the root workspace package and should stay a thin orchestrator.
- `packages/dexter/` is the published package.
- `meta/config/` is the shared private config package. It owns workspace ESLint and shared tsconfig presets.
- `scripts/` is the repo-local convention for executable workflow scripts.
- `packages/dexter/src/env/`, `packages/dexter/src/files/`, `packages/dexter/src/pipe/`, and `packages/dexter/src/terminal/` own the public primitive areas.
- `packages/dexter/test/**/*.test.ts` covers package behavior. Keep tests near the subsystem they exercise.
- `eslint.config.ts` should consume `@repo/meta-config/eslint` rather than defining ad hoc rules inline.

## Constraints

- Do not couple core APIs to a specific agent tool, plugin system, or hidden context mechanism.
- Do not add hook systems, governance flows, receipts, or repo-specific policy engines.
- Do not reintroduce runtime/config-discovery concepts like `dexter.config.ts`, package bins, or tool/command frameworks.
- Handle `null` and `undefined` explicitly. Do not use `!`.
- Prefer `unknown` with narrowing over `any`. Use `as` only when the type system cannot express a test fixture or boundary.
- Comment non-obvious intent only.
- Ask permission before changing specs, rewriting expectations, or doing branch history operations.
- Validate package changes with `bun run --cwd packages/dexter typecheck` and targeted `bun test` coverage before handoff.
