/**
 * createCLI — the extension API for consumer repos.
 *
 * Consumer repos import this factory and compose their own CLI
 * with custom commands and hook extensions on top of dexter's core.
 */

import { render } from "../output/index.ts"
import type { OutputMode } from "../output/types.ts"

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

import { onPreBash } from "./hooks/on-pre-bash.ts"
import { onPostWrite } from "./hooks/on-post-write.ts"
import { onPostRead } from "./hooks/on-post-read.ts"
import { onSessionStart } from "./hooks/on-session-start.ts"
import {
  onPostBash,
  onStop,
  onPromptSubmit,
  onNotification,
  onPreCompact,
  onToolFailure,
  onSubagentStart,
  onSubagentStop,
  onSessionEnd,
  onPermissionRequest,
} from "./hooks/stubs.ts"

import type { HookInput } from "./lib/stdin.ts"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HookContext = {
  root: string
  service: ControlService
}

export type HookOutput = {
  additionalContext?: string
} | void

export type CLIConfig = {
  commands?: Record<string, (args: string[], ctx: HookContext) => Promise<void> | void>
  hooks?: {
    "pre-bash"?: { deny?: Array<{ pattern: RegExp; hint: string }> }
    "post-read"?: (input: HookInput, ctx: HookContext) => HookOutput | Promise<HookOutput>
    "post-write"?: (input: HookInput, ctx: HookContext) => HookOutput | Promise<HookOutput>
  }
}

// ---------------------------------------------------------------------------
// Core hook dispatch
// ---------------------------------------------------------------------------

const CORE_HOOKS: Record<string, () => Promise<void>> = {
  "on-pre-bash": onPreBash,
  "on-post-write": onPostWrite,
  "on-post-read": onPostRead,
  "on-session-start": onSessionStart,
  "on-post-bash": onPostBash,
  "on-stop": onStop,
  "on-prompt-submit": onPromptSubmit,
  "on-notification": onNotification,
  "on-pre-compact": onPreCompact,
  "on-tool-failure": onToolFailure,
  "on-subagent-start": onSubagentStart,
  "on-subagent-stop": onSubagentStop,
  "on-session-end": onSessionEnd,
  "on-permission-request": onPermissionRequest,
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function output(text: string, mode: OutputMode): void {
  if (mode === "cli") {
    console.log(text)
  } else {
    console.log(text)
  }
}

function outputError(err: unknown, mode: OutputMode): void {
  if (isControlError(err)) {
    output(render(presentError(err), mode), mode)
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

      // Hook commands — delegate to core handler
      if (cmd?.startsWith("on-")) {
        const handler = CORE_HOOKS[cmd]
        if (handler) {
          await handler()
          return
        }
        // Unknown hook — silent exit
        process.exit(0)
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
      const ctx: HookContext = { root, service }

      // Parse format flags
      const { mode, rest: args } = parseFormat(rawArgs)

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
            output(render(presentCommit(result), mode), mode)
            break
          }

          case "rules": {
            const scopes = args.length > 0 ? args : ["."]
            const result = service.rules(scopes)
            output(render(presentQuery(result), mode), mode)
            break
          }

          case "diff": {
            const scopes = args.length > 0 ? args : ["."]
            const result = service.diff(scopes)
            output(render(presentQuery(result), mode), mode)
            break
          }

          case "commits": {
            const scopes = args.length > 0 ? args : ["."]
            const result = service.commits(scopes)
            output(render(presentQuery(result), mode), mode)
            break
          }

          case "lint": {
            const changed = args.includes("--changed")
            const scopes = args.filter((a) => a !== "--changed")
            const result = await service.lint(scopes, { changed })
            output(render(presentQuery(result), mode), mode)
            if (result.what === "lint" && result.data.errorCount > 0) process.exit(1)
            break
          }

          case "typecheck": {
            const result = await service.typecheck(args)
            output(render(presentQuery(result), mode), mode)
            if (result.what === "typecheck" && result.data.errorCount > 0) process.exit(1)
            break
          }

          case "test": {
            const result = await service.test(args)
            output(render(presentQuery(result), mode), mode)
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
            output(render(presentGit(result), mode), mode)
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
            output(render(presentGit(result), mode), mode)
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
            output(render(presentGit(result), mode), mode)
            break
          }

          case "eval": {
            const code = args.join(" ")
            const result = await service.eval({ code })
            output(render(presentEval(result), mode), mode)
            if (!result.ok) process.exit(1)
            break
          }

          case "setup": {
            const result = service.setup()
            output(render(presentSetup(result), mode), mode)
            break
          }

          case "transcripts": {
            const skillIdx = args.indexOf("--skill")
            const minutesIdx = args.indexOf("--minutes")
            const skill = skillIdx >= 0 ? args[skillIdx + 1] : undefined
            const minutes = minutesIdx >= 0 ? parseInt(args[minutesIdx + 1]!, 10) : undefined
            const result = service.transcripts({ skill, minutes })
            output(render(presentTranscripts(result), mode), mode)
            break
          }

          case "packages": {
            const packages = service.discoverPackages()
            output(render(presentPackages(packages), mode), mode)
            break
          }

          case "format": {
            // Prettier formatting
            const scopes = args.length > 0 ? args : ["."]
            const formatResult = await service.lint(scopes) // HACK: reuses lint, should be separate
            output(render(presentQuery(formatResult), mode), mode)
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
