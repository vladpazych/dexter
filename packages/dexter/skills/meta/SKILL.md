---
name: meta
description: "Set up and extend the dexter meta framework. Create meta/index.ts, custom commands, hook extensions, output formatting. Triggers: /meta, meta setup, scaffold meta, add command, add hook, how does dexter work, explain meta, hook wiring, output format, emergency brake, debug hooks. NOT: direct code changes, test fixes, markdown authoring."
argument-hint: "[init|add-command|add-hook|explain]"
---

# Meta Framework

Dexter's meta framework gives every repo a programmable CLI at `meta/index.ts`. It handles hook dispatch, quality gates, and domain commands. Consumer repos extend it with project-specific commands and hook callbacks.

## Architecture

```
Claude Code event → hooks.json → bun run meta/index.ts on-<event> → createCLI().run() → core + extension
```

- `hooks.json` in the dexter plugin wires Claude Code events directly to `bun run meta/index.ts`
- `meta/index.ts` is the composition root — calls `createCLI()` with custom commands and hooks
- `createCLI()` dispatches to core handlers first, then runs consumer extensions

See `references/architecture.md` for the full flow.

## Init — scaffold a new repo

1. Add `@vladpazych/dexter` to root `devDependencies`. Run `bun install`.

2. Create `meta/index.ts`:

```ts
import { createCLI } from "@vladpazych/dexter/meta"

await createCLI({
  commands: {},
  hooks: {},
}).run()
```

3. Enable the dexter plugin in `.claude/settings.json`. The plugin provides all hook wiring — do NOT add inline hooks to settings.json (causes double-firing).

That's it. One file: `meta/index.ts`. The dependency lives in root `devDependencies`, and the plugin's `hooks.json` handles PATH setup and bun invocation.

## Add command

```ts
import { block, field, text, type HookContext } from "@vladpazych/dexter/meta"

export async function deploy(args: string[], ctx: HookContext) {
  // ctx.root — repo root
  // ctx.service — commit, lint, typecheck, test, diff, rules, blame, pickaxe, bisect, eval
  // ctx.mode — active output format (cli|json|xml|md)
  // ctx.render(node) — render a Node tree in the active format
  const node = block("deploy", field("env", args[0] ?? "staging"), field("status", text("ok", "green")))
  console.log(ctx.render(node))
}
```

Register in `meta/index.ts`:

```ts
await createCLI({
  commands: {
    deploy: (args, ctx) => import("./commands/deploy.ts").then(m => m.deploy(args, ctx)),
  },
}).run()
```

Run: `bun run meta/index.ts deploy production --json`

See `references/output.md` for the full output primitive API.

## Add hook extension

All Claude Code hook events are extensible. See `references/hooks.md` for the complete list.

```ts
await createCLI({
  hooks: {
    // Merge deny patterns into pre-bash (blocks dangerous commands)
    "pre-bash": {
      deny: [{ pattern: /^docker\s+rm/, hint: "Use docker compose down instead." }],
    },
    // Inject context after file reads
    "post-read": (input) => ({
      additionalContext: "All API endpoints require auth headers.",
    }),
    // React to file writes
    "post-write": (input) => ({
      additionalContext: "Run tests before committing.",
    }),
    // React to session end
    "session-end": (input) => {
      console.error("Session ended")
    },
  },
}).run()
```

## Emergency brake

```sh
touch .claude/hooks-disabled   # bypass all hooks instantly
rm .claude/hooks-disabled      # re-enable after fix
```

`createCLI()` checks this file before dispatching any `on-*` hook. Useful when a hook crashes and blocks Claude.

## Debugging

1. Test hooks manually: `echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | bun run meta/index.ts on-pre-bash`
2. Test commands: `bun run meta/index.ts diff --json`
3. Check plugin wiring: read the plugin's `hooks/hooks.json`
4. If hooks fire twice, remove inline hooks from `.claude/settings.json` — the plugin provides them
5. Verify linking: `ls -la node_modules/@vladpazych/dexter` — should be a symlink for dev
