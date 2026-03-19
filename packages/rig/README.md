# @vladpazych/rig

Rig is a small package of repo CLI tooling primitives for custom scripted workflows. It gives you explicit building blocks for config loading, file discovery, child-process execution, terminal output, and structured logging without turning the repo into a framework.

## Quick Start

```sh
npm install --save-dev @vladpazych/rig
```

```ts
import {
  env,
  files,
  logger,
  process as repoProcess,
  terminal,
} from "@vladpazych/rig"

const config = env
  .with({
    env: {
      API_URL: "https://example.com",
    },
  })
  .load({
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

const status = await repoProcess.run({
  cmd: "git",
  args: ["status", "--short"],
})

const log = logger.with({
  name: "release",
  sinks: [
    {
      write(event) {
        console.log(`${event.level}: ${event.message}`)
      },
    },
  ],
})

log.info("Checked repo", { lines: status.stdout.length })
console.log(terminal.colors.green(config.apiUrl))
console.log(agents.map((match) => match.relPath).join("\n"))
console.log(status.stdout)
```

## Concepts

- Rig is a primitive library, not a command framework.
- The public API is root-only: `env`, `files`, `logger`, `process`, `terminal`, and `version`.
- The package root also exports logger TypeScript types: `LogEvent`, `LogFields`, `LogLevel`, `LogSink`, and `LoggerOptions`.
- `env` works from explicit values. It does not load `.env` files or mutate `process.env`.
- `logger` is runtime-agnostic. Core Rig owns event modeling, filtering, and sink fan-out; runtime-specific sinks live outside the package.
- Use `@vladpazych/rig-logger-sinks` for standard Node console, file, and stream sink implementations.
- `process` is a neutral subprocess wrapper. It captures output and exit state without imposing a logging model.
- `files` is for repo-local discovery around a target path.

## API

Stable root surface:

```ts
env.load(schema, options?)
env.inspect(schema, options?)
env.format(config, name?)
env.print(config, name?)
env.with({ env?, name? })

files.collect(query)
files.find(query)
files.with({ root? })

logger.log(level, message, fields?)
logger.trace(message, fields?)
logger.debug(message, fields?)
logger.info(message, fields?)
logger.warn(message, fields?)
logger.error(message, fields?)
logger.fatal(message, fields?)
logger.with({ name?, level?, fields?, sinks? })

process.spawn(options)
process.run(options)
process.with({ cwd?, env? })

terminal.colors
terminal.stripAnsi(text)
terminal.with({ color? })

version
```

Root TypeScript exports:

```ts
type LogEvent
type LogFields
type LogLevel
type LogSink
type LoggerOptions
```

## Runtime

Rig 1.x is published as ESM JavaScript plus declarations from `dist/`. The supported runtime is Node `>=22.0.0`.

Some primitives rely on filesystem, stream, and child-process APIs. Other runtimes may be able to emulate those APIs, but Node is the only supported runtime in the release matrix.

## Development

```sh
npm run release:check
```
