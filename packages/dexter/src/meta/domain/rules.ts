/**
 * Query: rules — governing CLAUDE.md cascade for given scopes.
 */

import type { ControlPorts } from "../ports.ts"
import type { QueryResult, RulesScope } from "../types.ts"
import { resolveCascade, scopeToDir } from "./scope-context.ts"

export function rules(ports: ControlPorts, scopes: string[]): QueryResult {
  const data: RulesScope[] = []

  for (const scope of scopes) {
    const dir = scopeToDir(scope)
    const cascade = resolveCascade(ports, dir)
    if (cascade.length > 0) {
      data.push({ path: scope, cascade })
    }
  }

  return { what: "rules", scopes, data }
}
