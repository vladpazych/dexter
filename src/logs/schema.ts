import { z } from "zod"

export const logLevelSchema = z.enum([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
])

export const logStatusSchema = z.enum([
  "running",
  "passed",
  "failed",
  "cancelled",
])

export const logStreamSchema = z.enum(["stdout", "stderr", "manual"])

const baseEventSchema = z.object({
  timestamp: z.number().int().nonnegative(),
  session: z.string().min(1),
  source: z.string().min(1),
  section: z.string().min(1).nullable(),
})

export const logLineEventSchema = baseEventSchema.extend({
  type: z.literal("line"),
  stream: logStreamSchema,
  level: logLevelSchema,
  message: z.string(),
  fields: z.record(z.string(), z.unknown()),
  raw: z.string(),
  lineNumber: z.number().int().nonnegative(),
})

export const sessionStartEventSchema = baseEventSchema.extend({
  type: z.literal("session:start"),
  runId: z.string().min(1),
  cwd: z.string().min(1),
})

export const sessionEndEventSchema = baseEventSchema.extend({
  type: z.literal("session:end"),
  runId: z.string().min(1),
  status: logStatusSchema,
  durationMs: z.number().int().nonnegative(),
})

export const sectionStartEventSchema = baseEventSchema.extend({
  type: z.literal("section:start"),
})

export const sectionEndEventSchema = baseEventSchema.extend({
  type: z.literal("section:end"),
  status: logStatusSchema,
  durationMs: z.number().int().nonnegative(),
  exitCode: z.number().int().nullable(),
})

export const logEventSchema = z.discriminatedUnion("type", [
  logLineEventSchema,
  sessionStartEventSchema,
  sessionEndEventSchema,
  sectionStartEventSchema,
  sectionEndEventSchema,
])

export const manualLogEntrySchema = z.object({
  level: logLevelSchema.default("info"),
  message: z.string().min(1),
  fields: z.record(z.string(), z.unknown()).default({}),
  source: z.string().min(1).optional(),
  section: z.string().min(1).optional(),
  timestamp: z.number().int().nonnegative().optional(),
})

export type LogLevel = z.infer<typeof logLevelSchema>
export type LogStatus = z.infer<typeof logStatusSchema>
export type LogStream = z.infer<typeof logStreamSchema>
export type LogLineEvent = z.infer<typeof logLineEventSchema>
export type SessionStartEvent = z.infer<typeof sessionStartEventSchema>
export type SessionEndEvent = z.infer<typeof sessionEndEventSchema>
export type SectionStartEvent = z.infer<typeof sectionStartEventSchema>
export type SectionEndEvent = z.infer<typeof sectionEndEventSchema>
export type LogEvent = z.infer<typeof logEventSchema>
export type ManualLogEntry = z.infer<typeof manualLogEntrySchema>
export type ManualLogInput = z.input<typeof manualLogEntrySchema>
