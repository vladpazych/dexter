/**
 * Markdown renderer — structured output as GitHub-flavored markdown.
 *
 * Useful for PR descriptions, documentation, and GitHub comments.
 */

import type { Node } from "./types.ts"

function renderValue(value: string | number | boolean | Node): string {
  if (typeof value !== "object") return String(value)
  return renderMd(value)
}

/** Render a node tree as markdown. */
export function renderMd(node: Node): string {
  switch (node.kind) {
    case "text":
      if (node.style === "bold") return `**${node.value}**`
      if (node.style === "dim") return `*${node.value}*`
      return node.value

    case "field": {
      const rendered = renderValue(node.value)
      if (rendered.includes("\n")) return `**${node.label}:**\n${rendered}`
      return `**${node.label}:** ${rendered}`
    }

    case "block": {
      const parts: string[] = []
      for (const child of node.children) {
        const rendered = renderMd(child)
        if (rendered) parts.push(rendered)
      }
      return parts.join("\n\n")
    }

    case "list":
      return node.items.map((item) => `- ${renderMd(item)}`).join("\n")

    case "heading":
      return `## ${node.text}`
  }
}
