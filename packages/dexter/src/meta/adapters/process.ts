/**
 * ProcessPort adapter — wraps child_process.spawn + readline for streaming output.
 */

import { spawn } from "node:child_process"
import { createInterface } from "node:readline"

import type { ProcessPort } from "../ports.ts"

export function createNodeProcess(): ProcessPort {
  return {
    spawn({ cmd, args, cwd, env, timeout }) {
      const child = spawn(cmd, args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: env ? { ...process.env, ...env } : undefined,
      })

      let timer: ReturnType<typeof setTimeout> | undefined
      if (timeout) {
        timer = setTimeout(() => child.kill(), timeout)
      }

      return {
        onLine(stream, cb) {
          const source = stream === "stdout" ? child.stdout : child.stderr
          createInterface({ input: source }).on("line", cb)
        },
        wait() {
          return new Promise((resolve) => {
            child.on("close", (code) => {
              if (timer) clearTimeout(timer)
              resolve(code)
            })
          })
        },
      }
    },
  }
}
