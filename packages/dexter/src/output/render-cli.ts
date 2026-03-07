/**
 * CLI renderer — colored terminal output respecting NO_COLOR/FORCE_COLOR.
 *
 * Uses the existing `c` convenience object from terminal/colors.
 */

import type { Node, Style } from "./types.ts"
import { c } from "../terminal/colors.ts"

const styleFn: Record<Style, (text: string) => string> = {
  bold: c.bolded,
  dim: c.dimmed,
  red: c.red,
  green: c.green,
  yellow: c.yellow,
  blue: c.blue,
  cyan: c.cyan,
  magenta: c.magenta,
  gray: c.gray,
}

function renderValue(value: string | number | boolean | Node): string {
  if (typeof value !== "object") return String(value)
  return renderCli(value)
}

/** Render a node tree as colored CLI output. */
export function renderCli(node: Node): string {
  switch (node.kind) {
    case "text":
      return node.style ? styleFn[node.style](node.value) : node.value

    case "field": {
      const label = c.dimmed(`${node.label}:`)
      const rendered = renderValue(node.value)
      if (rendered.includes("\n")) return `${label}\n${rendered}`
      return `${label} ${rendered}`
    }

    case "block": {
      const parts: string[] = []
      for (const child of node.children) {
        const rendered = renderCli(child)
        if (rendered) parts.push(rendered)
      }
      return parts.join("\n")
    }

    case "list":
      return node.items.map(renderCli).join("\n")

    case "heading":
      return `\n${c.bolded(node.text)}`
  }
}
