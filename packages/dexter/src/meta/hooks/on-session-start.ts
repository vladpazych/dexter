import { resolve } from "node:path"
import { findRepoRoot } from "../lib/paths.ts"

export async function onSessionStart(): Promise<void> {
  let root: string
  try {
    root = findRepoRoot()
  } catch {
    return
  }

  // Check if meta/run exists — only inject context for repos that use dexter
  const metaRun = Bun.file(resolve(root, "meta/run"))
  if (!(await metaRun.exists())) return

  // Read CONTEXT.md from the plugin package root (three levels up from src/meta/hooks/)
  const contextPath = resolve(import.meta.dir, "..", "..", "..", "CONTEXT.md")
  const contextFile = Bun.file(contextPath)

  if (!(await contextFile.exists())) return

  const content = await contextFile.text()

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: content,
      },
    }),
  )
}
