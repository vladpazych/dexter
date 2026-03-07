/**
 * Transcripts — find and list Claude Code subagent transcripts.
 */

import { join } from "node:path"

import type { ControlPorts } from "../ports.ts"
import type { TranscriptEntry, TranscriptsParams, TranscriptsResult } from "../types.ts"

const DEFAULT_MINUTES = 120
const SKILL_DIR_PATTERN = /Base directory for this skill:.*\/\.claude\/skills\/([^/\n]+)/

/** Derive Claude Code project slug from absolute repo root path. */
function projectSlug(root: string): string {
  return "-" + root.replace(/\//g, "-").replace(/^-/, "")
}

/** Extract skill name from first JSONL line's message content. */
function extractSkill(firstLine: string): string {
  try {
    const data = JSON.parse(firstLine)
    const content = data?.message?.content
    const text = typeof content === "string" ? content : Array.isArray(content) ? (content[0]?.text ?? "") : ""
    const match = SKILL_DIR_PATTERN.exec(text)
    return match?.[1] ?? "task"
  } catch {
    return "unknown"
  }
}

export function transcripts(ports: ControlPorts, params: TranscriptsParams): TranscriptsResult {
  const { skill, minutes = DEFAULT_MINUTES } = params
  const slug = projectSlug(ports.root)
  const basePath = join(ports.homedir(), ".claude", "projects", slug)

  if (!ports.fs.exists(basePath)) {
    return { projectSlug: slug, entries: [] }
  }

  const cutoff = new Date(Date.now() - minutes * 60 * 1000)
  const entries: TranscriptEntry[] = []

  const sessions = ports.fs.readDir(basePath)
  for (const session of sessions) {
    if (!session.isDirectory) continue

    const subagentsPath = join(basePath, session.name, "subagents")
    if (!ports.fs.exists(subagentsPath)) continue

    const files = ports.fs.readDir(subagentsPath)
    for (const file of files) {
      if (file.isDirectory || !file.name.endsWith(".jsonl")) continue

      const filePath = join(subagentsPath, file.name)
      const content = ports.fs.readFile(filePath)
      const firstLine = content.slice(0, content.indexOf("\n"))
      if (!firstLine) continue

      let timestamp: string
      let agentId: string
      try {
        const meta = JSON.parse(firstLine)
        timestamp = meta.timestamp ?? ""
        agentId = meta.agentId ?? file.name.replace("agent-", "").replace(".jsonl", "")
      } catch {
        continue
      }

      if (timestamp && new Date(timestamp) < cutoff) continue

      const skillName = extractSkill(firstLine)
      if (skill && skillName !== skill) continue

      entries.push({
        path: filePath,
        agentId,
        sessionId: session.name,
        skill: skillName,
        timestamp,
        size: content.length,
      })
    }
  }

  entries.sort((a, b) => (b.timestamp > a.timestamp ? 1 : b.timestamp < a.timestamp ? -1 : 0))

  return { projectSlug: slug, entries }
}
