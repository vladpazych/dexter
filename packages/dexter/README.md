# @vladpazych/dexter

Agentic development toolkit for Bun monorepos. Powers Claude Code hooks, quality-gated commits, and structured CLI output across projects.

## Install

```sh
bun add @vladpazych/dexter
```

## Subpath exports

| Import                          | Purpose                                           |
| :------------------------------ | :------------------------------------------------ |
| `@vladpazych/dexter/meta`      | `createCLI` factory, hook protocol, domain commands |
| `@vladpazych/dexter/output`    | Polymorphic structured output (CLI, JSON, XML, MD)  |
| `@vladpazych/dexter/env`       | Env file loading, typed config, validation          |
| `@vladpazych/dexter/pipe`      | Subprocess piping, log parsing, formatting          |
| `@vladpazych/dexter/terminal`  | ANSI colors with NO_COLOR support                   |

## Quick start

Create `meta/index.ts` in your repo:

```ts
import { createCLI } from "@vladpazych/dexter/meta"

await createCLI({
  // Custom commands and hook extensions go here
}).run()
```

Enable the dexter plugin in `.claude/settings.json` — it wires all Claude Code hooks automatically:

```json
{
  "enabledPlugins": {
    "dexter@dexter-marketplace": true
  }
}
```

## Built-in commands

```
commit "message" file1 file2   Quality-gated atomic commit
rules <scope>                  CLAUDE.md cascade for scopes
diff <scope>                   Git status + diff
commits <scope>                Recent commit history
lint [scope]                   ESLint across workspace
typecheck [scope]              TypeScript checking
test [scope]                   Run tests
blame <file>                   Structured git blame
pickaxe <pattern>              Find commits by pattern
bisect <test-cmd>              Binary search for bad commit
eval                           Sandboxed TypeScript REPL
packages                       List workspace packages
```

## Requirements

- [Bun](https://bun.sh) runtime — exports point to TypeScript source, no build step
