Rig is an npm workspace for small published packages of repo CLI tooling primitives. Optimize for a stable root-only API, small typed abstractions, and thin release tooling.

## Rules

- Keep the public runtime API root-only. `@vladpazych/rig` exports `env`, `files`, `logger`, `process`, `terminal`, and `version`. Root-level logger types may also be exported for TypeScript consumers.
- Preserve source-first development. `packages/*/src/**` is the source of truth and packages publish built `dist/**` artifacts from that source.
- Prefer namespaced objects with optional `.with(...)` binding over classes or framework-style factories.
- Keep abstractions small and typed. Prefer explicit TypeScript types, narrow `unknown`, and small local validators.
- Keep repo-local tooling one-way. Root tooling may depend on package source; package source must not depend on repo-local tooling.
- Treat Node as the supported runtime unless the support matrix is expanded deliberately.
- Add a changeset for package-facing changes unless the work is docs-only or internal-only.
- Use Conventional Commits: `<type>(<scope>): <message>` or `<type>: <message>`.
- Ask permission before changing specs, rewriting expectations, or doing branch history operations.

## Structure

- The root `package.json` is the private workspace manifest and owns the canonical repo scripts.
- `packages/rig/package.json` is the published package manifest.
- `packages/rig-logger-sinks/package.json` is the published companion package manifest.
- `packages/rig/src/env/`, `packages/rig/src/files/`, `packages/rig/src/logger/`, `packages/rig/src/process/`, and `packages/rig/src/terminal/` own the core primitive areas.
- `packages/rig-logger-sinks/src/**` owns standard sink implementations for the core logger contract.
- `packages/*/dist/**` is generated publish output. Do not edit it by hand.
- `packages/rig/test/**/*.test.ts` covers package behavior.
- `.changeset/*.md` files are release intent. Package `CHANGELOG.md` files are maintained by Changesets.
- `.github/workflows/ci.yml` enforces validation and changeset presence. `.github/workflows/publish.yml` owns release automation.

## Verification

- Validate package changes with `npm run release:check` before handoff.
- Use Node/npm tooling and the root workspace scripts.

## Gotchas

- Do not couple core APIs to a specific agent tool, plugin system, or hidden context mechanism.
- Do not add runtime/config-discovery concepts, package bins, or tool-command frameworks.
- Handle `null` and `undefined` explicitly. Do not use `!`.
- Prefer `unknown` with narrowing over `any`. Use `as` only when the type system cannot express a fixture or boundary.
- Comment non-obvious intent only.
