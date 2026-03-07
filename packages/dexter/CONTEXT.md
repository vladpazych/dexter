# Dexter Meta CLI

This repo uses dexter for agentic development. Run commands via `bun run meta/index.ts <command>`.

## Commands

| Command | Purpose |
|:--------|:--------|
| `commit "msg" files...` | Quality-gated atomic commit |
| `rules [scopes...]` | CLAUDE.md cascade for scopes |
| `diff [scopes...]` | Git status + diff for scopes |
| `commits [scopes...]` | Recent commit history |
| `lint [--changed] [scopes...]` | ESLint across workspace |
| `typecheck [scopes...]` | TypeScript checking |
| `test [args...]` | Run tests |
| `blame <file> [start:end]` | Structured git blame |
| `pickaxe <pattern> [--regex]` | Find commits that changed a pattern |
| `bisect <cmd> --good <ref>` | Binary search for bad commit |
| `eval <code>` | Sandboxed TypeScript REPL |
| `transcripts [--skill name]` | List subagent transcripts |
| `packages` | List workspace packages |
| `setup` | Configure .claude/settings |

## Custom commands

Repos can extend with project-specific commands in `meta/index.ts` via `createCLI({ commands: { ... } })`. Custom commands receive `(args, ctx)` where `ctx` provides:

- `ctx.root` — repo root path
- `ctx.service` — ControlService (commit, lint, typecheck, test, diff, rules, blame, pickaxe, bisect, eval)
- `ctx.mode` — active output format (`cli` | `json` | `xml` | `md`)
- `ctx.render(node)` — render a Node tree in the active format

Output primitives (`block`, `field`, `list`, `text`, `heading`) are available from `@vladpazych/dexter/meta`.

## Conventions

- Commit atomically after each logical change via `bun run meta/index.ts commit "reason" file1 file2`
- State the problem in commit messages, not the solution. Max 72 chars. No type prefixes.
- Use `--format json|xml|md` for structured output from any command
- Emergency brake: `touch .claude/hooks-disabled` to bypass all hooks
