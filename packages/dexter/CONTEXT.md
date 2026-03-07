# Dexter Meta CLI

This repo uses dexter for agentic development. Run commands via `./meta/run <command>`.

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

## Conventions

- Commit atomically after each logical change via `./meta/run commit "reason" file1 file2`
- State the problem in commit messages, not the solution. Max 72 chars. No type prefixes.
- Use `--format json|xml|md` for structured output from any command
- Emergency brake: `touch .claude/hooks-disabled` to bypass all hooks
