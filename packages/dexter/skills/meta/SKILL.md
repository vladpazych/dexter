---
name: meta
description: "Set up and extend the dexter meta framework. Create meta/run, meta/index.ts, custom commands, hook extensions. Triggers: /meta, meta setup, scaffold meta, add command, add hook. NOT: direct code changes, test fixes."
argument-hint: "[init|add-command|add-hook]"
---

# Meta Framework

Bootstrap and extend the dexter meta CLI in a consumer repo.

## Architecture

Plugin hooks fire on Claude Code events (PreToolUse, PostToolUse, Stop) and delegate to `$CLAUDE_PROJECT_DIR/meta/run on-<event>`. The `meta/run` shell wrapper calls `meta/index.ts` via Bun, which uses `createCLI()` to dispatch to core handlers and consumer extensions.

```
Claude Code event → plugin hook → meta/run → createCLI().run() → handler
```

## Init — scaffold a new repo

1. Create `meta/run`:

```sh
#!/bin/sh
DIR="$(cd "${0%/*}" 2>/dev/null && pwd)"
ROOT="${CLAUDE_PROJECT_DIR:-${DIR%/meta}}"
export PATH="$HOME/.bun/bin:$PATH"
case "$1" in
  on-*)
    [ -f "$ROOT/.claude/hooks-disabled" ] && exit 0
    ;;
esac
exec bun run "$ROOT/meta/index.ts" "$@"
```

2. Make executable: `chmod +x meta/run`

3. Create `meta/index.ts`:

```ts
import { createCLI } from "@vladpazych/dexter/meta"

await createCLI({
  commands: {},
  hooks: {},
}).run()
```

4. Create `meta/package.json`:

```json
{
  "name": "meta",
  "private": true,
  "type": "module",
  "dependencies": {
    "@vladpazych/dexter": "latest"
  }
}
```

5. Run `bun install` in `meta/`.

6. Add `Bash(./meta/run:*)` to `.claude/settings.json` permissions.

## Add command

Extend `createCLI()` with a new command:

```ts
await createCLI({
  commands: {
    "command-name": async (args, ctx) => {
      // args: string[] — positional arguments after command name
      // ctx.root: string — repo root path
      // ctx.service: ControlService — dexter domain service
    },
  },
}).run()
```

Run via `./meta/run command-name [args]`.

## Add hook extension

Extend built-in hooks with project-specific behavior:

```ts
await createCLI({
  hooks: {
    "pre-bash": {
      deny: [
        { pattern: /dangerous-command/, hint: "Use safe-alternative instead" },
      ],
    },
    "post-read": (input, ctx) => {
      // Return { additionalContext: "..." } to inject context into Claude's conversation
    },
    "post-write": (input, ctx) => {
      // Runs after file writes — add project-specific validation
    },
  },
}).run()
```

## Built-in commands

Available via `./meta/run <command>`:

| Command | Purpose |
|:--------|:--------|
| commit | Quality-gated atomic commit |
| rules | CLAUDE.md cascade for scopes |
| diff | Git status + diff for scopes |
| commits | Recent commit history |
| lint | ESLint across workspace |
| typecheck | TypeScript checking |
| test | Run tests |
| blame | Structured git blame |
| pickaxe | Find commits by pattern |
| bisect | Binary search for bad commit |
| eval | Sandboxed TypeScript REPL |
| setup | Configure .claude/settings |
| transcripts | List subagent transcripts |
| packages | List workspace packages |

## Emergency brake

Touch `.claude/hooks-disabled` to bypass all hook handlers. Remove after fixing: `rm .claude/hooks-disabled`.
