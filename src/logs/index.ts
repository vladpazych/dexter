import {
  createLogSession,
  type LogSessionDefaults,
  type LogSessionOptions,
  withLogRun,
} from "./session.ts"

function createLogsApi(defaults: LogSessionDefaults = {}) {
  return {
    run(options: LogSessionOptions) {
      return createLogSession({
        ...defaults,
        ...options,
        files:
          defaults.files === undefined
            ? options.files
            : { ...defaults.files, ...options.files },
      })
    },
    async withRun<T>(
      options: LogSessionOptions,
      task: (run: ReturnType<typeof createLogSession>) => Promise<T> | T,
    ) {
      return withLogRun(
        {
          ...defaults,
          ...options,
          files:
            defaults.files === undefined
              ? options.files
              : { ...defaults.files, ...options.files },
        },
        task,
      )
    },
    with(options: LogSessionDefaults) {
      return createLogsApi({
        ...defaults,
        ...options,
        files:
          defaults.files === undefined
            ? options.files
            : { ...defaults.files, ...options.files },
      })
    },
  }
}

export const logs = createLogsApi()

export type {
  LogStep,
  LogSectionRunOptions,
  LogSectionState,
  LogSession,
  LogSessionDefaults,
  LogSessionOptions,
  LogSessionResult,
  LogSessionState,
  WithRunResult,
} from "./session.ts"
export type {
  LogEvent,
  LogLevel,
  LogLineEvent,
  LogStatus,
  LogStream,
  ManualLogEntry,
  SectionEndEvent,
  SectionStartEvent,
  SessionEndEvent,
  SessionStartEvent,
} from "./schema.ts"
