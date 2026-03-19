import assert from "node:assert/strict"
import { mkdtempSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Writable } from "node:stream"
import { describe, it } from "node:test"

import { logger } from "@vladpazych/rig"
import { consoleSink, fileSink, streamSink } from "@vladpazych/rig-logger-sinks"

class MemoryWritable extends Writable {
  chunks: string[] = []

  _write(
    chunk: string | Uint8Array,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
    )
    callback()
  }

  text(): string {
    return this.chunks.join("")
  }
}

describe("@vladpazych/rig-logger-sinks", () => {
  it("streamSink writes pretty lines to a writable stream", () => {
    const stream = new MemoryWritable()
    const log = logger.with({
      name: "release",
      sinks: [streamSink({ stream })],
    })

    log.info("Starting release", { version: "1.0.0" })

    const output = stream.text()
    assert.match(output, /INFO/)
    assert.match(output, /\[release\]/)
    assert.match(output, /Starting release/)
    assert.match(output, /version="1\.0\.0"/)
  })

  it("streamSink respects sink-level minimum level and json format", () => {
    const stream = new MemoryWritable()
    const log = logger.with({
      sinks: [
        streamSink({
          stream,
          level: "error",
          format: "json",
        }),
      ],
    })

    log.info("skip")
    log.error("keep", { step: "publish" })

    const lines = stream
      .text()
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)

    assert.equal(lines.length, 1)

    const parsed = JSON.parse(lines[0] ?? "{}") as {
      level?: string
      logger?: string | null
      message?: string
      fields?: Record<string, unknown>
      timestamp?: number
    }

    assert.equal(typeof parsed.timestamp, "number")
    assert.equal(parsed.level, "error")
    assert.equal(parsed.logger, null)
    assert.equal(parsed.message, "keep")
    assert.deepEqual(parsed.fields, {
      step: "publish",
    })
  })

  it("consoleSink routes warn and above to stderr", () => {
    const stdout = new MemoryWritable()
    const stderr = new MemoryWritable()
    const log = logger.with({
      name: "release",
      sinks: [
        consoleSink({
          stdout,
          stderr,
          color: false,
        }),
      ],
    })

    log.info("Visible on stdout")
    log.warn("Visible on stderr")

    assert.match(stdout.text(), /Visible on stdout/)
    assert.match(stdout.text(), /\[release\]/)
    assert.match(stderr.text(), /Visible on stderr/)
    assert.match(stderr.text(), /WARN/)
  })

  it("consoleSink stays plain by default for non-tty streams", () => {
    const stdout = new MemoryWritable()
    const log = logger.with({
      sinks: [
        consoleSink({
          stdout,
          stderr: new MemoryWritable(),
        }),
      ],
    })

    log.info("No ansi by default")

    assert.match(stdout.text(), /No ansi by default/)
    assert.equal(stdout.text().includes("\x1b["), false)
  })

  it("consoleSink can force color output", () => {
    const stdout = new MemoryWritable()
    const log = logger.with({
      sinks: [
        consoleSink({
          stdout,
          stderr: new MemoryWritable(),
          color: true,
        }),
      ],
    })

    log.info("Color please")

    assert.match(stdout.text(), /\x1b\[/)
  })

  it("consoleSink supports json formatting", () => {
    const stdout = new MemoryWritable()
    const stderr = new MemoryWritable()
    const log = logger.with({
      name: "release",
      fields: {
        repo: "rig",
      },
      sinks: [
        consoleSink({
          stdout,
          stderr,
          format: "json",
        }),
      ],
    })

    log.info("Structured")

    const parsed = JSON.parse(stdout.text().trim()) as {
      logger?: string | null
      fields?: Record<string, unknown>
      message?: string
    }

    assert.equal(stderr.text(), "")
    assert.equal(parsed.logger, "release")
    assert.equal(parsed.message, "Structured")
    assert.deepEqual(parsed.fields, {
      repo: "rig",
    })
  })

  it("fileSink creates parent directories and appends multiple lines", () => {
    const root = mkdtempSync(join(tmpdir(), "rig-logger-sinks-"))
    const path = join(root, "logs", "release.log")
    const log = logger.with({
      sinks: [fileSink({ path })],
    })

    log.info("first")
    log.info("second")

    const content = readFileSync(path, "utf8")
    assert.match(content, /first/)
    assert.match(content, /second/)
  })

  it("fileSink writes ndjson in json mode", () => {
    const root = mkdtempSync(join(tmpdir(), "rig-logger-json-"))
    const path = join(root, "logs", "release.ndjson")
    const log = logger.with({
      name: "release.publish",
      fields: {
        repo: "rig",
      },
      sinks: [
        fileSink({
          path,
          format: "json",
        }),
      ],
    })

    log.info("Publishing", { version: "1.0.0" })

    const parsed = JSON.parse(readFileSync(path, "utf8").trim()) as {
      level?: string
      logger?: string
      message?: string
      fields?: Record<string, unknown>
      timestamp?: number
    }

    assert.equal(typeof parsed.timestamp, "number")
    assert.equal(parsed.level, "info")
    assert.equal(parsed.logger, "release.publish")
    assert.equal(parsed.message, "Publishing")
    assert.deepEqual(parsed.fields, {
      repo: "rig",
      version: "1.0.0",
    })
  })

  it("supports custom formatter and line ending in streamSink", () => {
    const stream = new MemoryWritable()
    const log = logger.with({
      name: "release",
      sinks: [
        streamSink({
          stream,
          lineEnding: "\r\n",
          formatter(event) {
            return `${event.level}:${event.logger}:${event.message}`
          },
        }),
      ],
    })

    log.warn("Formatting")

    assert.equal(stream.text(), "warn:release:Formatting\r\n")
  })

  it("preserves nested logger names across sink formatting", () => {
    const stream = new MemoryWritable()
    const log = logger
      .with({
        name: "release",
      })
      .with({
        name: "publish",
        sinks: [
          streamSink({
            stream,
            format: "json",
          }),
        ],
      })

    log.info("Nested", { version: "1.0.0" })

    const parsed = JSON.parse(stream.text().trim()) as {
      logger?: string | null
      fields?: Record<string, unknown>
    }

    assert.equal(parsed.logger, "release.publish")
    assert.deepEqual(parsed.fields, {
      version: "1.0.0",
    })
  })
})
