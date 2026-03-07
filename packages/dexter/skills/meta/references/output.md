# Output Primitives

Build a document tree once, render it in any format. Consumers import everything from `@vladpazych/dexter/meta`.

## Node types

Five node kinds form a polymorphic tree:

| Builder | Creates | Purpose |
|:--------|:--------|:--------|
| `text(value, style?)` | TextNode | Styled content. Styles: bold, dim, red, green, yellow, blue, cyan, magenta, gray |
| `field(label, value)` | FieldNode | Key-value pair. Value can be primitive or Node |
| `block(tag, ...children)` | BlockNode | Semantic container with tag and optional attrs |
| `list(tag?, ...items)` | ListNode | Ordered collection. Optional tag names items in XML |
| `heading(text)` | HeadingNode | Display heading (CLI/MD only, omitted in JSON/XML) |

## Render modes

| Mode | Flag | Produces |
|:-----|:-----|:---------|
| cli | (default) | ANSI-styled terminal output |
| json | `--json` | Structured JSON |
| xml | `--xml` | XML document |
| md | `--md` | Markdown |

All modes available via `--format <mode>` or shorthand `--json`, `--xml`, `--md`.

## Using in custom commands

```ts
import { block, field, list, text, heading, type HookContext } from "@vladpazych/dexter/meta"

export async function status(args: string[], ctx: HookContext) {
  const node = block("status",
    heading("Service Status"),
    block("api",
      field("url", "https://api.example.com"),
      field("health", text("healthy", "green")),
      field("latency", "12ms"),
    ),
    block("db",
      field("url", "postgres://..."),
      field("health", text("degraded", "yellow")),
      field("connections", 42),
    ),
    field("services", list("service", text("api"), text("db"), text("cache"))),
  )

  // ctx.render uses the active --format flag
  console.log(ctx.render(node))
}
```

### CLI output (default)

```
Service Status
api
  url: https://api.example.com
  health: healthy
  latency: 12ms
db
  url: postgres://...
  health: degraded
  connections: 42
services: api, db, cache
```

### JSON output (`--json`)

```json
{
  "tag": "status",
  "api": { "url": "https://api.example.com", "health": "healthy", "latency": "12ms" },
  "db": { "url": "postgres://...", "health": "degraded", "connections": 42 },
  "services": ["api", "db", "cache"]
}
```

### XML output (`--xml`)

```xml
<status>
  <api url="https://api.example.com"><health>healthy</health><latency>12ms</latency></api>
  <db url="postgres://..."><health>degraded</health><connections>42</connections></db>
  <services><service>api</service><service>db</service><service>cache</service></services>
</status>
```

## Using ctx fields

```ts
ctx.mode          // "cli" | "json" | "xml" | "md" — the parsed output mode
ctx.render(node)  // shorthand for render(node, ctx.mode)
ctx.root          // repo root path
ctx.service       // ControlService — commit, lint, typecheck, test, diff, etc.
```

## Using with ControlService

Combine service results with custom presentation:

```ts
export async function check(args: string[], ctx: HookContext) {
  const lint = await ctx.service.lint(["."], { changed: true })
  const tc = await ctx.service.typecheck(["."])
  const node = block("check",
    field("lint-errors", lint.what === "lint" ? lint.data.errorCount : 0),
    field("type-errors", tc.what === "typecheck" ? tc.data.errorCount : 0),
  )
  console.log(ctx.render(node))
}
```
