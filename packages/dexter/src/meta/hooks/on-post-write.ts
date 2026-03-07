import { block, text, render } from "../../output/index.ts"
import { getFilePath, type HookInput } from "../lib/stdin.ts"
import { shouldLint, runESLint } from "../lib/eslint.ts"
import { findRepoRoot, isInsideRepo } from "../lib/paths.ts"
import { isSpecFile, findBrokenLinks, formatBrokenLinks } from "../lib/spec-links.ts"

function xml(name: string, content: string): string {
  return render(block(name, text(content)), "xml")
}

/** Collect core post-write context sections. Returns array of XML strings. */
export async function collectPostWriteContext(input: HookInput | null): Promise<string[]> {
  const filePath = getFilePath(input)
  if (!filePath) return []

  let root: string
  try {
    root = findRepoRoot()
  } catch {
    return []
  }

  if (!isInsideRepo(filePath, root)) return []

  const sections: string[] = []

  if (shouldLint(filePath)) {
    try {
      const remaining = runESLint(filePath)
      if (remaining) {
        sections.push(xml("lint", remaining))
      }
    } catch {
      // ESLint might not be available or fail
    }
  }

  if (isSpecFile(filePath)) {
    try {
      const content = await Bun.file(filePath).text()
      const broken = findBrokenLinks(filePath, content, root)

      if (broken.length > 0) {
        sections.push(xml("spec-links", formatBrokenLinks(broken)))
      }
    } catch {
      // File might have been deleted or unreadable
    }
  }

  sections.push(xml("commit", `commit in meaningful chunks · bun run meta/index.ts commit "<reason>" <files>`))

  return sections
}
