# @vladpazych/dexter

Runtime for self-describing repo commands in Bun monorepos.

`dexter` is for repos that want a real internal tooling surface:

- `dexter.config.ts` as the composition root
- `dexter <command...>` as the runtime contract
- typed command definitions with built-in help and validation
- repo-aware execution context and helpers

It is not just an argument parser.

## Install

```sh
bun add @vladpazych/dexter zod
```

## What It Is

- A runtime for repo-local commands
- A typed command definition API
- A clean way to build repo-local CLIs with shared repo context
- A small Bun-native toolkit with repo/process/fs/git/workspace helpers

## What It Is Not

- Not a replacement for `commander` on its own
- Not a task runner
- Not a general application framework
- Not an agent-governance or spec-enforcement system
- Not a multi-renderer output framework

`commander` handles parsing. `dexter` handles repo-local command authoring and execution.

## Quick Start

Create `dexter.config.ts` in your repo root:

```ts
import { command, defineConfig } from "@vladpazych/dexter/cli"
import { z } from "zod"

export default defineConfig({
  commands: {
    db: {
      description: "Database utilities.",
      commands: {
        greet: command({
          description: "Print a greeting for a named target.",
          args: [
            {
              name: "target",
              description: "Who to greet.",
              schema: z.string(),
            },
          ] as const,
          options: {
            loud: {
              description: "Uppercase the greeting.",
              schema: z.boolean().optional(),
            },
          },
          run(input, ctx) {
            const prefix = input.options.loud ? "HELLO" : "hello"
            return {
              message: `${prefix} ${input.args.target}`,
              root: ctx.root,
            }
          },
          renderCli(result) {
            return `${result.message} (${result.root})`
          },
        }),
      },
    },
  },
})
```

Supported root config filenames:

- `dexter.config.ts`
- `dexter.config.js`
- `dexter.config.mts`
- `dexter.config.mjs`

Keep `meta/` for ordinary implementation files such as `meta/commands/*.ts`. It is not a magic entrypoint.

In this repo, `meta/config/` and `meta/commands/` are private workspace packages used by the root `dexter.config.ts`.

Run it with the installed runtime:

```sh
dexter help
dexter db --help
dexter db greet world
dexter db greet world --loud
dexter db greet world --json
```

## Command Model

Each leaf command declares:

- `description`
- positional `args`
- named `options`
- `run(input, ctx)`
- optional `renderCli(result, ctx)`

Namespaces declare:

- `description`
- nested `commands`

The runtime handles:

- `dexter help`
- `dexter help <command...>`
- `dexter <command...> --help`
- argv parsing
- Zod validation
- CLI or JSON output

Commands also receive `ctx.loadEnv()` for explicit command-scoped env loading from `process.env`, `.env`, and `.env.local`.
Loaded values are reflected in command output, and sensitive fields are masked.

## CLI Output

`dexter` keeps output simple:

- default mode is human-readable CLI output
- `--json` prints the raw command result as JSON

If `renderCli()` is present, it controls CLI output.
Otherwise strings print directly and objects fall back to pretty JSON.

## Runtime Env Loading

Dexter runtime bootstrap is intentionally narrow:

- before loading `dexter.config.*`, dexter reads `.env` and `.env.local`
- only variables with the `META_` prefix are applied implicitly
- normal command env like `COOLIFY_SECRET` should be loaded explicitly inside commands via `ctx.loadEnv()`

## Subpath Exports

| Import                         | Purpose                                  |
| :----------------------------- | :--------------------------------------- |
| `@vladpazych/dexter/cli`      | Command runtime, repo helpers, runtime types |
| `@vladpazych/dexter/env`      | Env file loading and validation helpers  |
| `@vladpazych/dexter/pipe`     | Subprocess and pipe utilities            |
| `@vladpazych/dexter/skills`   | GitHub-backed skill sync primitives      |
| `@vladpazych/dexter/spec`     | Config-driven spec file resolution       |
| `@vladpazych/dexter/terminal` | ANSI color helpers                       |

## Requirements

- [Bun](https://bun.sh)
- TypeScript source exports, no build step
