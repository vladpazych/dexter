/**
 * JSON renderer — converts document tree to structured JavaScript values.
 *
 * `toValue` produces a JS value (object/array/string/number/boolean).
 * `renderJson` stringifies it.
 */

import type { Node } from "./types.ts"

/** Convert a node tree to a JSON-compatible JavaScript value. */
export function toValue(node: Node): unknown {
  switch (node.kind) {
    case "text":
      return node.value

    case "field":
      // Standalone field → single-entry object
      return { [node.label]: fieldValue(node.value) }

    case "block":
      return blockValue(node)

    case "list":
      return node.items.map(toValue)

    case "heading":
      return undefined
  }
}

function fieldValue(value: string | number | boolean | Node): unknown {
  if (typeof value !== "object") return value
  return toValue(value)
}

function blockValue(node: Extract<Node, { kind: "block" }>): unknown {
  const fields: [string, unknown][] = []
  const content: unknown[] = []

  // Attrs become top-level properties
  if (node.attrs) {
    for (const [k, v] of Object.entries(node.attrs)) {
      fields.push([k, v])
    }
  }

  for (const child of node.children) {
    if (child.kind === "field") {
      fields.push([child.label, fieldValue(child.value)])
    } else if (child.kind === "heading") {
      // Omitted in JSON
    } else if (child.kind === "block") {
      fields.push([child.tag, blockValue(child)])
    } else {
      content.push(toValue(child))
    }
  }

  // All fields → object
  if (fields.length > 0 && content.length === 0) {
    return Object.fromEntries(fields)
  }

  // All non-fields → array (or single value)
  if (fields.length === 0) {
    if (content.length === 1) return content[0]
    return content
  }

  // Mixed → object with content key
  const obj = Object.fromEntries(fields)
  obj.content = content
  return obj
}

/** Render a node tree as a compact JSON string. */
export function renderJson(node: Node): string {
  const value = toValue(node)
  return JSON.stringify(value)
}
