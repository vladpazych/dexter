/**
 * Builder functions — construct document trees from domain data.
 *
 * Pure functions returning immutable nodes.
 */

import type { BlockNode, FieldNode, HeadingNode, ListNode, Node, Primitive, Style, TextNode } from "./types.ts"

/** Styled text content. */
export function text(value: string, style?: Style): TextNode {
  return style ? { kind: "text", value, style } : { kind: "text", value }
}

/** Key-value pair. Primitives preserved for JSON type fidelity. */
export function field(label: string, value: Primitive | Node): FieldNode {
  return { kind: "field", label, value }
}

function isNode(x: unknown): x is Node {
  return typeof x === "object" && x !== null && "kind" in x
}

/**
 * Semantic container with tag and optional attributes.
 *
 * ```ts
 * block("commit", field("hash", "abc"))
 * block("scope", { path: "meta/src" }, field("status", "clean"))
 * ```
 */
export function block(tag: string, ...args: (Node | Record<string, string>)[]): BlockNode {
  if (args.length > 0 && args[0] !== undefined && !isNode(args[0])) {
    return { kind: "block", tag, attrs: args[0] as Record<string, string>, children: args.slice(1) as Node[] }
  }
  return { kind: "block", tag, children: args as Node[] }
}

/**
 * Ordered collection. Optional tag names individual items in XML.
 *
 * ```ts
 * list(text("a.ts"), text("b.ts"))
 * list("file", text("a.ts"), text("b.ts"))  // XML: <file>a.ts</file><file>b.ts</file>
 * ```
 */
export function list(...args: (string | Node)[]): ListNode {
  if (typeof args[0] === "string") {
    return { kind: "list", tag: args[0], items: args.slice(1) as Node[] }
  }
  return { kind: "list", items: args as Node[] }
}

/** Display heading — renders in CLI and Markdown, omitted in JSON and XML. */
export function heading(value: string): HeadingNode {
  return { kind: "heading", text: value }
}
