# @vladpazych/dexter

Dexter is a tiny library of primitives for repo-level tooling.

## Install

```sh
bun add -D @vladpazych/dexter

# Install the dexter skill for Codex in the current project
npx skills add vladpazych/dexter --yes --agent codex --skill dexter

# Install the dexter skill for Claude Code in the current project
npx skills add vladpazych/dexter --yes --agent claude-code --skill dexter
```

## API

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

// env
env.load(schema, options?)
env.inspect(schema, options?)
env.apply(values)
env.parseFile(path)
env.read(root)
env.format(config, name?)
env.print(config, name?)
env.with({ root?, env? })

// files
files.collect(query)
files.find(query)
files.with({ root? })

// pipe
pipe.spawn(options)
pipe.exec(options)
pipe.with({ cwd?, env?, width? })

// logs
logs.run(options)
logs.withRun(options, task)
logs.with({ cwd?, root?, console?, files? })

// terminal
terminal.colors
terminal.stripAnsi(text)
terminal.with({ color? })
```

Wire local scripts through `package.json` and import from the package root only.

## Development

```sh
bun run typecheck
bun test
```
