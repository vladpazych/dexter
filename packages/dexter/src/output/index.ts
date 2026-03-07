/**
 * Polymorphic output — build once, render to any format.
 */

// Types
export type {
  BlockNode,
  FieldNode,
  HeadingNode,
  ListNode,
  Node,
  OutputMode,
  Primitive,
  Style,
  TextNode,
} from "./types.ts"

// Builders
export { block, field, heading, list, text } from "./build.ts"

// Renderers
export { render } from "./render.ts"
export { toValue } from "./render-json.ts"
export { escapeXml } from "./render-xml.ts"
