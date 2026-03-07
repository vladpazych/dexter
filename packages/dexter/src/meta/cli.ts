/**
 * createCLI — the extension API for consumer repos.
 *
 * Consumer repos import this factory and compose their own CLI
 * with custom commands and hook extensions on top of dexter's core.
 */

import { render } from "../output/index.ts"
import type { Node, OutputMode } from "../output/types.ts"

import { isControlError } from "./errors.ts"
import { findRepoRoot } from "./lib/paths.ts"
import { parseFormat } from "./lib/format.ts"
import {
  presentQuery,
  presentGit,
  presentCommit,
  presentEval,
  presentPackages,
  presentSetup,
  presentTranscripts,
  presentError,
} from "./lib/present.ts"
import { createControlPorts } from "./adapters/index.ts"
import { createControlService, type ControlService } from "./domain/service.ts"

// Composable hook internals
import { checkPreBash, CORE_DENY_PATTERNS, type DenyPattern } from "./hooks/on-pre-bash.ts"
import { collectPostWriteContext } from "./hooks/on-post-write.ts"
import { collectPostReadContext } from "./hooks/on-post-read.ts"
import { collectSessionStartContext } from "./hooks/on-session-start.ts"

import { readJsonStdin, type HookInput } from "./lib/stdin.ts"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HookContext = {
  root: string
  service: ControlService
  mode: OutputMode
  /** Render a Node tree to string in the active output mode. */
  render: (node: Node) => string
}

export type HookOutput = {
  additionalContext?: string
} | void

export type HookHandler = (input: HookInput | null) => HookOutput | Promise<HookOutput>

export type CLIConfig = {
  commands?: Record<string, (args: string[], ctx: HookContext) => Promise<void> | void>
  hooks?: {
    /** Additional deny patterns merged with core patterns */
    "pre-bash"?: { deny?: DenyPattern[] }
    /** Called after core post-read. Return additional context to append. */
    "post-read"?: HookHandler
    /** Called after core post-write. Return additional context to append. */
    "post-write"?: HookHandler
    /** Called after core session-start. Return additional context to append. */
    "session-start"?: HookHandler
    /** Called after Bash tool execution. */
    "post-bash"?: HookHandler
    /** Called when agent is about to stop. */
    "stop"?: HookHandler
    /** Called on user prompt submit. */
    "prompt-submit"?: HookHandler
    /** Called on notification. */
    "notification"?: HookHandler
    /** Called before context compaction. */
    "pre-compact"?: HookHandler
    /** Called on tool failure. */
    "tool-failure"?: HookHandler
    /** Called when a subagent starts. */
    "subagent-start"?: HookHandler
    /** Called when a subagent stops. */
    "subagent-stop"?: HookHandler
    /** Called when session ends. */
    "session-end"?: HookHandler
    /** Called on permission request. */
    "permission-request"?: HookHandler
  }
}

// Re-export for consumers defining deny patterns
export type { DenyPattern }

// ---------------------------------------------------------------------------
// Extension hooks — no core logic, delegate to consumer callback
// ---------------------------------------------------------------------------

