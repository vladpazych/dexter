import { readdirSync, rmSync } from "node:fs"
import { join } from "node:path"

const paths = [
  ".test-build",
  "packages/rig/dist",
  "packages/rig-logger-sinks/dist",
]

for (const path of paths) {
  rmSync(path, { recursive: true, force: true })
}

function removeGeneratedSourceArtifacts(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)

    if (entry.isDirectory()) {
      removeGeneratedSourceArtifacts(path)
      continue
    }

    if (path.endsWith(".js") || path.endsWith(".d.ts")) {
      rmSync(path, { force: true })
    }
  }
}

removeGeneratedSourceArtifacts("packages/rig/src")
removeGeneratedSourceArtifacts("packages/rig-logger-sinks/src")
