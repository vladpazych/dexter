import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { env, terminal } from "@vladpazych/rig"

describe("env", () => {
  it("loads typed env values from explicit env input", () => {
    const config = env.load(
      {
        port: {
          env: "APP_PORT",
          type: "port",
          required: true,
        },
        debug: {
          env: "APP_DEBUG",
          type: "boolean",
          default: false,
        },
      },
      {
        env: {
          APP_PORT: "3000",
        },
      },
    )

    assert.equal(config.port, 3000)
    assert.equal(config.debug, false)
  })

  it("treats explicit empty strings as provided input", () => {
    const config = env.load(
      {
        value: {
          env: "EMPTY_ALLOWED",
          type: "string",
          required: true,
        },
      },
      {
        env: {
          EMPTY_ALLOWED: "",
        },
      },
    )

    assert.equal(config.value, "")
  })

  it("coerces typed defaults through the same validation path", () => {
    const config = env.load({
      port: {
        env: "APP_PORT",
        type: "port",
        default: "3000",
      },
      debug: {
        env: "APP_DEBUG",
        type: "boolean",
        default: "false",
      },
    })

    assert.equal(config.port, 3000)
    assert.equal(config.debug, false)
  })

  it("rejects invalid typed defaults", () => {
    assert.throws(
      () =>
        env.load({
          port: {
            env: "APP_PORT",
            type: "port",
            default: "not-a-port",
          },
        }),
      /APP_PORT: invalid default/,
    )
  })

  it("supports nested schemas and typed enum values", () => {
    const config = env.load(
      {
        service: {
          port: {
            env: "APP_PORT",
            type: "port",
            required: true,
          },
          mode: {
            env: "APP_MODE",
            type: "enum",
            values: ["dev", "prod"] as const,
            required: true,
          },
        },
      },
      {
        env: {
          APP_PORT: "3000",
          APP_MODE: "prod",
        },
      },
    )

    assert.deepEqual(config, {
      service: {
        port: 3000,
        mode: "prod",
      },
    })
  })

  it("rejects invalid explicit values for typed fields", () => {
    const cases = [
      {
        schema: {
          port: {
            env: "APP_PORT",
            type: "number" as const,
          },
        },
        env: { APP_PORT: "NaN" },
        pattern: /APP_PORT: expected number/,
      },
      {
        schema: {
          debug: {
            env: "APP_DEBUG",
            type: "boolean" as const,
          },
        },
        env: { APP_DEBUG: "maybe" },
        pattern: /APP_DEBUG: expected true\/false\/1\/0/,
      },
      {
        schema: {
          apiUrl: {
            env: "API_URL",
            type: "url" as const,
          },
        },
        env: { API_URL: "not-a-url" },
        pattern: /API_URL: expected valid URL/,
      },
      {
        schema: {
          mode: {
            env: "APP_MODE",
            type: "enum" as const,
            values: ["dev", "prod"] as const,
          },
        },
        env: { APP_MODE: "qa" },
        pattern: /APP_MODE: expected dev \| prod/,
      },
    ] as const

    for (const testCase of cases) {
      assert.throws(
        () =>
          env.load(testCase.schema, {
            env: testCase.env,
          }),
        testCase.pattern,
      )
    }
  })

  it("treats required fields as required even when a default exists", () => {
    assert.throws(
      () =>
        env.load({
          apiUrl: {
            env: "API_URL",
            type: "url",
            required: true,
            default: "https://example.com",
          },
        }),
      /API_URL: required but not set/,
    )
  })

  it("inspects explicit env with bound report metadata", () => {
    const bound = env.with({
      env: {
        API_URL: "https://example.com",
      },
      name: "app",
    })
    const result = bound.inspect({
      apiUrl: {
        env: "API_URL",
        type: "url",
        required: true,
      },
    })

    assert.equal(result.config.apiUrl, "https://example.com")
    assert.equal(result.report.name, "app")
    assert.equal(result.report.fields[0]?.source, "input")
  })

  it("reports input, default, and unset sources during inspection", () => {
    const result = env.inspect(
      {
        apiUrl: {
          env: "API_URL",
          type: "url",
        },
        port: {
          env: "APP_PORT",
          type: "port",
          default: "3000",
        },
        debug: {
          env: "APP_DEBUG",
          type: "boolean",
        },
      },
      {
        env: {
          API_URL: "https://example.com",
        },
      },
    )

    assert.deepEqual(
      result.report.fields.map((field) => [field.env, field.source]),
      [
        ["API_URL", "input"],
        ["APP_PORT", "default"],
        ["APP_DEBUG", "unset"],
      ],
    )
  })

  it("formats loaded config with sections, masking, and unset values", () => {
    const config = env
      .with({
        env: {
          API_URL: "https://example.com",
          MODE: "prod",
        },
        name: "bound",
      })
      .load({
        service: {
          apiUrl: {
            env: "API_URL",
            type: "url",
            required: true,
          },
          token: {
            env: "API_TOKEN",
            sensitive: true,
            default: "secret",
          },
          mode: {
            env: "MODE",
            type: "enum",
            values: ["dev", "prod"] as const,
            required: true,
          },
          debug: {
            env: "DEBUG",
            type: "boolean",
          },
        },
      })

    const boundText = terminal.stripAnsi(env.format(config))
    const customText = terminal.stripAnsi(env.format(config, "custom"))

    assert.match(boundText, /bound/)
    assert.match(boundText, /service/)
    assert.match(boundText, /apiUrl/)
    assert.match(boundText, /https:\/\/example\.com/)
    assert.match(boundText, /token/)
    assert.match(boundText, /••••/)
    assert.match(boundText, /debug/)
    assert.match(boundText, /—/)
    assert.match(customText, /custom/)
  })

  it("prints formatted config using the bound name by default and supports override", () => {
    const config = env
      .with({
        name: "bound",
      })
      .load({
        port: {
          env: "APP_PORT",
          type: "port",
          default: "3000",
        },
      })
    const originalLog = console.log
    const lines: string[] = []

    console.log = ((value: unknown) => {
      lines.push(String(value))
    }) as typeof console.log

    try {
      env.print(config)
      env.print(config, "override")
    } finally {
      console.log = originalLog
    }

    assert.equal(lines.length, 2)
    assert.match(terminal.stripAnsi(lines[0] ?? ""), /bound/)
    assert.match(terminal.stripAnsi(lines[1] ?? ""), /override/)
  })

  it("falls back to String(value) when formatting non-env objects", () => {
    assert.equal(env.format({ ok: true }), "[object Object]")
    assert.equal(env.format("plain"), "plain")
  })
})
