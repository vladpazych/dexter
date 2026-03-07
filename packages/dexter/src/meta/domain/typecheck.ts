/**
 * Query: typecheck — run tsc across workspace packages matching scope.
 */

import type { ControlPorts } from "../ports.ts"
import type { QueryResult } from "../types.ts"
import { discoverPackages, filterByScript } from "./workspace.ts"
import { extractErrors } from "./format.ts"

export async function typecheck(ports: ControlPorts, scopes: string[]): Promise<QueryResult> {
  const packages = discoverPackages(ports)

  const matching =
    scopes.length === 0
      ? packages
      : packages.filter((pkg) => scopes.some((s) => pkg.relDir.startsWith(s) || s.startsWith(pkg.relDir + "/")))
  const withScript = filterByScript(matching, "typecheck")

  if (withScript.length === 0) {
    return { what: "typecheck", scopes, data: { errorCount: 0, errors: [], raw: "" } }
  }

  const { FORCE_COLOR: _, ...parentEnv } = process.env as Record<string, string>
  const env: Record<string, string> = { ...parentEnv, NO_COLOR: "1" }

  const results = await Promise.all(
    withScript.map(
      (pkg) =>
        new Promise<string>((resolve) => {
          const lines: string[] = []
          const handle = ports.process.spawn({ cmd: "bun", args: ["run", "typecheck"], cwd: pkg.dir, env })
          handle.onLine("stdout", (line) => lines.push(line))
          handle.onLine("stderr", (line) => lines.push(line))
          handle.wait().then(() => resolve(lines.join("\n")))
        }),
    ),
  )

  const raw = results.filter(Boolean).join("\n")
  return { what: "typecheck", scopes, data: extractErrors(raw) }
}
