import { describe, expect, test } from "bun:test"
import { block, field, heading, list, render, text, toValue } from "./index.ts"
import { setColorEnabled } from "../terminal/colors.ts"

// Disable colors for deterministic CLI output in tests
setColorEnabled(false)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const commitDoc = block(
  "commit",
  field("hash", "abc123"),
  field("intent", "impl: add feature"),
  field("files", list("file", text("src/a.ts"), text("src/b.ts"))),
)

const scopeDoc = block(
  "scope",
  { path: "meta/src" },
  heading("meta/src"),
  field("status", "clean"),
  field("changes", 0),
)

const mixedDoc = block("result", field("count", 3), text("some note"))

const simpleList = list(text("alpha"), text("beta"), text("gamma"))

const nestedDoc = block(
  "report",
  heading("Quality Report"),
  block("lint", field("errors", 0), field("warnings", 2)),
  block("typecheck", field("errors", 0)),
)

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

describe("builders", () => {
  test("text creates a text node", () => {
    const n = text("hello")
    expect(n).toEqual({ kind: "text", value: "hello" })
  })

  test("text with style", () => {
    const n = text("error", "red")
    expect(n).toEqual({ kind: "text", value: "error", style: "red" })
  })

  test("field with primitive", () => {
    const n = field("count", 42)
    expect(n).toEqual({ kind: "field", label: "count", value: 42 })
  })

  test("field with node value", () => {
    const n = field("items", list(text("a")))
    expect(n.kind).toBe("field")
    expect(typeof n.value).toBe("object")
  })

  test("block without attrs", () => {
    const n = block("commit", field("hash", "abc"))
    expect(n.kind).toBe("block")
    expect(n.tag).toBe("commit")
    expect(n.attrs).toBeUndefined()
    expect(n.children).toHaveLength(1)
  })

  test("block with attrs", () => {
    const n = block("scope", { path: "meta" }, field("status", "ok"))
    expect(n.attrs).toEqual({ path: "meta" })
    expect(n.children).toHaveLength(1)
  })

  test("list without tag", () => {
    const n = list(text("a"), text("b"))
    expect(n.kind).toBe("list")
    expect(n.tag).toBeUndefined()
    expect(n.items).toHaveLength(2)
  })

  test("list with tag", () => {
    const n = list("file", text("a"), text("b"))
    expect(n.tag).toBe("file")
    expect(n.items).toHaveLength(2)
  })

  test("heading", () => {
    const n = heading("Title")
    expect(n).toEqual({ kind: "heading", text: "Title" })
  })
})

// ---------------------------------------------------------------------------
// JSON renderer
// ---------------------------------------------------------------------------

describe("json", () => {
  test("text → string", () => {
    expect(toValue(text("hello"))).toBe("hello")
  })

  test("field preserves number type", () => {
    expect(toValue(field("count", 42))).toEqual({ count: 42 })
  })

  test("field preserves boolean type", () => {
    expect(toValue(field("ok", true))).toEqual({ ok: true })
  })

  test("field preserves string type", () => {
    expect(toValue(field("name", "alice"))).toEqual({ name: "alice" })
  })

  test("block with fields → object", () => {
    const value = toValue(commitDoc) as Record<string, unknown>
    expect(value.hash).toBe("abc123")
    expect(value.intent).toBe("impl: add feature")
    expect(value.files).toEqual(["src/a.ts", "src/b.ts"])
  })

  test("block with attrs merges into object", () => {
    const value = toValue(scopeDoc) as Record<string, unknown>
    expect(value.path).toBe("meta/src")
    expect(value.status).toBe("clean")
    expect(value.changes).toBe(0)
  })

  test("heading omitted from JSON", () => {
    const value = toValue(scopeDoc) as Record<string, unknown>
    expect("text" in value).toBe(false)
  })

  test("list → array", () => {
    expect(toValue(simpleList)).toEqual(["alpha", "beta", "gamma"])
  })

  test("block with non-field children → array", () => {
    const doc = block("items", text("one"), text("two"))
    expect(toValue(doc)).toEqual(["one", "two"])
  })

  test("single non-field child unwraps", () => {
    const doc = block("wrapper", text("only"))
    expect(toValue(doc)).toBe("only")
  })

  test("mixed block → object with content", () => {
    const value = toValue(mixedDoc) as Record<string, unknown>
    expect(value.count).toBe(3)
    expect(value.content).toEqual(["some note"])
  })

  test("nested blocks", () => {
    const value = toValue(nestedDoc) as Record<string, unknown>
    expect(value).toEqual({
      lint: { errors: 0, warnings: 2 },
      typecheck: { errors: 0 },
    })
  })

  test("render json produces valid JSON string", () => {
    const str = render(commitDoc, "json")
    const parsed = JSON.parse(str)
    expect(parsed.hash).toBe("abc123")
  })
})

// ---------------------------------------------------------------------------
// XML renderer
// ---------------------------------------------------------------------------

