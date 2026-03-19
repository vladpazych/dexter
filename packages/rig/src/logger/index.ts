export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal"

export type LogFields = Record<string, unknown>

export type LogEvent = {
  timestamp: number
  level: LogLevel
  logger: string | null
  message: string
  fields: LogFields
}

export type LogSink = {
  write: (event: LogEvent) => void
}

export type LoggerOptions = {
  name?: string
  level?: LogLevel
  fields?: LogFields
  sinks?: LogSink[]
}

type LoggerApi = {
  log: (level: LogLevel, message: string, fields?: LogFields) => LogEvent | null
  trace: (message: string, fields?: LogFields) => LogEvent | null
  debug: (message: string, fields?: LogFields) => LogEvent | null
  info: (message: string, fields?: LogFields) => LogEvent | null
  warn: (message: string, fields?: LogFields) => LogEvent | null
  error: (message: string, fields?: LogFields) => LogEvent | null
  fatal: (message: string, fields?: LogFields) => LogEvent | null
  with: (options: LoggerOptions) => LoggerApi
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}

function shouldWrite(activeLevel: LogLevel, level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[activeLevel]
}

function mergeFields(
  base: LogFields | undefined,
  next: LogFields | undefined,
): LogFields {
  if (base === undefined && next === undefined) {
    return {}
  }

  if (base === undefined) {
    return { ...next }
  }

  if (next === undefined) {
    return { ...base }
  }

  return { ...base, ...next }
}

function mergeLoggerName(
  base: string | undefined,
  next: string | undefined,
): string | undefined {
  if (next === undefined) {
    return base
  }

  if (base === undefined || base.length === 0) {
    return next
  }

  return `${base}.${next}`
}

function createLoggerApi(options: LoggerOptions = {}): LoggerApi {
  const activeLevel = options.level ?? "info"
  const baseFields = options.fields
  const sinks = options.sinks ?? []
  const loggerName = options.name ?? null

  const write = (
    level: LogLevel,
    message: string,
    fields?: LogFields,
  ): LogEvent | null => {
    if (!shouldWrite(activeLevel, level)) {
      return null
    }

    const event: LogEvent = {
      timestamp: Date.now(),
      level,
      logger: loggerName,
      message,
      fields: mergeFields(baseFields, fields),
    }

    for (const sink of sinks) {
      sink.write(event)
    }

    return event
  }

  return {
    log(level, message, fields) {
      return write(level, message, fields)
    },
    trace(message, fields) {
      return write("trace", message, fields)
    },
    debug(message, fields) {
      return write("debug", message, fields)
    },
    info(message, fields) {
      return write("info", message, fields)
    },
    warn(message, fields) {
      return write("warn", message, fields)
    },
    error(message, fields) {
      return write("error", message, fields)
    },
    fatal(message, fields) {
      return write("fatal", message, fields)
    },
    with(next) {
      return createLoggerApi({
        name: mergeLoggerName(options.name, next.name),
        level: next.level ?? options.level,
        fields: mergeFields(options.fields, next.fields),
        sinks: next.sinks ?? sinks,
      })
    },
  }
}

const loggerApi = createLoggerApi()

export { loggerApi as logger }
