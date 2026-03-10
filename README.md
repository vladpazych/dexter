# Dexter

Typed repo commands for LLM-driven codebases.

```ts
import { command, defineConfig } from "@vladpazych/dexter/cli"
import { z } from "zod"

const greet = command()
  .description("Print a greeting.")
  .args({
    name: "target",
    description: "Who to greet.",
    schema: z.string(),
  })
  .run(({ args }) => `hello ${args.target}`)
  .build()

export default defineConfig({
  commands: {
    greet,
    syncSkills,
    resolveSpecs,
    typecheckChanged,
    testChanged,
    publishPackage,
    envDoctor,
  },
})
```

```sh
dexter help
dexter greet world
dexter sync-skills
dexter resolve-specs packages/dexter/src
```

## What It Is

- A typed internal CLI for repos that humans and agents both operate
- A way to turn repo workflows into explicit commands instead of scripts and prompt lore
- A small set of primitives for env loading, subprocess work, spec resolution, and skill sync

## Who It’s For

- LLM-heavy repos that need discoverable, inspectable workflows
- Monorepos with too much logic hiding in `package.json`, shell scripts, or tribal knowledge
- Teams that want agents to use the same command surface as humans

## Start Here

- Use Dexter in your own repo: [packages/dexter/README.md](packages/dexter/README.md)
- See how this repo uses it: [dexter.config.ts](dexter.config.ts) and [meta/commands](meta/commands)
- Read the published source: [packages/dexter/src](packages/dexter/src)
