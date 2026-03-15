---
name: dexter
description: Use when a user wants to build or modify repo-level tooling with Dexter primitives, write local `scripts/*.ts`, or consume the root `@vladpazych/dexter` API correctly.
---

# Dexter

Use this skill when working in a consumer repo that uses Dexter as a small primitive library, not a command framework or runtime host.

## Default shape

- Start from the current public contract in `README.md`.
- Write normal local entrypoints under `scripts/*.ts`.
- Expose repo-local scripts through `package.json`.
- Import from the root package only: `@vladpazych/dexter`.

## Default import

```ts
import { env, files, logs, pipe, terminal } from "@vladpazych/dexter"
```

## Primitive patterns

- Prefer the namespaced objects: `env`, `files`, `logs`, `pipe`, and `terminal`.
- Use `.with(...)` to bind shared context like `root`, `cwd`, `env`, or terminal color settings.
- Use small explicit schema objects with `env.load(...)` or `env.inspect(...)`.
- Use `files.find(...)` and `files.collect(...)` for validated file discovery around a target path.
- Use `pipe.exec(...)` and `pipe.spawn(...)` for child-process capture.
- Use `logs.withRun(...)` for the common scoped workflow and `logs.run(...)` only when a manual lifecycle is required.
- Use `terminal` only for generic ANSI/color helpers outside the logging flow.

## Typical script

```ts
import { env, files, logs, pipe, terminal } from "@vladpazych/dexter"

const config = env.with({ root: process.cwd() }).load({
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

await pipe.exec({
  source: "status",
  cmd: "git",
  args: ["status", "--short"],
})

await logs.withRun(
  {
    name: "release",
    console: false,
  },
  async (run) => {
    const build = run.step("build")
    await build.exec({
      cmd: "bun",
      args: ["run", "build"],
      source: "vite",
    })
  },
)

console.log(terminal.colors.green(config.apiUrl))
console.log(match?.relPath ?? "no match")
```

## Rules

- Default to local `scripts/*.ts` entrypoints instead of package bins or tool-specific runtimes.
- Default to `import { env, files, logs, pipe, terminal } from "@vladpazych/dexter"`.
- Keep the public API root-only. Do not import from private subpaths.
- Do not introduce `dexter.config.ts`, command trees, runtime hosts, hidden context systems, or framework-style factories.
- Keep abstractions small and typed. Prefer explicit local validators and narrow `unknown` values instead of `any`.
- Handle `null` and `undefined` explicitly.
- Prefer `logs.withRun(...)` and `run.step(...)` for structured repo-tooling workflows.
- Prefer bare `pipe` only when a script needs direct process capture or custom sink wiring.
