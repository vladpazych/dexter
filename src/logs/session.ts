import { appendFileSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

import { pipeAndWait } from "../pipe/spawn.ts"
import type { PipeResult, PipeSink, PipeSpawnOptions } from "../pipe/types.ts"
import {
  renderLogLine,
  renderLogSection,
  renderLogSummary,
  type LogRenderOptions,
  type LogSummary,
} from "./render.ts"
import { stripAnsi } from "../terminal/colors.ts"
import {
  logEventSchema,
  logStatusSchema,
  manualLogEntrySchema,
  type LogEvent,
  type LogLevel,
  type LogLineEvent,
  type LogStatus,
  type ManualLogEntry,
  type ManualLogInput,
  type SectionEndEvent,
  type SectionStartEvent,
  type SessionEndEvent,
  type SessionStartEvent,
} from "./schema.ts"

type LogFileOptions = {
  manifest?: string | false
  events?: string | false
  combined?: string | false
  sections?: string | false
}

type LogConsoleOptions =
  | boolean
  | (LogRenderOptions & { stream?: NodeJS.WriteStream })

export type LogSessionOptions = {
  name: string
  cwd?: string
  root?: string
  runId?: string
  console?: LogConsoleOptions
  files?: LogFileOptions
}

export type LogSessionDefaults = Omit<LogSessionOptions, "name" | "runId">

export type LogSectionState = {
  name: string
  startedAt: number
  endedAt?: number
  status: LogStatus
  exitCode: number | null
  lines: number
}

export type LogSessionState = {
  name: string
  runId: string
  dir: string
  cwd: string
  startedAt: number
  endedAt?: number
  status: LogStatus
  sections: LogSectionState[]
}

export type LogSessionResult = LogSessionState & {
  files: {
    manifest: string | null
    events: string | null
    combined: string | null
    sections: string | null
  }
}

export type LogSectionRunOptions = Omit<
  PipeSpawnOptions,
  "session" | "section" | "onEvent" | "source" | "sink"
> & {
  source?: string
}

type LogWriter = {
  log: (
    level: LogLevel,
    message: string,
    fields?: Record<string, unknown>,
  ) => LogLineEvent
  trace: (message: string, fields?: Record<string, unknown>) => LogLineEvent
  debug: (message: string, fields?: Record<string, unknown>) => LogLineEvent
  info: (message: string, fields?: Record<string, unknown>) => LogLineEvent
  warn: (message: string, fields?: Record<string, unknown>) => LogLineEvent
  error: (message: string, fields?: Record<string, unknown>) => LogLineEvent
  fatal: (message: string, fields?: Record<string, unknown>) => LogLineEvent
}

export type LogStep = LogWriter & {
  name: string
  exec: (options: LogSectionRunOptions) => Promise<PipeResult>
  write: (entry: Omit<ManualLogInput, "section">) => LogLineEvent
}

export type LogSession = LogWriter & {
  name: string
  runId: string
  dir: string
  state: () => LogSessionState
  step: (name: string) => LogStep
  write: (entry: ManualLogInput) => LogLineEvent
  close: () => LogSessionResult
}

export type WithRunResult<T> = {
  value: Awaited<T>
  result: LogSessionResult
}

type InternalSession = {
  name: string
  runId: string
  dir: string
  cwd: string
  startedAt: number
  status: LogStatus
  sections: Map<string, LogSectionState>
  console: {
    enabled: boolean
    stream: NodeJS.WriteStream
    render: LogRenderOptions
  }
  files: {
    manifest: string | null
    events: string | null
    combined: string | null
    sections: string | null
  }
  closed: boolean
}

const DEFAULT_FILES: Required<LogFileOptions> = {
  manifest: "run.json",
  events: "events.ndjson",
  combined: "run.log",
  sections: "sections/{section}.log",
}

function createRunId(now: number): string {
  const date = new Date(now).toISOString().replaceAll(":", "-")
  return `${date}-${process.pid.toString()}`
}

function sanitizeSegment(value: string): string {
  const trimmed = value.trim()
  const replaced = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-")
  const collapsed = replaced.replace(/-+/g, "-").replace(/^-|-$/g, "")
  return collapsed || "log"
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`
  }

  return `${(durationMs / 1000).toFixed(1)}s`
}

function formatFieldPairs(fields: Record<string, unknown>): string {
  const pairs: string[] = []

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue
    }

    const raw = typeof value === "string" ? value : JSON.stringify(value)
    if (raw === undefined) {
      continue
    }

    pairs.push(`${key}=${raw}`)
  }

  return pairs.join(" ")
}

function formatTextLine(event: LogLineEvent): string {
  const time = new Date(event.timestamp).toISOString().slice(11, 19)
  const scope = event.section ?? event.source
  const kv = formatFieldPairs(event.fields)
  const message = stripAnsi(event.message)
  const suffix = kv ? ` ${kv}` : ""
  return `${time} ${scope} ${message}${suffix}`
}

function formatSessionStart(event: SessionStartEvent): string {
  return `session ${event.session} start run=${event.runId} cwd=${event.cwd}`
}

function formatSectionStart(event: SectionStartEvent): string {
  return `section ${event.section} start`
}

function formatSectionEnd(event: SectionEndEvent): string {
  const exit =
    event.exitCode === null ? "" : ` exit=${event.exitCode.toString()}`
  return `section ${event.section} ${event.status} ${formatDuration(
    event.durationMs,
  )}${exit}`
}

function formatSessionEnd(event: SessionEndEvent): string {
  return `session ${event.session} ${event.status} ${formatDuration(
    event.durationMs,
  )}`
}

function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
}

function resolveFiles(
  dir: string,
  files?: LogFileOptions,
): InternalSession["files"] {
  const merged: Required<LogFileOptions> = {
    manifest:
      files?.manifest === undefined ? DEFAULT_FILES.manifest : files.manifest,
    events: files?.events === undefined ? DEFAULT_FILES.events : files.events,
    combined:
      files?.combined === undefined ? DEFAULT_FILES.combined : files.combined,
    sections:
      files?.sections === undefined ? DEFAULT_FILES.sections : files.sections,
  }

  return {
    manifest: merged.manifest === false ? null : resolve(dir, merged.manifest),
    events: merged.events === false ? null : resolve(dir, merged.events),
    combined: merged.combined === false ? null : resolve(dir, merged.combined),
    sections: merged.sections === false ? null : resolve(dir, merged.sections),
  }
}

function resolveConsole(
  options: LogConsoleOptions | undefined,
): InternalSession["console"] {
  if (options === false) {
    return {
      enabled: false,
      stream: process.stdout,
      render: {},
    }
  }

  if (options === true || options === undefined) {
    return {
      enabled: true,
      stream: process.stdout,
      render: {},
    }
  }

  return {
    enabled: true,
    stream: options.stream ?? process.stdout,
    render: {
      color: options.color,
      width: options.width,
    },
  }
}

function writeLine(path: string | null, line: string): void {
  if (path === null) {
    return
  }

  ensureParent(path)
  appendFileSync(path, `${line}\n`)
}

function createSectionFilePath(
  sectionsPattern: string | null,
  section: string,
): string | null {
  if (sectionsPattern === null) {
    return null
  }

  return sectionsPattern.replace("{section}", sanitizeSegment(section))
}

function writeConsole(session: InternalSession, line: string): void {
  if (!session.console.enabled) {
    return
  }

  session.console.stream.write(`${line}\n`)
}

function sortedSections(
  sections: Map<string, LogSectionState>,
): LogSectionState[] {
  return [...sections.values()].sort(
    (left, right) => left.startedAt - right.startedAt,
  )
}

function createSessionStartEvent(session: InternalSession): SessionStartEvent {
  return {
    type: "session:start",
    timestamp: session.startedAt,
    session: session.name,
    section: null,
    source: session.name,
    runId: session.runId,
    cwd: session.cwd,
  }
}

function writeEvent(session: InternalSession, event: LogEvent): void {
  logEventSchema.parse(event)

  writeLine(session.files.events, JSON.stringify(event))

  switch (event.type) {
    case "line":
      writeLine(session.files.combined, formatTextLine(event))
      if (event.section !== null) {
        writeLine(
          createSectionFilePath(session.files.sections, event.section),
          formatTextLine(event),
        )
      }
      writeConsole(session, renderLogLine(event, session.console.render))
      break
    case "section:start":
      writeLine(session.files.combined, formatSectionStart(event))
      writeLine(
        createSectionFilePath(
          session.files.sections,
          event.section ?? event.source,
        ),
        formatSectionStart(event),
      )
      writeConsole(session, renderLogSection(event, session.console.render))
      break
    case "section:end":
      writeLine(session.files.combined, formatSectionEnd(event))
      writeLine(
        createSectionFilePath(
          session.files.sections,
          event.section ?? event.source,
        ),
        formatSectionEnd(event),
      )
      writeConsole(session, renderLogSection(event, session.console.render))
      break
    case "session:start":
      writeLine(session.files.combined, formatSessionStart(event))
      break
    case "session:end":
      writeLine(session.files.combined, formatSessionEnd(event))
      break
  }
}

function createLineEvent(
  session: InternalSession,
  entry: ManualLogEntry,
): LogLineEvent {
  return {
    type: "line",
    timestamp: entry.timestamp ?? Date.now(),
    session: session.name,
    section: entry.section ?? null,
    source: entry.source ?? session.name,
    stream: "manual",
    level: entry.level,
    message: entry.message,
    fields: entry.fields,
    raw: entry.message,
    lineNumber: 0,
  }
}

function createWriter(
  write: (entry: ManualLogInput) => LogLineEvent,
): LogWriter {
  return {
    log(level, message, fields) {
      return write({ level, message, fields })
    },
    trace(message, fields) {
      return write({ level: "trace", message, fields })
    },
    debug(message, fields) {
      return write({ level: "debug", message, fields })
    },
    info(message, fields) {
      return write({ level: "info", message, fields })
    },
    warn(message, fields) {
      return write({ level: "warn", message, fields })
    },
    error(message, fields) {
      return write({ level: "error", message, fields })
    },
    fatal(message, fields) {
      return write({ level: "fatal", message, fields })
    },
  }
}

function setSessionStatus(session: InternalSession, status: LogStatus): void {
  if (session.status === "failed") {
    return
  }

  if (status === "failed") {
    session.status = "failed"
    return
  }

  if (session.status === "running") {
    session.status = status
  }
}

function createSectionStart(
  session: InternalSession,
  name: string,
  startedAt: number,
): SectionStartEvent {
  return {
    type: "section:start",
    timestamp: startedAt,
    session: session.name,
    section: name,
    source: name,
  }
}

function createSectionEnd(
  session: InternalSession,
  state: LogSectionState,
): SectionEndEvent {
  return {
    type: "section:end",
    timestamp: state.endedAt ?? Date.now(),
    session: session.name,
    section: state.name,
    source: state.name,
    status: state.status,
    durationMs: (state.endedAt ?? Date.now()) - state.startedAt,
    exitCode: state.exitCode,
  }
}

function createSessionApi(session: InternalSession): LogSession {
  const sectionNames = new Set<string>()

  const getSectionState = (name: string): LogSectionState => {
    const existing = session.sections.get(name)
    if (existing !== undefined) {
      return existing
    }

    if (sectionNames.has(name)) {
      throw new Error(`Section ${name} is already in use.`)
    }

    sectionNames.add(name)
    const state: LogSectionState = {
      name,
      startedAt: 0,
      status: "running",
      exitCode: null,
      lines: 0,
    }
    session.sections.set(name, state)
    return state
  }

  const startSection = (name: string): LogSectionState => {
    const state = getSectionState(name)

    if (state.startedAt > 0) {
      if (state.endedAt === undefined) {
        return state
      }

      throw new Error(`Section ${name} has already started.`)
    }

    state.startedAt = Date.now()
    state.status = "running"
    writeEvent(session, createSectionStart(session, name, state.startedAt))
    return state
  }

  const endSection = (
    state: LogSectionState,
    result: PipeResult,
  ): SectionEndEvent => {
    state.endedAt = Date.now()
    state.exitCode = result.exitCode
    state.status =
      result.error !== undefined || result.exitCode !== 0 ? "failed" : "passed"
    if (state.status === "failed") {
      session.status = "failed"
    }
    const event = createSectionEnd(session, state)
    writeEvent(session, event)
    return event
  }

  const writeManual = (entry: ManualLogInput): LogLineEvent => {
    const parsed = manualLogEntrySchema.parse(entry)
    const event = createLineEvent(session, parsed)
    if (parsed.section !== undefined) {
      const section = session.sections.get(parsed.section)
      if (section !== undefined) {
        section.lines += 1
      }
    }
    writeEvent(session, event)
    return event
  }

  const createStep = (name: string): LogStep => {
    const writeStep = (
      entry: Omit<ManualLogInput, "section">,
    ): LogLineEvent => {
      const state = session.sections.get(name) ?? startSection(name)
      state.lines += 1
      const parsed = manualLogEntrySchema.parse({
        ...entry,
        section: name,
      })
      const event = createLineEvent(session, parsed)
      writeEvent(session, event)
      return event
    }

    const sink: PipeSink = {
      onStart() {
        startSection(name)
      },
      onEvent(event) {
        const state = session.sections.get(name) ?? startSection(name)
        state.lines += 1
        writeEvent(session, event)
      },
      onFinish(result) {
        const state = session.sections.get(name) ?? startSection(name)
        if (state.endedAt === undefined) {
          endSection(state, result)
        }
      },
    }

    return {
      name,
      ...createWriter(writeStep),
      async exec(options: LogSectionRunOptions) {
        return pipeAndWait({
          ...options,
          source: options.source ?? name,
          session: session.name,
          section: name,
          width: options.width ?? session.console.render.width,
          sink,
        })
      },
      write(entry) {
        return writeStep(entry)
      },
    }
  }

  return {
    ...createWriter(writeManual),
    name: session.name,
    runId: session.runId,
    dir: session.dir,
    state: () => ({
      name: session.name,
      runId: session.runId,
      dir: session.dir,
      cwd: session.cwd,
      startedAt: session.startedAt,
      endedAt: undefined,
      status: session.status,
      sections: sortedSections(session.sections),
    }),
    step(name: string): LogStep {
      return createStep(name)
    },
    write(entry) {
      return writeManual(entry)
    },
    close() {
      if (session.closed) {
        throw new Error(`Session ${session.name} is already closed.`)
      }

      session.closed = true
      if (session.status === "running") {
        setSessionStatus(session, "passed")
      }
      const endedAt = Date.now()
      const event: SessionEndEvent = {
        type: "session:end",
        timestamp: endedAt,
        session: session.name,
        section: null,
        source: session.name,
        runId: session.runId,
        status: session.status,
        durationMs: endedAt - session.startedAt,
      }
      writeEvent(session, event)

      const sections = sortedSections(session.sections)
      const result: LogSessionResult = {
        name: session.name,
        runId: session.runId,
        dir: session.dir,
        cwd: session.cwd,
        startedAt: session.startedAt,
        endedAt,
        status: session.status,
        sections,
        files: {
          manifest: session.files.manifest,
          events: session.files.events,
          combined: session.files.combined,
          sections:
            session.files.sections === null
              ? null
              : join(session.dir, "sections"),
        },
      }

      if (session.files.manifest !== null) {
        ensureParent(session.files.manifest)
        writeFileSync(
          session.files.manifest,
          `${JSON.stringify(result, null, 2)}\n`,
        )
      }

      const summary: LogSummary = {
        name: result.name,
        status: result.status,
        durationMs: endedAt - session.startedAt,
        sections: result.sections.length,
      }
      writeConsole(session, renderLogSummary(summary, session.console.render))

      return result
    },
  }
}

export function createLogSession(options: LogSessionOptions): LogSession {
  const cwd = resolve(options.cwd ?? process.cwd())
  const now = Date.now()
  const root = resolve(cwd, options.root ?? ".logs")
  const runId = sanitizeSegment(options.runId ?? createRunId(now))
  const dir = join(root, sanitizeSegment(options.name), runId)
  mkdirSync(dir, { recursive: true })

  const session: InternalSession = {
    name: options.name,
    runId,
    dir,
    cwd,
    startedAt: now,
    status: logStatusSchema.parse("running"),
    sections: new Map<string, LogSectionState>(),
    console: resolveConsole(options.console),
    files: resolveFiles(dir, options.files),
    closed: false,
  }

  writeEvent(session, createSessionStartEvent(session))

  return createSessionApi(session)
}

export async function withLogRun<T>(
  options: LogSessionOptions,
  task: (run: LogSession) => Promise<T> | T,
): Promise<WithRunResult<T>> {
  const run = createLogSession(options)

  try {
    const value = await task(run)
    const result = run.close()
    return {
      value,
      result,
    }
  } catch (error) {
    run.close()
    throw error
  }
}
