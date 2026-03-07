import { resolve } from "node:path"
import { findRepoRoot } from "../lib/paths.ts"

/** Collect core session-start context sections. Returns array of context strings. */
export async function collectSessionStartContext(): Promise<string[]> {
  let root: string
  try {
    root = findRepoRoot()
  } catch {
    return []
  }

  // Check if meta/index.ts exists — only inject context for repos that use dexter
  const metaIndex = Bun.file(resolve(root, "meta/index.ts"))
  if (!(await metaIndex.exists())) return []

  // Read CONTEXT.md from the plugin package root (three levels up from src/meta/hooks/)
  const contextPath = resolve(import.meta.dir, "..", "..", "..", "CONTEXT.md")
  const contextFile = Bun.file(contextPath)

  if (!(await contextFile.exists())) return []

  const content = await contextFile.text()
  return [content]
}
