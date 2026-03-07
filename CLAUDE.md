# CLAUDE.md

Agentic development toolkit. Install in any repo to get quality-gated commits, Claude Code hook framework, CLI primitives, and convention enforcement.

Published as `@vladpazych/dexter`.

## Rules

- Produce elegant solutions, write clean elegant code: maximum expressive power from minimum structural complexity
- Zod schemas define runtime types. `z.infer` derives TypeScript types
- `unknown` with type guards, not `any`. Explicit null handling, not `!`. `as` only in test fixtures
- Typed errors `{ code, context }`, not strings
- Comment non-obvious intent only
- Tests verify CLAUDE.md compliance. `.test.ts` files, co-located or in `test/`
- Bun runtime. Never npm, pnpm, yarn, or node
- Exports point to source — no build step, no barrel files. Each `package.json` maps subpaths directly to source
- Spec cascade: child inherits parent, adds more specific constraints. Deepest CLAUDE.md takes priority
- When implementation would violate spec: stop, propose change, get approval, update spec, implement
- Ask permission before branch, merge, rebase, push, modify test expectations, change specs

### Commits

- Commit atomically after each logical change
- In message state the problem, not the solution
- Max 72 chars. No type prefixes
- `git revert` for undo. Never reset, amend, or force-push

## Structure

| Dir       | Purpose                              |
| :-------- | :----------------------------------- |
| packages/ | Published packages                   |
| meta/     | Repo tooling (hooks, CLI, dev tasks) |

### packages/dexter

The main package. Provides:

- **DX primitives**: env loading, structured output (polymorphic Node trees), pipe utilities, terminal helpers
- **Meta framework**: `createCLI()` factory for per-repo hook extensions and custom commands. Domain commands (commit, rules, diff, lint, typecheck, test, blame, pickaxe, bisect, eval). Hook protocol handlers with extension points. Quality gates. Constraint system. Workspace discovery.
- **Claude management**: `.claude/` folder scaffolding, settings.json management, hook wiring

Consumer repos install `@vladpazych/dexter` and create a `meta/` directory with a composition root:

```ts
import { createCLI } from "@vladpazych/dexter/meta"

await createCLI({
  commands: { dev: (args) => import("./commands/dev.js").then(m => m.run(args)) },
  hooks: { "post-read": (input, ctx) => { /* project-specific */ } },
}).run()
```

Dependencies point inward: consumer meta/ -> dexter. Never the reverse.

## Gotchas

- Emergency brake: `touch .claude/hooks-disabled`. Remove immediately after fix.
