import { afterEach, describe, expect, it, mock } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { syncSkill } from "../../src/skills/index.ts"

function createRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "dexter-skills-"))
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "repo" }))
  mkdirSync(join(root, ".git"))
  Bun.spawnSync(["git", "init", "-q"], { cwd: root })
  return root
}

function createGitHubFetchMock() {
  return mock(async (input: string | URL) => {
    const url = String(input)

    if (url === "https://api.github.com/repos/acme/skills") {
      return Response.json({ default_branch: "main" })
    }

    if (url === "https://api.github.com/repos/acme/skills/contents/skill?ref=main") {
      return Response.json([
        {
          type: "file",
          path: "skill/SKILL.md",
          download_url: "https://raw.githubusercontent.com/acme/skills/main/skill/SKILL.md",
        },
        {
          type: "dir",
          path: "skill/references",
        },
      ])
    }

    if (url === "https://api.github.com/repos/acme/skills/contents/skill/references?ref=main") {
      return Response.json([
        {
          type: "file",
          path: "skill/references/guide.md",
          download_url: "https://raw.githubusercontent.com/acme/skills/main/skill/references/guide.md",
        },
      ])
    }

    if (url === "https://raw.githubusercontent.com/acme/skills/main/skill/SKILL.md") {
      return new Response("remote-skill")
    }

    if (url === "https://raw.githubusercontent.com/acme/skills/main/skill/references/guide.md") {
      return new Response("remote-guide")
    }

    return new Response("missing", { status: 404 })
  })
}

describe("syncSkill", () => {
  const originalCwd = process.cwd()
  const originalFetch = globalThis.fetch

  afterEach(() => {
    process.chdir(originalCwd)
    globalThis.fetch = originalFetch
  })

  it("plans remote creates from a GitHub tree URL", async () => {
    const root = createRepo()
    process.chdir(root)

    globalThis.fetch = createGitHubFetchMock() as unknown as typeof fetch

    const result = await syncSkill({
      source: {
        kind: "github",
        url: "https://github.com/acme/skills/tree/main/skill",
      },
      targetDir: "local-skill",
    })

    expect(result.applied).toBe(false)
    expect(result.source.repo).toBe("acme/skills")
    expect(result.changes).toEqual([
      { kind: "create", path: "references/guide.md", entry: "file" },
      { kind: "create", path: "SKILL.md", entry: "file" },
    ])

  })

  it("applies updates and preserves replaced local content in trash", async () => {
    const root = createRepo()
    process.chdir(root)
    mkdirSync(join(root, "local-skill", "references"), { recursive: true })
    writeFileSync(join(root, "local-skill", "SKILL.md"), "local-skill")
    writeFileSync(join(root, "local-skill", "references", "guide.md"), "local-guide")

    globalThis.fetch = createGitHubFetchMock() as unknown as typeof fetch

    const result = await syncSkill({
      source: {
        kind: "github",
        url: "https://github.com/acme/skills/tree/main/skill",
      },
      targetDir: "local-skill",
      trashDir: ".trash/skills",
      mode: "apply",
    })

    expect(result.applied).toBe(true)
    expect(readFileSync(join(root, "local-skill", "SKILL.md"), "utf-8")).toBe("remote-skill")
    expect(readFileSync(join(root, "local-skill", "references", "guide.md"), "utf-8")).toBe("remote-guide")
    expect(existsSync(join(root, ".trash", "skills", "SKILL.md"))).toBe(true)
    expect(existsSync(join(root, ".trash", "skills", "references", "guide.md"))).toBe(true)

  })

  it("deletes missing local files when enabled", async () => {
    const root = createRepo()
    process.chdir(root)
    mkdirSync(join(root, "local-skill", "references"), { recursive: true })
    writeFileSync(join(root, "local-skill", "SKILL.md"), "remote-skill")
    writeFileSync(join(root, "local-skill", "references", "guide.md"), "remote-guide")
    writeFileSync(join(root, "local-skill", "old.md"), "old")

    globalThis.fetch = createGitHubFetchMock() as unknown as typeof fetch

    const result = await syncSkill({
      source: {
        kind: "github",
        url: "https://github.com/acme/skills/tree/main/skill",
      },
      targetDir: "local-skill",
      deleteMissing: true,
    })

    expect(result.changes).toContainEqual({ kind: "delete", path: "old.md", entry: "file" })

  })

  it("skips differing local files when conflictPolicy is skip", async () => {
    const root = createRepo()
    process.chdir(root)
    mkdirSync(join(root, "local-skill"), { recursive: true })
    writeFileSync(join(root, "local-skill", "SKILL.md"), "local-skill")

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input)
      if (url === "https://api.github.com/repos/acme/skills/contents/skill?ref=main") {
        return Response.json([
          {
            type: "file",
            path: "skill/SKILL.md",
            download_url: "https://raw.githubusercontent.com/acme/skills/main/skill/SKILL.md",
          },
        ])
      }

      if (url === "https://raw.githubusercontent.com/acme/skills/main/skill/SKILL.md") {
        return new Response("remote-skill")
      }

      return new Response("missing", { status: 404 })
    }) as unknown as typeof fetch

    const result = await syncSkill({
      source: {
        kind: "github",
        url: "https://github.com/acme/skills/tree/main/skill",
      },
      targetDir: "local-skill",
      conflictPolicy: "skip",
    })

    expect(result.changes).toEqual([
      {
        kind: "skip",
        path: "SKILL.md",
        entry: "file",
        reason: "local file differs from remote",
      },
    ])

  })

  it("rejects trash directories nested under the managed target", async () => {
    const root = createRepo()
    process.chdir(root)

    globalThis.fetch = createGitHubFetchMock() as unknown as typeof fetch

    await expect(
      syncSkill({
        source: {
          kind: "github",
          url: "https://github.com/acme/skills/tree/main/skill",
        },
        targetDir: "local-skill",
        trashDir: "local-skill/.trash",
      }),
    ).rejects.toThrow("trashDir must be outside the managed targetDir")

  })
})
