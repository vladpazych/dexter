# Dexter Authoring

## Entry contract

- Root config file: `dexter.config.ts`
- Supported alternatives: `dexter.config.js`, `dexter.config.mts`, `dexter.config.mjs`
- Public import for command authoring: `@vladpazych/dexter/cli`
- Ordinary implementation files can live anywhere in the repo. `meta/commands/*.ts` is a convention, not a runtime contract.

## Minimal shape

```ts
import { command, defineConfig } from "@vladpazych/dexter/cli"
import { z } from "zod"

export default defineConfig({
  commands: {
    db: {
      description: "Database utilities.",
      commands: {
        migrate: command({
          description: "Run migrations.",
          args: [{ name: "target", description: "Migration target.", schema: z.string() }] as const,
          options: {
            dryRun: {
              description: "Preview without applying.",
              schema: z.boolean().optional(),
            },
          },
          run(input, ctx) {
            return {
              root: ctx.root,
              target: input.args.target,
              dryRun: input.options.dryRun ?? false,
            }
          },
        }),
      },
    },
  },
})
```

## Command model

- Leaf commands are created with `command(...)`.
- Namespaces are plain objects with `description` and nested `commands`.
- Top-level help shows only top-level commands and namespaces.
- Namespace help is available through `dexter help db` and `dexter db --help`.

## Input and output

- Use Zod for all args and options.
- Dexter handles parsing, `--help`, `--json`, and `--format`.
- If `run()` returns a string, Dexter prints it directly in CLI mode.
- If `run()` returns an object and there is no `renderCli()`, Dexter prints pretty JSON in CLI mode.
- Use `renderCli()` only when you need custom human-readable output.

## Env loading

- Use `ctx.loadEnv()` inside commands.
- `ctx.loadEnv()` reads from `process.env`, `.env`, and `.env.local`.
- Sensitive fields are masked automatically in Dexter output.
- In JSON mode, env load reporting is included under `meta.env`.
- Dexter runtime implicitly applies only `META_*` variables before loading `dexter.config.*`.

Example:

```ts
const env = ctx.loadEnv("deploy", {
  coolifyUrl: {
    env: "COOLIFY_URL",
    type: "url",
    required: true,
  },
  coolifySecret: {
    env: "COOLIFY_SECRET",
    required: true,
    sensitive: true,
  },
})
```

## Other subpaths

- `@vladpazych/dexter/env`: env parsing, validation, and config helpers outside command runtime use.
- `@vladpazych/dexter/pipe`: subprocess and log piping helpers.
- `@vladpazych/dexter/terminal`: ANSI/color helpers.

## Good references in this repo

- `packages/dexter/README.md`: current public contract and examples
- `packages/dexter/test/meta/cli.test.ts`: namespaces, help, `ctx.loadEnv()`, render behavior
- `packages/dexter/test/cli.test.ts`: root config filenames, config discovery, runtime bootstrap
