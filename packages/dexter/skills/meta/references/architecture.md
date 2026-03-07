# Architecture

## What is meta?

Every repo that uses dexter has a `meta/` directory at its root. This is the repo's private CLI — a composition root where project-specific commands and hook extensions are wired on top of dexter's core framework.

The name "meta" means tooling about the repo itself: commit workflows, quality gates, code analysis, hook callbacks. It is not application code — it is development infrastructure.

## Directory layout (consumer repo)

```
my-repo/
├── .claude/
│   └── settings.json        ← permissions, plugin enablement
├── meta/
│   ├── index.ts              ← composition root (createCLI)
│   ├── package.json          ← depends on @vladpazych/dexter
│   └── commands/             ← project-specific commands
├── packages/                 ← application code
├── CLAUDE.md
└── package.json              ← workspace root
```

## Execution flow

### Hook dispatch

```
1. Claude Code fires event (e.g., PostToolUse for Write)
2. Plugin hooks.json maps event → bun run $CLAUDE_PROJECT_DIR/meta/index.ts on-post-write
3. createCLI().run() checks emergency brake (.claude/hooks-disabled)
4. Reads stdin (hook input JSON)
5. Core handler runs (e.g., ESLint check, spec link validation)
6. Consumer extension runs (if configured in hooks config)
7. Combined additionalContext output as JSON to stdout
8. Claude Code receives context and injects into conversation
```

### Command dispatch

```
1. User or Claude runs: bun run meta/index.ts diff --json packages/api
2. createCLI().run() parses format flags (--json → mode: "json")
3. Checks custom commands first (consumer overrides)
4. Falls through to built-in domain commands
5. Builds Node tree → renders in requested format → stdout
```

## Plugin vs inline hooks

The dexter Claude plugin ships `hooks/hooks.json` which wires all supported events to `bun run meta/index.ts`. The plugin handles PATH setup for bun. When the plugin is enabled in `.claude/settings.json`, no inline hook configuration is needed.

If a repo has both plugin hooks AND inline hooks in settings.json for the same events, hooks fire twice. Remove inline hooks from settings.json when using the plugin.

## Dependency direction

```
consumer meta/ → @vladpazych/dexter/meta    (consumer depends on dexter)
                                             (never the reverse)
```

The `meta/` workspace has its own `package.json` with dexter as a dependency. Application packages never import from `meta/`. The meta directory is a leaf in the dependency graph.
