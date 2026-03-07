import { basename } from "node:path"

import { block, text, render } from "../../output/index.ts"
import { readJsonStdin, getFilePath, type HookInput } from "../lib/stdin.ts"
import { findRepoRoot } from "../lib/paths.ts"
import { isSpecFile, findBrokenLinks, formatBrokenLinks } from "../lib/spec-links.ts"

function xml(name: string, content: string): string {
  return render(block(name, text(content)), "xml")
}

export async function onPostRead(): Promise<void> {
  const input = await readJsonStdin<HookInput>()
  const filePath = getFilePath(input)

  if (!filePath) return

  let root: string
  try {
    root = findRepoRoot()
  } catch {
    return
  }

  const sections: string[] = []

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

  const name = basename(filePath)
  if (name === "CLAUDE.md") {
    sections.push(xml("before-writing", "load /markdown skill · llm audience · claude-md document"))
  } else if (name === "README.md") {
    sections.push(xml("before-writing", "load /markdown skill · human audience · readme document"))
  } else if (name === "SKILL.md") {
    sections.push(xml("before-writing", "load /markdown skill · llm audience · skill document"))
  } else if (name === "OOUX.md") {
    sections.push(xml("before-writing", "load /ooux skill before modifying OOUX spec"))
  }

  if (sections.length > 0) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: sections.join("\n") + "\n",
        },
      }),
    )
  }
}
