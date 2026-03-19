---
name: rig
description: Use when a user wants to build or modify repo-level tooling with Rig primitives, write local repo scripts, or consume the root `@vladpazych/rig` API correctly.
---

# Rig

Use this skill when working in a consumer repo that uses Rig as a small primitive library, not a command framework or runtime host.

## Default shape

- Start from the current public contract in `README.md`.
- Write normal local entrypoints under `scripts/*.mjs` or under the repo's existing compiled TypeScript script path.
- Expose repo-local scripts through `package.json`.
- Import from the root package only: `@vladpazych/rig`.

## Default import

```ts
import { env, files, logger, process, terminal } from "@vladpazych/rig"
```

## Primitive patterns

- Prefer the namespaced objects: `env`, `files`, `logger`, `process`, and `terminal`.
- Use `.with(...)` to bind shared context like `root`, `cwd`, `env`, or terminal color settings.
- Use small explicit schema objects with `env.load(...)` or `env.inspect(...)`.
- Use `files.find(...)` and `files.collect(...)` for validated file discovery around a target path.
- Use `process.run(...)` and `process.spawn(...)` for child-process capture.
- Use `logger.with(...)` with explicit sinks for structured logging.
- Use `terminal` only for generic ANSI/color helpers outside sink implementations.

## Typical script

```ts
import { env, files, logger, process, terminal } from "@vladpazych/rig"

const config = env.with({ env: process.env }).load({
  apiUrl: {
    env: "API_URL",
    type: "url",
    required: true,
  },
})

const match = files.find({
  from: "src",
  include: "AGENTS.md",
  walk: "up",
})

const status = await process.run({
  cmd: "git",
  args: ["status", "--short"],
})

const log = logger.with({
  name: "release",
})

log.info("Checked repo", { lines: status.stdout.length })

console.log(terminal.colors.green(config.apiUrl))
console.log(match?.relPath ?? "no match")
console.log(status.stdout)
```

## Rules

- Default to local script entrypoints instead of package bins or tool-specific runtimes.
- Default to `import { env, files, logger, process, terminal } from "@vladpazych/rig"`.
- Keep the public API root-only. Do not import from private subpaths.
- Do not introduce `rig.config.ts`, command trees, runtime hosts, hidden context systems, or framework-style factories.
- Keep abstractions small and typed. Prefer explicit local validators and narrow `unknown` values instead of `any`.
- Handle `null` and `undefined` explicitly.
- Prefer explicit logger sinks over hard-coded console conventions.
- Prefer bare `process` only when a script needs direct process capture or custom sink wiring.
