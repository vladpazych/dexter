/**
 * Query: test — run bun test with explicit test file paths.
 */

import type { ControlPorts } from "../ports.ts"
import type { QueryResult, Package } from "../types.ts"
import { discoverPackages, filterByFiles, filterByScript } from "./workspace.ts"
import { extractErrors } from "./format.ts"

export async function test(ports: ControlPorts, scopes: string[]): Promise<QueryResult> {
  const packages = discoverPackages(ports)

  const { FORCE_COLOR: _, ...parentEnv } = process.env as Record<string, string>
  const env: Record<string, string> = { ...parentEnv, NO_COLOR: "1" }

  if (scopes.length === 0) {
    const withTest = filterByScript(packages, "test")
    if (withTest.length === 0) {
      return { what: "test", scopes, data: { errorCount: 0, errors: [], raw: "" } }
    }
    const results = await Promise.all(withTest.map((pkg) => runTestScript(ports, pkg, env)))
    const raw = results.filter(Boolean).join("\n")
    return { what: "test", scopes, data: extractErrors(raw) }
  }

  const affected = filterByFiles(packages, scopes, ports.root)

  if (affected.length === 0) {
    return { what: "test", scopes, data: { errorCount: 0, errors: [], raw: "" } }
  }

  const results = await Promise.all(
    affected.map((pkg) => {
      const testFiles = scopes.filter((s) => s.startsWith(pkg.relDir + "/"))
      return runTests(ports, pkg, testFiles, env)
    }),
  )

  const raw = results.filter(Boolean).join("\n")
  return { what: "test", scopes, data: extractErrors(raw) }
}

function runTestScript(ports: ControlPorts, pkg: Package, env: Record<string, string>): Promise<string> {
  return new Promise((resolve) => {
    const lines: string[] = []
    const handle = ports.process.spawn({ cmd: "bun", args: ["run", "test"], cwd: pkg.dir, env })
    handle.onLine("stdout", (line) => lines.push(line))
    handle.onLine("stderr", (line) => lines.push(line))
    handle.wait().then(() => resolve(lines.join("\n")))
  })
}

function runTests(
  ports: ControlPorts,
  pkg: Package,
  testFiles: string[],
  env: Record<string, string>,
): Promise<string> {
  return new Promise((resolve) => {
    const lines: string[] = []
    const relFiles = testFiles.map((f) => f.slice(pkg.relDir.length + 1))
    const handle = ports.process.spawn({
      cmd: "bun",
      args: ["test", ...relFiles],
      cwd: pkg.dir,
      env,
    })
    handle.onLine("stdout", (line) => lines.push(line))
    handle.onLine("stderr", (line) => lines.push(line))
    handle.wait().then(() => resolve(lines.join("\n")))
  })
}
