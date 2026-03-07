import { describe, expect, it } from "bun:test"

import { transcripts } from "../../../src/meta/domain/transcripts.ts"
import { mockPorts } from "../mocks.ts"
import type { FsPort } from "../../../src/meta/ports.ts"

type DirEntry = { name: string; isDirectory: boolean }

function makeFirstLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "user",
    sessionId: "sess-1",
    agentId: "a1b2c3d",
    timestamp: new Date().toISOString(),
    message: {
      role: "user",
      content: "Base directory for this skill: /repo/.claude/skills/commit\n\n## Context\n\nsome context",
    },
    ...overrides,
  })
}

function transcriptsFs(layout: Record<string, DirEntry[]>, files: Record<string, string>): FsPort {
  return {
    exists: (path: string) => path in layout || path in files,
    readFile: (path: string) => {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`)
      return files[path]!
    },
    readDir: (path: string) => {
      if (!(path in layout)) throw new Error(`ENOENT: ${path}`)
      return layout[path]!
    },
    writeFile: () => {},
    unlink: () => {},
    mkdir: () => {},
  }
}

describe("transcripts", () => {
  const slug = "-repo"
  const base = `/home/.claude/projects/${slug}`

  it("returns empty when project dir does not exist", () => {
    const ports = mockPorts({ fs: { ...mockPorts().fs, exists: () => false } })
    const result = transcripts(ports, {})
    expect(result.entries).toEqual([])
    expect(result.projectSlug).toBe(slug)
  })

  it("finds transcripts across sessions", () => {
    const now = new Date().toISOString()
    const line1 = makeFirstLine({ sessionId: "sess-1", agentId: "aaa", timestamp: now })
    const line2 = makeFirstLine({
      sessionId: "sess-2",
      agentId: "bbb",
      timestamp: now,
      message: { role: "user", content: "Some task agent prompt" },
    })

    const layout: Record<string, DirEntry[]> = {
      [base]: [
        { name: "sess-1", isDirectory: true },
        { name: "sess-2", isDirectory: true },
        { name: "sess-1.jsonl", isDirectory: false },
      ],
      [`${base}/sess-1/subagents`]: [{ name: "agent-aaa.jsonl", isDirectory: false }],
      [`${base}/sess-2/subagents`]: [{ name: "agent-bbb.jsonl", isDirectory: false }],
    }
    const files: Record<string, string> = {
      [`${base}/sess-1/subagents/agent-aaa.jsonl`]: line1 + "\n{}",
      [`${base}/sess-2/subagents/agent-bbb.jsonl`]: line2 + "\n{}",
    }

    const ports = mockPorts({ fs: transcriptsFs(layout, files), homedir: () => "/home" })
    const result = transcripts(ports, {})

    expect(result.entries).toHaveLength(2)
    expect(result.entries[0]!.skill).toBe("commit")
    expect(result.entries[1]!.skill).toBe("task")
  })

  it("filters by skill name", () => {
    const now = new Date().toISOString()
    const commitLine = makeFirstLine({ agentId: "aaa", timestamp: now })
    const taskLine = makeFirstLine({
      agentId: "bbb",
      timestamp: now,
      message: { role: "user", content: "Some task" },
    })

    const layout: Record<string, DirEntry[]> = {
      [base]: [{ name: "sess-1", isDirectory: true }],
      [`${base}/sess-1/subagents`]: [
        { name: "agent-aaa.jsonl", isDirectory: false },
        { name: "agent-bbb.jsonl", isDirectory: false },
      ],
    }
    const files: Record<string, string> = {
      [`${base}/sess-1/subagents/agent-aaa.jsonl`]: commitLine + "\n{}",
      [`${base}/sess-1/subagents/agent-bbb.jsonl`]: taskLine + "\n{}",
    }

    const ports = mockPorts({ fs: transcriptsFs(layout, files), homedir: () => "/home" })
    const result = transcripts(ports, { skill: "commit" })

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]!.skill).toBe("commit")
  })

  it("filters by time window", () => {
    const recent = new Date().toISOString()
    const old = new Date(Date.now() - 200 * 60 * 1000).toISOString()
    const recentLine = makeFirstLine({ agentId: "aaa", timestamp: recent })
    const oldLine = makeFirstLine({ agentId: "bbb", timestamp: old })

    const layout: Record<string, DirEntry[]> = {
      [base]: [{ name: "sess-1", isDirectory: true }],
      [`${base}/sess-1/subagents`]: [
        { name: "agent-aaa.jsonl", isDirectory: false },
        { name: "agent-bbb.jsonl", isDirectory: false },
      ],
    }
    const files: Record<string, string> = {
      [`${base}/sess-1/subagents/agent-aaa.jsonl`]: recentLine + "\n{}",
      [`${base}/sess-1/subagents/agent-bbb.jsonl`]: oldLine + "\n{}",
    }

    const ports = mockPorts({ fs: transcriptsFs(layout, files), homedir: () => "/home" })
    const result = transcripts(ports, { minutes: 120 })

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]!.agentId).toBe("aaa")
  })

  it("handles malformed JSONL gracefully", () => {
    const layout: Record<string, DirEntry[]> = {
      [base]: [{ name: "sess-1", isDirectory: true }],
      [`${base}/sess-1/subagents`]: [{ name: "agent-bad.jsonl", isDirectory: false }],
    }
    const files: Record<string, string> = {
      [`${base}/sess-1/subagents/agent-bad.jsonl`]: "not json\n{}",
    }

    const ports = mockPorts({ fs: transcriptsFs(layout, files), homedir: () => "/home" })
    const result = transcripts(ports, {})

    expect(result.entries).toHaveLength(0)
  })

  it("skips non-jsonl files and non-directory entries", () => {
    const now = new Date().toISOString()
    const line = makeFirstLine({ agentId: "aaa", timestamp: now })

    const layout: Record<string, DirEntry[]> = {
      [base]: [{ name: "sess-1", isDirectory: true }],
      [`${base}/sess-1/subagents`]: [
        { name: "agent-aaa.jsonl", isDirectory: false },
        { name: "some-file.txt", isDirectory: false },
        { name: "subdir", isDirectory: true },
      ],
    }
    const files: Record<string, string> = {
      [`${base}/sess-1/subagents/agent-aaa.jsonl`]: line + "\n{}",
    }

    const ports = mockPorts({ fs: transcriptsFs(layout, files), homedir: () => "/home" })
    const result = transcripts(ports, {})

    expect(result.entries).toHaveLength(1)
  })

  it("sorts by timestamp descending", () => {
    const t1 = "2026-02-10T18:00:00.000Z"
    const t2 = "2026-02-10T19:00:00.000Z"
    const line1 = makeFirstLine({ agentId: "older", timestamp: t1 })
    const line2 = makeFirstLine({ agentId: "newer", timestamp: t2 })

    const layout: Record<string, DirEntry[]> = {
      [base]: [{ name: "sess-1", isDirectory: true }],
      [`${base}/sess-1/subagents`]: [
        { name: "agent-older.jsonl", isDirectory: false },
        { name: "agent-newer.jsonl", isDirectory: false },
      ],
    }
    const files: Record<string, string> = {
      [`${base}/sess-1/subagents/agent-older.jsonl`]: line1 + "\n{}",
      [`${base}/sess-1/subagents/agent-newer.jsonl`]: line2 + "\n{}",
    }

    const ports = mockPorts({ fs: transcriptsFs(layout, files), homedir: () => "/home" })
    const result = transcripts(ports, { minutes: 999999 })

    expect(result.entries[0]!.agentId).toBe("newer")
    expect(result.entries[1]!.agentId).toBe("older")
  })
})
