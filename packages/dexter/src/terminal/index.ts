import { createTerminal } from "./colors.ts"

export const terminal = {
  colors: createTerminal().colors,
  stripAnsi: createTerminal().stripAnsi,
  with(options: { color?: boolean }) {
    return createTerminal(options)
  },
}
