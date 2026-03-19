import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { logger, type LogEvent } from "@vladpazych/rig"

describe("logger", () => {
  it("supports explicit log(level, ...) across all levels", () => {
    const events: LogEvent[] = []
    const log = logger.with({
      level: "trace",
      sinks: [
        {
          write(event) {
            events.push(event)
          },
        },
      ],
    })

    for (const level of [
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ] as const) {
      log.log(level, `message-${level}`)
    }

    assert.deepEqual(
      events.map((event) => event.level),
      ["trace", "debug", "info", "warn", "error", "fatal"],
    )
  })

  it("writes structured events to sinks", () => {
    const events: LogEvent[] = []
    const log = logger.with({
      name: "release",
      sinks: [
        {
          write(event) {
            events.push(event)
          },
        },
      ],
    })

    const event = log.info("Starting release", { version: "1.0.0" })

    assert.notEqual(event, null)
    assert.equal(events.length, 1)
    assert.equal(events[0]?.logger, "release")
    assert.equal(events[0]?.message, "Starting release")
    assert.deepEqual(events[0]?.fields, { version: "1.0.0" })
  })

  it("filters events below the active level", () => {
    const events: LogEvent[] = []
    const log = logger.with({
      level: "warn",
      sinks: [
        {
          write(event) {
            events.push(event)
          },
        },
      ],
    })

    assert.equal(log.info("Hidden"), null)
    assert.equal(log.error("Visible")?.level, "error")
    assert.deepEqual(
      events.map((event) => event.level),
      ["error"],
    )
  })

  it("merges bound fields and nested logger names", () => {
    const events: LogEvent[] = []
    const base = logger.with({
      name: "release",
      fields: {
        repo: "rig",
      },
      sinks: [
        {
          write(event) {
            events.push(event)
          },
        },
      ],
    })

    const publish = base.with({
      name: "publish",
      fields: {
        step: "npm",
      },
    })

    publish.info("Publishing", { version: "1.0.0" })

    assert.equal(events[0]?.logger, "release.publish")
    assert.deepEqual(events[0]?.fields, {
      repo: "rig",
      step: "npm",
      version: "1.0.0",
    })
  })

  it("allows events without sinks", () => {
    const event = logger.info("Visible")

    assert.notEqual(event, null)
    assert.equal(event?.logger, null)
    assert.equal(event?.message, "Visible")
    assert.deepEqual(event?.fields, {})
  })

  it("replaces sinks in nested loggers when new sinks are provided", () => {
    const baseEvents: LogEvent[] = []
    const nextEvents: LogEvent[] = []
    const base = logger.with({
      sinks: [
        {
          write(event) {
            baseEvents.push(event)
          },
        },
      ],
    })
    const next = base.with({
      sinks: [
        {
          write(event) {
            nextEvents.push(event)
          },
        },
      ],
    })

    next.info("Only next")

    assert.equal(baseEvents.length, 0)
    assert.equal(nextEvents.length, 1)
    assert.equal(nextEvents[0]?.message, "Only next")
  })

  it("ignores an empty base name when nesting loggers", () => {
    const events: LogEvent[] = []
    const publish = logger
      .with({
        name: "",
        sinks: [
          {
            write(event) {
              events.push(event)
            },
          },
        ],
      })
      .with({
        name: "publish",
      })

    publish.info("Publishing")

    assert.equal(events[0]?.logger, "publish")
  })
})
