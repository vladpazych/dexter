# Hooks

## Hook events

All Claude Code hook events are wired by the dexter plugin and extensible via `createCLI()`.

### Core hooks (have built-in logic + extension point)

| Event | Command | Core behavior | Extension |
|:------|:--------|:--------------|:----------|
| SessionStart | on-session-start | Injects CONTEXT.md | `"session-start": (input) => { additionalContext }` |
| PreToolUse (Bash) | on-pre-bash | Denies dangerous git commands | `"pre-bash": { deny: DenyPattern[] }` |
| PostToolUse (Write\|Edit) | on-post-write | ESLint, spec link validation, commit reminder | `"post-write": (input) => { additionalContext }` |
| PostToolUse (Read) | on-post-read | Spec link validation, markdown skill hints | `"post-read": (input) => { additionalContext }` |

### Extension-only hooks (no core logic, pure consumer callback)

| Event | Command | Extension key |
|:------|:--------|:--------------|
| PostToolUse (Bash) | on-post-bash | `"post-bash"` |
| Stop | on-stop | `"stop"` |
| Notification | on-notification | `"notification"` |
| SubagentStart | on-subagent-start | `"subagent-start"` |
| SubagentStop | on-subagent-stop | `"subagent-stop"` |
| SessionEnd | on-session-end | `"session-end"` |
| PromptSubmit | on-prompt-submit | `"prompt-submit"` |
| PreCompact | on-pre-compact | `"pre-compact"` |
| ToolError | on-tool-failure | `"tool-failure"` |
| PermissionRequest | on-permission-request | `"permission-request"` |

## Handler signature

All extension hooks (except `pre-bash`) share the same type:

```ts
type HookHandler = (input: HookInput | null) => HookOutput | Promise<HookOutput>

type HookInput = {
  session_id?: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_output?: unknown
}

type HookOutput = { additionalContext?: string } | void
```

## Pre-bash deny patterns

The `pre-bash` hook uses a different extension model — you provide deny patterns that are merged with core patterns:

```ts
"pre-bash": {
  deny: [
    { pattern: /^rm\s+-rf/, hint: "Use explicit file removal instead." },
    { pattern: /^docker\s+system\s+prune/, hint: "Don't prune Docker in CI." },
  ],
}
```

Core deny patterns (always active):
- `git add` → Use /commit skill
- `git commit` → Use /commit skill
- `git push --force` → Use revert instead
- `git reset --hard` → Use revert instead
- `git clean -f` → Remove files explicitly
- `git checkout .` → Be explicit about files

## Output protocol

Hook handlers communicate with Claude Code via JSON on stdout:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Context injected into Claude's conversation"
  }
}
```

For pre-bash deny:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Reason shown to Claude"
  }
}
```

## Debugging hooks

Test any hook manually by piping JSON to `bun run meta/index.ts`:

```sh
# Test pre-bash with a command that should be denied
echo '{"tool_name":"Bash","tool_input":{"command":"git push --force"}}' | bun run meta/index.ts on-pre-bash

# Test post-write with a file path
echo '{"tool_name":"Write","tool_input":{"file_path":"src/index.ts"}}' | bun run meta/index.ts on-post-write

# Test session start
echo '{}' | bun run meta/index.ts on-session-start

# Test extension-only hooks
echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | bun run meta/index.ts on-post-bash
```

If a hook crashes, Claude gets blocked. Use the emergency brake:

```sh
touch .claude/hooks-disabled   # createCLI exits 0 before any hook runs
# fix the issue
rm .claude/hooks-disabled
```