describe("xml", () => {
  test("text → escaped content", () => {
    expect(render(text("a < b & c"), "xml")).toBe("a &lt; b &amp; c")
  })

  test("text style ignored", () => {
    expect(render(text("bold", "bold"), "xml")).toBe("bold")
  })

  test("field → element", () => {
    expect(render(field("hash", "abc"), "xml")).toBe("<hash>abc</hash>")
  })

  test("field with number", () => {
    expect(render(field("count", 42), "xml")).toBe("<count>42</count>")
  })

  test("block → tag wrapping", () => {
    const xml = render(block("commit", field("hash", "abc")), "xml")
    expect(xml).toBe("<commit>\n<hash>abc</hash>\n</commit>")
  })

  test("block with attrs", () => {
    const xml = render(block("scope", { path: "meta/src" }, field("status", "ok")), "xml")
    expect(xml).toContain('<scope path="meta/src">')
    expect(xml).toContain("<status>ok</status>")
  })

  test("attrs escaped", () => {
    const xml = render(block("scope", { path: 'a "b" c' }), "xml")
    expect(xml).toContain('path="a &quot;b&quot; c"')
  })

  test("empty block → self-closing", () => {
    expect(render(block("empty"), "xml")).toBe("<empty />")
  })

  test("heading omitted", () => {
    const xml = render(block("sec", heading("Title"), field("x", 1)), "xml")
    expect(xml).not.toContain("Title")
    expect(xml).toContain("<x>1</x>")
  })

  test("list without tag → concatenated", () => {
    const xml = render(list(text("a"), text("b")), "xml")
    expect(xml).toBe("a\nb")
  })

  test("list with tag → wrapped items", () => {
    const xml = render(list("file", text("a.ts"), text("b.ts")), "xml")
    expect(xml).toBe("<file>a.ts</file>\n<file>b.ts</file>")
  })

  test("nested structure", () => {
    const xml = render(commitDoc, "xml")
    expect(xml).toContain("<commit>")
    expect(xml).toContain("<hash>abc123</hash>")
    expect(xml).toContain("<file>src/a.ts</file>")
    expect(xml).toContain("</commit>")
  })
})

// ---------------------------------------------------------------------------
// CLI renderer
// ---------------------------------------------------------------------------

describe("cli", () => {
  test("text without style", () => {
    expect(render(text("hello"), "cli")).toBe("hello")
  })

  test("text style applied (colors disabled → plain)", () => {
    // Colors disabled via setColorEnabled(false) at top
    expect(render(text("error", "red"), "cli")).toBe("error")
  })

  test("field renders label: value", () => {
    const out = render(field("hash", "abc"), "cli")
    expect(out).toContain("hash:")
    expect(out).toContain("abc")
  })

  test("field with number", () => {
    const out = render(field("count", 42), "cli")
    expect(out).toContain("42")
  })

  test("block joins children with newlines", () => {
    const out = render(block("test", field("a", 1), field("b", 2)), "cli")
    expect(out).toContain("\n")
    expect(out).toContain("a:")
    expect(out).toContain("b:")
  })

  test("heading renders with newline prefix", () => {
    const out = render(heading("Title"), "cli")
    expect(out).toContain("Title")
    expect(out.startsWith("\n")).toBe(true)
  })

  test("list one per line", () => {
    const out = render(simpleList, "cli")
    const lines = out.split("\n")
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe("alpha")
    expect(lines[1]).toBe("beta")
    expect(lines[2]).toBe("gamma")
  })
})

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------

describe("md", () => {
  test("text plain", () => {
    expect(render(text("hello"), "md")).toBe("hello")
  })

  test("text bold", () => {
    expect(render(text("important", "bold"), "md")).toBe("**important**")
  })

  test("text dim → italic", () => {
    expect(render(text("subtle", "dim"), "md")).toBe("*subtle*")
  })

  test("text color style → plain", () => {
    expect(render(text("red text", "red"), "md")).toBe("red text")
  })

  test("field → bold label", () => {
    expect(render(field("hash", "abc"), "md")).toBe("**hash:** abc")
  })

  test("heading → markdown heading", () => {
    expect(render(heading("Title"), "md")).toBe("## Title")
  })

  test("list → bullet items", () => {
    const out = render(simpleList, "md")
    expect(out).toBe("- alpha\n- beta\n- gamma")
  })

  test("block separates children with blank lines", () => {
    const out = render(block("sec", field("a", 1), field("b", 2)), "md")
    expect(out).toContain("\n\n")
    expect(out).toContain("**a:** 1")
    expect(out).toContain("**b:** 2")
  })

  test("full document", () => {
    const doc = block(
      "report",
      heading("Quality Report"),
      field("errors", 0),
      list(text("lint passed"), text("types passed")),
    )
    const out = render(doc, "md")
    expect(out).toContain("## Quality Report")
    expect(out).toContain("**errors:** 0")
    expect(out).toContain("- lint passed")
    expect(out).toContain("- types passed")
  })
})

// ---------------------------------------------------------------------------
// Cross-mode: same tree, four outputs
// ---------------------------------------------------------------------------

describe("polymorphic render", () => {
  test("same tree produces valid output in all modes", () => {
    const doc = block(
      "result",
      heading("Commit"),
      field("hash", "abc123"),
      field("ok", true),
      field("files", list(text("a.ts"))),
    )

    const json = render(doc, "json")
    const parsed = JSON.parse(json)
    expect(parsed.hash).toBe("abc123")
    expect(parsed.ok).toBe(true)
    expect(parsed.files).toEqual(["a.ts"])

    const xml = render(doc, "xml")
    expect(xml).toContain("<hash>abc123</hash>")
    expect(xml).toContain("<ok>true</ok>")

    const cli = render(doc, "cli")
    expect(cli).toContain("abc123")
    expect(cli).toContain("Commit")

    const md = render(doc, "md")
    expect(md).toContain("## Commit")
    expect(md).toContain("**hash:** abc123")
  })
})
