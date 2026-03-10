# @vladpazych/dexter

Dexter is the shared authoring package for self-describing repo CLIs. It gives a repo a typed `dexter.config.ts` and a small set of reusable primitives for env loading, subprocess work, spec resolution, and skill sync.

## Quick Start

Install the core package, a runtime package, and Zod:

```sh
bun add -D @vladpazych/dexter @vladpazych/dexter-bun zod
```

Or for a Node-driven repo:

```sh
npm install -D @vladpazych/dexter @vladpazych/dexter-node zod
```

Create `dexter.config.ts` in your repo root:

```ts
import { command, defineConfig } from "@vladpazych/dexter/cli"
import { z } from "zod"

export default defineConfig({
  commands: {
    greet: command()
      .description("Print a greeting.")
      .args({
        name: "target",
        description: "Who to greet.",
        schema: z.string(),
      })
      .options({
        loud: {
          description: "Uppercase the greeting.",
          schema: z.boolean().optional(),
        },
      })
      .run(({ args, options }) => {
        const prefix = options.loud ? "HELLO" : "hello"
        return `${prefix} ${args.target}`
      })
      .build(),
  },
})
```

Run the installed CLI from the runtime package:

```sh
dexter help
dexter greet world
dexter greet world --loud
dexter greet world --json
```

Supported root config filenames:

- `dexter.config.ts`
- `dexter.config.js`
- `dexter.config.mts`
- `dexter.config.mjs`

## Runtime Packages

- `@vladpazych/dexter-bun`
  Installs the `dexter` CLI for Bun repos.
- `@vladpazych/dexter-node`
  Installs the `dexter` CLI for Node repos. This runtime is currently experimental.

Install exactly one runtime package per repo. `@vladpazych/dexter` itself no longer installs the `dexter` binary.

## Concepts

Dexter keeps the command surface in normal TypeScript source.

- A leaf command declares `description`, `args`, `options`, and `run`.
- A namespace declares `description` and nested `commands`.
- The runtime handles parsing, help output, validation, and CLI or JSON rendering.
- `ctx.loadEnv()` lets a command load and validate env only when it needs it.

Dexter is for repo-local tooling. It is not a task runner, plugin host, or application framework.

## Subpath Exports

- `@vladpazych/dexter/cli`
  Command authoring, execution, and repo-aware helper types.
- `@vladpazych/dexter/env`
  Env loading and validation primitives such as `loadEnv`, `defineConfig`, and formatted config output helpers.
- `@vladpazych/dexter/pipe`
  Subprocess and pipe utilities for command implementations.
- `@vladpazych/dexter/terminal`
  ANSI color helpers for human-facing terminal output.
- `@vladpazych/dexter/spec`
  Config-driven spec file resolution via `resolveSpecFiles(...)`.
- `@vladpazych/dexter/skills`
  GitHub-backed skill sync via `syncSkill(...)`.

## Example Patterns

Load command-scoped env:

```ts
run(_input, ctx) {
  const config = ctx.loadEnv("coolify", {
    apiUrl: {
      env: "COOLIFY_API_URL",
    },
    token: {
      env: "COOLIFY_TOKEN",
      sensitive: true,
    },
  })

  return { apiUrl: config.apiUrl }
}
```

Resolve spec files around a directory:

```ts
import { createRepoPorts, findRepoRoot } from "@vladpazych/dexter/cli"
import { resolveSpecFiles } from "@vladpazych/dexter/spec"

const root = findRepoRoot()
const ports = createRepoPorts(root)

const result = resolveSpecFiles(ports, "apps/web/src", [
  {
    name: "agents",
    include: "AGENTS.md",
    walk: "up",
  },
])
```

Plan a remote skill sync:

```ts
import { syncSkill } from "@vladpazych/dexter/skills"

const result = await syncSkill({
  source: {
    kind: "github",
    url: "https://github.com/acme/skills/tree/main/release",
  },
  targetDir: ".agents/skills/release",
})
```

## Development

For repo-level context, start at the [root README](../../README.md). For package work inside this monorepo, the main local checks are:

```sh
bun run typecheck
bun test
```
