---
name: dexter
description: Use when a user wants to build or modify repo-level tooling with Dexter primitives, write local `scripts/*.ts`, or consume the root `@vladpazych/dexter` API correctly.
---

# Dexter

Use this skill when working in a consumer repo that uses Dexter as a primitive library, not a CLI runtime.

## Workflow

1. Start from the current public contract in `packages/dexter/README.md`.
2. Write normal local entrypoints under `scripts/` and expose them through `package.json`.
3. Import from the root package: `@vladpazych/dexter`.
4. Prefer the namespaced objects: `env`, `files`, `pipe`, and `terminal`.
5. Use `.with(...)` when a script needs bound context like `root`, `cwd`, `env`, or color settings.
6. Use Zod-friendly schema objects with `env.load(...)` and `env.inspect(...)`.
7. Use `files.collect(...)` and `files.find(...)` for file accumulation around a target path.
8. Use `pipe.spawn(...)` and `pipe.run(...)` for subprocess work.
9. Read `references/authoring.md` when you need examples or feature-level guidance.

## Rules

- Default to local `scripts/*.ts` entrypoints.
- Default to `import { env, files, pipe, terminal } from "@vladpazych/dexter"`.
- Do not introduce `dexter.config.ts`, command trees, runtime hosts, or package bins in consumer repos.
- Keep output simple. Use `terminal` for small presentation helpers, not for UI frameworks.
