import { runProcess, spawnProcess } from "./spawn.js"
import type { ProcessSpawnOptions } from "./types.js"

type ProcessDefaults = {
  cwd?: string
  env?: Record<string, string>
}

function mergeDefaults<T extends ProcessSpawnOptions>(
  defaults: ProcessDefaults,
  options: T,
): T {
  return {
    ...options,
    cwd: options.cwd ?? defaults.cwd,
    env:
      defaults.env === undefined
        ? options.env
        : { ...defaults.env, ...options.env },
  }
}

function createProcessApi(defaults: ProcessDefaults = {}) {
  return {
    spawn(options: ProcessSpawnOptions) {
      return spawnProcess(mergeDefaults(defaults, options))
    },
    async run(options: ProcessSpawnOptions) {
      return runProcess(mergeDefaults(defaults, options))
    },
    with(options: ProcessDefaults) {
      return createProcessApi({
        cwd: options.cwd ?? defaults.cwd,
        env:
          defaults.env === undefined
            ? options.env
            : { ...defaults.env, ...options.env },
      })
    },
  }
}

const processApi = createProcessApi()

export { processApi as process }
export type {
  ProcessHandle,
  ProcessLine,
  ProcessResult,
  ProcessSpawnOptions,
  ProcessStart,
} from "./types.js"
