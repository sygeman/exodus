import { beforeEach, afterEach, mock } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule, resetDataEngine } from "@exodus/edem-data"
import { flowsModule } from "../index"

export type Edem = ReturnType<typeof createEdem<[typeof dataModule, typeof flowsModule]>>

let edem: Edem
let originalLog: typeof console.log
let originalError: typeof console.error

export function getEdem(): Edem {
  return edem
}

export function setupTests() {
  beforeEach(async () => {
    resetDataEngine()
    edem = createEdem([dataModule, flowsModule])
    originalLog = console.log
    originalError = console.error
    console.log = mock(() => {})
    console.error = mock(() => {})
  })

  afterEach(() => {
    console.log = originalLog
    console.error = originalError
  })
}
