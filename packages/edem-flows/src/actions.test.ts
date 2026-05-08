import { describe, it } from "bun:test"
import { setEdemModules } from "./executors"

describe("setEdemModules", () => {
  it("should set modules for executor use", () => {
    setEdemModules({ test: { echo: async (input: unknown) => input } })
  })
})