const EXTENSION_HOOKS: Record<string, { key: string; event: string }> = {
  "on-post-bash": { key: "post-bash", event: "PostToolUse" },
  "on-stop": { key: "stop", event: "Stop" },
  "on-prompt-submit": { key: "prompt-submit", event: "PromptSubmit" },
  "on-notification": { key: "notification", event: "Notification" },
  "on-pre-compact": { key: "pre-compact", event: "PreCompact" },
  "on-tool-failure": { key: "tool-failure", event: "ToolError" },
  "on-subagent-start": { key: "subagent-start", event: "SubagentStart" },
  "on-subagent-stop": { key: "subagent-stop", event: "SubagentStop" },
  "on-session-end": { key: "session-end", event: "SessionEnd" },
  "on-permission-request": { key: "permission-request", event: "PermissionRequest" },
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function outputError(err: unknown, mode: OutputMode): void {
  if (isControlError(err)) {
    console.log(render(presentError(err), mode))
  } else {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
  }
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCLI(config: CLIConfig = {}) {
  return {
    async run(): Promise<void> {
      const [, , cmd, ...rawArgs] = process.argv

      // Hook commands — composable dispatch
      if (cmd?.startsWith("on-")) {
        // Emergency brake — bypass all hooks when .claude/hooks-disabled exists
        try {
          const root = findRepoRoot()
          if (await Bun.file(`${root}/.claude/hooks-disabled`).exists()) {
            process.exit(0)
          }
        } catch {
          // No repo root — continue normally
        }

        switch (cmd) {
          case "on-session-start": {
            const input = await readJsonStdin<HookInput>()
            const sections = await collectSessionStartContext()

            const ext = config.hooks?.["session-start"]
            if (ext) {
              const result = await ext(input)
              if (result?.additionalContext) {
                sections.push(result.additionalContext)
              }
            }

            if (sections.length > 0) {
              console.log(
                JSON.stringify({
                  hookSpecificOutput: {
                    hookEventName: "SessionStart",
                    additionalContext: sections.join("\n"),
                  },
                }),
              )
            }
            process.exit(0)
          }

          case "on-pre-bash": {
            const input = await readJsonStdin<HookInput>()
            const patterns = [...CORE_DENY_PATTERNS, ...(config.hooks?.["pre-bash"]?.deny ?? [])]
            const reason = await checkPreBash(input, patterns)

            if (reason) {
              console.log(
                JSON.stringify({
                  hookSpecificOutput: {
                    hookEventName: "PreToolUse",
                    permissionDecision: "deny",
                    permissionDecisionReason: reason,
                  },
                }),
              )
            }
            process.exit(0)
          }

          case "on-post-write": {
            const input = await readJsonStdin<HookInput>()
            const sections = await collectPostWriteContext(input)

            const ext = config.hooks?.["post-write"]
            if (ext) {
              const result = await ext(input)
              if (result?.additionalContext) {
                sections.push(result.additionalContext)
              }
            }

            if (sections.length > 0) {
              console.log(
                JSON.stringify({
                  hookSpecificOutput: {
                    hookEventName: "PostToolUse",
                    additionalContext: sections.join("\n"),
                  },
                }),
              )
            }
            process.exit(0)
          }

          case "on-post-read": {
            const input = await readJsonStdin<HookInput>()
            const sections = await collectPostReadContext(input)

            const ext = config.hooks?.["post-read"]
            if (ext) {
              const result = await ext(input)
              if (result?.additionalContext) {
                sections.push(result.additionalContext)
              }
            }

            if (sections.length > 0) {
              console.log(
                JSON.stringify({
                  hookSpecificOutput: {
                    hookEventName: "PostToolUse",
                    additionalContext: sections.join("\n") + "\n",
                  },
                }),
              )
            }
            process.exit(0)
          }

          default: {
            // Extension hooks — no core logic, delegate to consumer
            const hookDef = EXTENSION_HOOKS[cmd]
            if (hookDef) {
              const input = await readJsonStdin<HookInput>()
              const ext = config.hooks?.[hookDef.key as keyof NonNullable<CLIConfig["hooks"]>]

              if (typeof ext === "function") {
                const result = await (ext as HookHandler)(input)
                if (result?.additionalContext) {
                  console.log(
                    JSON.stringify({
                      hookSpecificOutput: {
                        hookEventName: hookDef.event,
                        additionalContext: result.additionalContext,
                      },
                    }),
                  )
                }
              }

              process.exit(0)
            }

            // Unknown hook — silent exit
            process.exit(0)
          }
        }
      }

      // Everything below needs repo root + service
      let root: string
      try {
        root = findRepoRoot()
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }

      const ports = createControlPorts(root)
      const service = createControlService(ports)

      // Parse format flags
      const { mode, rest: args } = parseFormat(rawArgs)
      const ctx: HookContext = { root, service, mode, render: (node) => render(node, mode) }

      try {
        // Custom commands first (override built-in)
        if (cmd && config.commands?.[cmd]) {
          await config.commands[cmd](args, ctx)
          return
        }

        // Built-in domain commands
        switch (cmd) {
          case "commit": {
            const [message, ...files] = args
            if (!message) {
              console.error('Usage: commit "message" file1 file2 ...')
              process.exit(1)
            }
            const result = await service.commit({ message, files })
            console.log(render(presentCommit(result), mode), mode)
            break
          }

          case "rules": {
            const scopes = args.length > 0 ? args : ["."]
            const result = service.rules(scopes)
            console.log(render(presentQuery(result), mode), mode)
            break
          }

          case "diff": {
            const scopes = args.length > 0 ? args : ["."]
            const result = service.diff(scopes)
            console.log(render(presentQuery(result), mode), mode)
            break
          }

          case "commits": {
            const scopes = args.length > 0 ? args : ["."]
            const result = service.commits(scopes)
            console.log(render(presentQuery(result), mode), mode)
            break
          }

          case "lint": {
            const changed = args.includes("--changed")
            const scopes = args.filter((a) => a !== "--changed")
            const result = await service.lint(scopes, { changed })
            console.log(render(presentQuery(result), mode), mode)
            if (result.what === "lint" && result.data.errorCount > 0) process.exit(1)
            break
          }

          case "typecheck": {
            const result = await service.typecheck(args)
            console.log(render(presentQuery(result), mode), mode)
            if (result.what === "typecheck" && result.data.errorCount > 0) process.exit(1)
            break
          }

          case "test": {
            const result = await service.test(args)
            console.log(render(presentQuery(result), mode), mode)
            if (result.what === "test" && result.data.errorCount > 0) process.exit(1)
            break
          }

          case "blame": {
            const file = args[0]
            if (!file) {
              console.error("Usage: blame <file> [startLine:endLine]")
              process.exit(1)
            }
            let lines: [number, number] | undefined
            if (args[1]) {
              const parts = args[1].split(":")
              if (parts.length === 2) {
                lines = [parseInt(parts[0]!, 10), parseInt(parts[1]!, 10)]
              }
            }
            const result = service.blame(file, lines)
            console.log(render(presentGit(result), mode), mode)
            break
          }

          case "pickaxe": {
            const pattern = args[0]
            if (!pattern) {
              console.error("Usage: pickaxe <pattern> [--regex] [scopes...]")
              process.exit(1)
            }
            const regex = args.includes("--regex")
            const scopes = args.slice(1).filter((a) => a !== "--regex")
            const result = service.pickaxe(pattern, { regex, scopes: scopes.length > 0 ? scopes : undefined })
            console.log(render(presentGit(result), mode), mode)
            break
          }

          case "bisect": {
            const testCmd = args[0]
            const goodIdx = args.indexOf("--good")
            const badIdx = args.indexOf("--bad")
            const good = goodIdx >= 0 ? args[goodIdx + 1] : undefined
            const bad = badIdx >= 0 ? args[badIdx + 1] : undefined
            if (!testCmd || !good) {
              console.error("Usage: bisect <test-cmd> --good <ref> [--bad <ref>]")
              process.exit(1)
            }
            const result = await service.bisect(testCmd, good, bad)
            console.log(render(presentGit(result), mode), mode)
            break
          }

          case "eval": {
            const code = args.join(" ")
            const result = await service.eval({ code })
            console.log(render(presentEval(result), mode), mode)
            if (!result.ok) process.exit(1)
            break
          }

          case "setup": {
            const result = service.setup()
            console.log(render(presentSetup(result), mode), mode)
            break
          }

          case "transcripts": {
            const skillIdx = args.indexOf("--skill")
            const minutesIdx = args.indexOf("--minutes")
            const skill = skillIdx >= 0 ? args[skillIdx + 1] : undefined
            const minutes = minutesIdx >= 0 ? parseInt(args[minutesIdx + 1]!, 10) : undefined
            const result = service.transcripts({ skill, minutes })
            console.log(render(presentTranscripts(result), mode), mode)
            break
          }

          case "packages": {
            const packages = service.discoverPackages()
            console.log(render(presentPackages(packages), mode), mode)
            break
          }

          case "format": {
            // Prettier formatting
            const scopes = args.length > 0 ? args : ["."]
            const formatResult = await service.lint(scopes) // HACK: reuses lint, should be separate
            console.log(render(presentQuery(formatResult), mode), mode)
            break
          }

          case "--help":
          case "-h":
          case "help":
          case undefined: {
            const commands = [
              "commit   — quality-gated atomic commit",
              "rules    — CLAUDE.md cascade for scopes",
              "diff     — git status + diff for scopes",
              "commits  — recent commit history",
              "lint     — ESLint across workspace",
              "typecheck — TypeScript checking",
              "test     — run tests",
              "blame    — structured git blame",
              "pickaxe  — find commits by pattern",
              "bisect   — binary search for bad commit",
              "eval     — sandboxed TypeScript REPL",
              "setup    — configure .claude/settings",
              "transcripts — list subagent transcripts",
              "packages — list workspace packages",
            ]

            if (config.commands) {
              for (const name of Object.keys(config.commands)) {
                commands.push(`${name}   — (custom)`)
              }
            }

            console.log(`dexter meta — agentic development toolkit\n`)
            console.log(`Commands:`)
            for (const c of commands) {
              console.log(`  ${c}`)
            }
            console.log(`\nFlags: --format cli|json|xml|md  --json  --xml  --md`)
            break
          }

          default:
            console.error(`Unknown command: ${cmd}`)
            process.exit(1)
        }
      } catch (err) {
        outputError(err, mode)
      }
    },
  }
}
