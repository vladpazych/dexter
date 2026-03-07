/**
 * Control service factory — wires domain functions to ports.
 */

import type { ControlPorts } from "../ports.ts"
import type {
  CommitParams,
  CommitResult,
  QueryResult,
  GitResult,
  SetupResult,
  EvalParams,
  EvalResult,
  Package,
  TranscriptsParams,
  TranscriptsResult,
} from "../types.ts"

import { commit } from "./commit.ts"
import { rules } from "./rules.ts"
import { diff } from "./diff.ts"
import { commits } from "./commits.ts"
import { lint } from "./lint.ts"
import { typecheck } from "./typecheck.ts"
import { test } from "./test.ts"
import { blame } from "./blame.ts"
import { pickaxe } from "./pickaxe.ts"
import { bisect } from "./bisect.ts"
import { setup } from "./setup.ts"
import { evaluate } from "./eval.ts"
import { transcripts } from "./transcripts.ts"
import { discoverPackages } from "./workspace.ts"

export type ControlService = {
  commit(params: CommitParams): Promise<CommitResult>
  rules(scopes: string[]): QueryResult
  diff(scopes: string[]): QueryResult
  commits(scopes: string[]): QueryResult
  lint(scopes: string[], opts?: { changed?: boolean }): Promise<QueryResult>
  typecheck(scopes: string[]): Promise<QueryResult>
  test(scopes: string[]): Promise<QueryResult>
  blame(file: string, lines?: [number, number]): GitResult
  pickaxe(pattern: string, opts?: { regex?: boolean; scopes?: string[] }): GitResult
  bisect(test: string, good: string, bad?: string, timeout?: number): Promise<GitResult>
  setup(): SetupResult
  eval(params: EvalParams): Promise<EvalResult>
  transcripts(params: TranscriptsParams): TranscriptsResult
  discoverPackages(): Package[]
}

export function createControlService(ports: ControlPorts): ControlService {
  return {
    commit: (params) => commit(ports, params),
    rules: (scopes) => rules(ports, scopes),
    diff: (scopes) => diff(ports, scopes),
    commits: (scopes) => commits(ports, scopes),
    lint: (scopes, opts) => lint(ports, scopes, opts),
    typecheck: (scopes) => typecheck(ports, scopes),
    test: (scopes) => test(ports, scopes),
    blame: (file, lines) => blame(ports, file, lines),
    pickaxe: (pattern, opts) => pickaxe(ports, pattern, opts),
    bisect: (testCmd, good, bad, timeout) => bisect(ports, testCmd, good, bad, timeout),
    setup: () => setup(ports),
    eval: (params) => evaluate(ports, params),
    transcripts: (params) => transcripts(ports, params),
    discoverPackages: () => discoverPackages(ports),
  }
}
