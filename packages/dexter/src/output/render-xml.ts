/**
 * XML renderer — semantic tags for hooks and skill preprocessing.
 *
 * Flat output (no indentation) to keep content compact for LLM consumption.
 */

import type { Node } from "./types.ts"

export function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function renderValue(value: string | number | boolean | Node): string {
  if (typeof value !== "object") return escapeXml(String(value))
  return renderXml(value)
}

function attrs(record: Readonly<Record<string, string>>): string {
  const pairs = Object.entries(record).map(([k, v]) => `${k}="${escapeXml(v)}"`)
  return pairs.length > 0 ? " " + pairs.join(" ") : ""
}

/** Render a node tree as XML. */
export function renderXml(node: Node): string {
  switch (node.kind) {
    case "text":
      return escapeXml(node.value)

    case "field": {
      const inner = renderValue(node.value)
      if (inner.includes("\n")) {
        return `<${node.label}>\n${inner}\n</${node.label}>`
      }
      return `<${node.label}>${inner}</${node.label}>`
    }

    case "block": {
      const attrStr = node.attrs ? attrs(node.attrs) : ""
      const children = node.children.filter((c) => c.kind !== "heading").map(renderXml)
      const inner = children.join("\n")
      if (!inner) return `<${node.tag}${attrStr} />`
      return `<${node.tag}${attrStr}>\n${inner}\n</${node.tag}>`
    }

    case "list": {
      if (node.tag) {
        return node.items.map((item) => `<${node.tag}>${renderXml(item)}</${node.tag}>`).join("\n")
      }
      return node.items.map(renderXml).join("\n")
    }

    case "heading":
      return ""
  }
}
