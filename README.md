# @vladpazych/dexter

Dexter is a tiny library of primitives for repo-level tooling.

It exports one root API:

```ts
import { env, files, logs, pipe, terminal } from "@vladpazych/dexter"
```

Dexter does not provide a CLI runtime, config loader, or command framework. Use normal local scripts and expose them through `package.json`.

## Quick Start

Install Dexter:

```sh
bun add -D @vladpazych/dexter
```

Create a local repo script:

```ts
import { env, files, logs, pipe, terminal } from "@vladpazych/dexter"

const config = env.with({ root: process.cwd() }).load({
  apiUrl: {
    env: "API_URL",
    type: "url",
    required: true,
  },
})

const agents = files.collect({
  from: "src",
  include: "AGENTS.md",
  walk: "up",
})

await pipe.exec({
  source: "check",
  cmd: "git",
  args: ["status", "--short"],
})

await logs.withRun(
  {
    name: "binary",
    console: false,
  },
  async (run) => {
    const build = run.step("build")
    build.info("Starting build", { target: "linux-x64" })

    await build.exec({
      cmd: "bun",
      args: ["run", "build"],
      source: "vite",
    })
  },
)

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

### `pipe`

- `pipe.spawn(options)`
- `pipe.exec(options)`
- `pipe.with({ cwd?, env?, width? })`

`pipe` owns child process capture and execution. It emits typed line events and can route them into a sink.

### `logs`

- `logs.run(options)`
- `logs.withRun(options, task)`
- `logs.with({ cwd?, root?, console?, files? })`

`logs` manages run-scoped logging, steps, terminal formatting, and file outputs such as `run.json`, `events.ndjson`, `run.log`, and per-step logs.

### `files`

- `files.collect(query)`
- `files.find(query)`
- `files.with({ root? })`

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

`terminal` stays a small ANSI/color helper. Log presentation lives behind `logs`.

## Development

```sh
bun run typecheck
bun test
```
