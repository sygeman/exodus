import { beforeEach, afterEach, mock } from "bun:test"
import { createEdem, awaitEdemInit } from "@exodus/edem-core"
import { dataModule, resetDataEngine } from "@exodus/edem-data"
import { flowsModule } from "../index"
import { testModule } from "../test-actions"

export type Edem = ReturnType<
  typeof createEdem<[typeof dataModule, typeof flowsModule, typeof testModule]>
>

let edem: Edem
let originalLog: typeof console.log
let originalError: typeof console.error

export function getEdem(): Edem {
  return edem
}

export function setupTests() {
  beforeEach(async () => {
    resetDataEngine()
    edem = createEdem([dataModule, flowsModule, testModule])
    await awaitEdemInit(edem)
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
