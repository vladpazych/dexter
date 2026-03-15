import { describe, expect, it } from "bun:test"

import {
  bumpVersion,
  resolveReleaseBaseVersion,
} from "../scripts/release.ts"

describe("release script", () => {
  it("bumps semantic versions from the release baseline", () => {
    expect(bumpVersion("1.1.1", "patch")).toBe("1.1.2")
    expect(bumpVersion("1.1.1", "minor")).toBe("1.2.0")
    expect(bumpVersion("1.1.1", "major")).toBe("2.0.0")
  })

  it("uses package.json when there is no prior tag", () => {
    expect(resolveReleaseBaseVersion("0.1.0", null)).toBe("0.1.0")
  })

  it("rejects package version drift from the latest tag", () => {
    expect(() => resolveReleaseBaseVersion("1.2.0", "v1.1.1")).toThrow(
      "package.json version 1.2.0 does not match latest tag v1.1.1",
    )
  })

  it("rejects invalid version input", () => {
    expect(() => bumpVersion("1.1", "minor")).toThrow("invalid version: 1.1")
  })
})
