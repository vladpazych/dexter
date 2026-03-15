# @vladpazych/dexter

Dexter is a tiny library of primitives for repo-level tooling.

It exports one root API:

```ts
import { env, files, pipe, terminal } from "@vladpazych/dexter"
```

Dexter does not provide a CLI runtime, config loader, or command framework. Use normal local scripts and expose them through `package.json`.

## Quick Start

Install Dexter and Zod:

```sh
bun add -D @vladpazych/dexter zod
```

Create a local repo script:

```ts
import { env, files, pipe, terminal } from "@vladpazych/dexter"

const config = env.with({ root: process.cwd() }).load({
  apiUrl: {
    env: "API_URL",
    type: "url",
    required: true,
  },
})

const agents = files.collect({
  from: "packages/dexter/src",
  include: "AGENTS.md",
  walk: "up",
})

await pipe.run({
  name: "check",
  cmd: "git",
  args: ["status", "--short"],
})

console.log(terminal.colors.green(`API: ${config.apiUrl}`))
console.log(agents.map((match) => match.relPath).join("\n"))
```

Wire it into `package.json`:

```json
{
  "scripts": {
    "check-repo": "bun run scripts/check-repo.ts"
  }
}
```

## API

### `env`

- `env.load(schema, options?)`
- `env.inspect(schema, options?)`
- `env.apply(values)`
- `env.parseFile(path)`
- `env.read(root)`
- `env.format(config, name?)`
- `env.print(config, name?)`
- `env.with({ root?, env? })`

Use `env.load(...)` when you want typed config and exceptions on invalid values. Use `env.inspect(...)` when you also need source metadata for printing or reporting.

### `pipe`

- `pipe.spawn(options)`
- `pipe.run(options)`
- `pipe.with({ cwd?, env?, width? })`

`pipe` keeps the existing structured-log behavior for repo scripts that need readable terminal output plus a log file.

### `files`

- `files.collect(query)`
- `files.find(query)`
- `files.with({ root? })`

`files` replaces the old spec resolver with a generic file accumulator around a target path.

Query fields:

- `from`
- `include`
- `exclude`
- `walk`
- `base`
- `includeBase`
- `maxDepth`
- `stopAt`
- `order`
- `pick`

### `terminal`

- `terminal.colors`
- `terminal.stripAnsi(text)`
- `terminal.with({ color? })`

## Development

For package work inside this repo:

```sh
bun run typecheck
bun test
```
