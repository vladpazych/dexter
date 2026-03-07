# Skills & Agents

Two extension mechanisms that compose.

## Skills (`.claude/skills/`)

SKILL.md body = task sent to the subagent. User-invokable via `/name`.

### Frontmatter

| Field | Required | Values |
|:------|:---------|:-------|
| description | yes | What it does + triggers + exclusions. ~100 words budget, always in context. |
| model | no | sonnet, haiku, opus. Default: inherit from parent. |
| context | no | `fork` = isolated subagent, no conversation history. Omit = inline, full history. |
| agent | no | Subagent type when `context: fork` set. Built-in (`Explore`, `Plan`, `general-purpose`) or custom from `.claude/agents/`. Default: `general-purpose`. |
| allowed-tools | no | Auto-permit listed tools (skips permission prompts). Does NOT restrict — subagent can still use other tools with permission. |
| disable-model-invocation | no | `true` = only user can invoke via `/name`. Blocks Skill tool too. |
| user-invocable | no | `false` = hidden from `/` menu. Only Claude can invoke. |
| argument-hint | no | Hint shown during autocomplete. `<required>` `[optional]` (e.g., `<question>`, `[scope]`). |
| hooks | no | Lifecycle hooks scoped to this skill. |

### Description guidance

Primary trigger mechanism. Always in context (~100 words budget). List every trigger phrase, file extension, synonym. Add explicit negative triggers when skills overlap.

### Content rules

- Imperative voice. No hedging.
- Process as numbered steps. Each step = one action.
- Rely on implicit context loading (CLAUDE.md cascade). Don't instruct to "read CLAUDE.md."
- Specify output format explicitly (model matches format).
- Anti-patterns section: prevents common failure modes.
- Safety boundaries stated at top AND bottom.
- Keep under 150 lines. Move reference material to `references/`.

### Dynamic preprocessing

`!`command`` runs shell commands BEFORE the subagent starts. Output replaces the placeholder.

```
Changed files:
!`git diff --name-only HEAD -- $0 2>/dev/null`
```

Substitutions (`$ARGUMENTS`, `$0`) resolve first, then commands execute. Subagent sees only the final output.

Use for context the subagent can't get itself (e.g., git data when Bash is restricted).

### String substitutions

| Variable | Description |
|:---------|:------------|
| `$ARGUMENTS` | All arguments passed |
| `$ARGUMENTS[N]` or `$N` | Nth argument (0-based) |
| `${CLAUDE_SESSION_ID}` | Current session ID |

### Progressive disclosure

```
skill-name/
  SKILL.md           (always loaded when triggered)
  references/        (loaded by model as needed)
  scripts/           (executable tools)
```

---

## Agents (`.claude/agents/`)

Markdown body = system prompt. Not task, not instructions — identity and constraints.

Loaded at session start. Restart or `/agents` to pick up new ones. Skills are picked up live.

### Frontmatter

| Field | Required | Description |
|:------|:---------|:------------|
| name | yes | Lowercase, hyphens. Unique identifier. |
| description | yes | When Claude should delegate to this agent. |
| tools | no | Allowlist — hard restriction. Only these tools available. Inherits all if omitted. |
| disallowedTools | no | Denylist — removed from inherited/specified list. |
| model | no | sonnet, opus, haiku, inherit. Default: inherit. |
| permissionMode | no | default, acceptEdits, dontAsk, plan, bypassPermissions. |
| maxTurns | no | Max agentic turns before stopping. |
| skills | no | Skills preloaded into subagent context at startup (full content injected). |
| memory | no | Persistent memory scope: user, project, local. |
| mcpServers | no | MCP servers available to this agent. |
| hooks | no | Lifecycle hooks scoped to this agent. |

### Constraint

Subagents cannot spawn other subagents. If workflow requires nested delegation, chain from the main conversation.

---

## Composition

Skill `agent: <name>` routes to a custom agent. They compose:

| Part | Source | Becomes |
|:-----|:-------|:--------|
| System prompt | Agent body | Who the subagent is |
| Task | Skill body (after preprocessing) | What the subagent does |
| Tools | Agent `tools` field | Hard allowlist |
| Model | Agent `model` (or skill `model`) | Which model runs |
| CLAUDE.md | Auto-loaded on file reads | Spec cascade |
| Conversation history | Not included | Fork = fresh context |

### When to compose (skill + agent)

- `/name` invocation AND tool restriction needed
- Preprocessing (`!`command``) AND custom system prompt needed
- Argument parsing AND hard tool allowlist needed

### When skill alone suffices

- Inline guidelines (no `context: fork`)
- Simple forked tasks using built-in agents
- No tool restriction beyond prompt guidance

### When agent alone suffices

- Claude delegates based on description (no slash command needed)
- No preprocessing or argument parsing
- Tool restriction is the primary concern

---

## Verified mechanics

Tested with canary strings planted in agent body, skill body, and `!`command`` output.

| Mechanic | Result |
|:---------|:-------|
| Agent body -> system prompt | Canary found in subagent system context |
| Skill body -> task | Canary found in task preamble (with skill base directory metadata) |
| `!`command`` expansion | Echo output injected before subagent received task |
| Fork = no history | Zero prior conversation messages visible |
| Agent `tools` = hard restrict | Only specified tools available (others absent, not just unpermitted) |

---

## Anti-patterns

- `allowed-tools` in skill for restriction (only auto-permits, doesn't restrict)
- Agent body as task instructions (body = system prompt identity, not task)
- `context: fork` on guideline-only skills (subagent gets guidelines but no actionable task)
- Instructing to read CLAUDE.md (cascade loads automatically on file reads)
- Preprocessing for data the subagent can fetch itself (waste of skill complexity)
- Thin trigger descriptions that compete ambiguously with other skills
