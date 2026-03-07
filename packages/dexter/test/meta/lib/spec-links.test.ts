/**
 * Spec Links Tests
 *
 * Pure functions for link extraction, resolution, and formatting.
 */

import { describe, expect, it } from "bun:test"

import {
  isSpecFile,
  extractSpecLinks,
  resolveSpecPath,
  formatBrokenLinks,
  type BrokenLink,
} from "../../../src/meta/lib/spec-links.ts"

describe("isSpecFile", () => {
  it("matches CLAUDE.md", () => {
    expect(isSpecFile("CLAUDE.md")).toBe(true)
  })

  it("matches path/to/CLAUDE.md", () => {
    expect(isSpecFile("/repo/apps/control/CLAUDE.md")).toBe(true)
  })

  it("matches any .md file", () => {
    expect(isSpecFile("elegance.md")).toBe(true)
    expect(isSpecFile("docs/hooks.md")).toBe(true)
  })

  it("rejects non-.md files", () => {
    expect(isSpecFile("index.ts")).toBe(false)
    expect(isSpecFile("package.json")).toBe(false)
    expect(isSpecFile("README")).toBe(false)
  })
})

describe("extractSpecLinks", () => {
  it("extracts markdown links to .md files", () => {
    const content = "See [Elegance](elegance.md) for details."
    const links = extractSpecLinks(content)

    expect(links).toEqual([{ type: "link", path: "elegance.md", line: 1 }])
  })

  it("ignores HTTP links", () => {
    const content = "See [docs](https://example.com/docs.md) online."
    const links = extractSpecLinks(content)

    expect(links).toEqual([])
  })

  it("ignores http links", () => {
    const content = "See [docs](http://example.com/docs.md) online."
    const links = extractSpecLinks(content)

    expect(links).toEqual([])
  })

  it("captures correct line numbers", () => {
    const content = "line one\nline two\nSee [ref](ref.md) here.\nline four"
    const links = extractSpecLinks(content)

    expect(links[0]!.line).toBe(3)
  })

  it("handles multiple links on same line", () => {
    const content = "See [a](a.md) and [b](b.md) for details."
    const links = extractSpecLinks(content)

    expect(links.length).toBe(2)
    expect(links[0]!.path).toBe("a.md")
    expect(links[1]!.path).toBe("b.md")
  })

  it("returns empty for content with no links", () => {
    const content = "No links here. Just text."
    const links = extractSpecLinks(content)

    expect(links).toEqual([])
  })

  it("ignores links to non-.md files", () => {
    const content = "See [code](index.ts) and [config](package.json)."
    const links = extractSpecLinks(content)

    expect(links).toEqual([])
  })

  it("extracts absolute path links", () => {
    const content = "See [root](/CLAUDE.md) spec."
    const links = extractSpecLinks(content)

    expect(links[0]!.path).toBe("/CLAUDE.md")
  })

  it("extracts relative path links", () => {
    const content = "See [hooks](./hooks.md) spec."
    const links = extractSpecLinks(content)

    expect(links[0]!.path).toBe("./hooks.md")
  })
})

describe("resolveSpecPath", () => {
  it("resolves /absolute from repo root", () => {
    const result = resolveSpecPath("/CLAUDE.md", "/repo/apps/control/CLAUDE.md", "/repo")
    expect(result).toBe("/repo/CLAUDE.md")
  })

  it("resolves ./relative from file directory", () => {
    const result = resolveSpecPath("./hooks.md", "/repo/apps/control/CLAUDE.md", "/repo")
    expect(result).toBe("/repo/apps/control/hooks.md")
  })

  it("resolves bare relative from file directory", () => {
    const result = resolveSpecPath("hooks.md", "/repo/apps/control/CLAUDE.md", "/repo")
    expect(result).toBe("/repo/apps/control/hooks.md")
  })

  it("resolves nested relative paths", () => {
    const result = resolveSpecPath("../shared.md", "/repo/apps/control/CLAUDE.md", "/repo")
    expect(result).toBe("/repo/apps/shared.md")
  })
})

describe("formatBrokenLinks", () => {
  it("formats broken links with line numbers", () => {
    const broken: BrokenLink[] = [{ type: "link", path: "missing.md", line: 5, resolved: "/repo/missing.md" }]
    const output = formatBrokenLinks(broken)

    expect(output).toContain("Broken Spec Links")
    expect(output).toContain("missing.md")
    expect(output).toContain("line 5")
  })

  it("formats multiple broken links", () => {
    const broken: BrokenLink[] = [
      { type: "link", path: "a.md", line: 1, resolved: "/repo/a.md" },
      { type: "link", path: "b.md", line: 10, resolved: "/repo/b.md" },
    ]
    const output = formatBrokenLinks(broken)

    expect(output).toContain("a.md")
    expect(output).toContain("b.md")
    expect(output).toContain("line 1")
    expect(output).toContain("line 10")
  })
})
