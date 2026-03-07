/**
 * Polymorphic render dispatcher.
 */

import type { Node, OutputMode } from "./types.ts"
import { renderCli } from "./render-cli.ts"
import { renderJson } from "./render-json.ts"
import { renderXml } from "./render-xml.ts"
import { renderMd } from "./render-md.ts"

/** Render a document tree to a string in the given output mode. */
export function render(node: Node, mode: OutputMode): string {
  switch (mode) {
    case "cli":
      return renderCli(node)
    case "json":
      return renderJson(node)
    case "xml":
      return renderXml(node)
    case "md":
      return renderMd(node)
  }
}
