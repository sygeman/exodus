import type { Stage, StageInput, StageOutput } from "../ir"

// ── Bun Stage ─────────────────────────────────────────────────────────────────
// Initializes project with bun init and generates bunfig.toml.

export const bunStage: Stage = {
  name: "bun",

  async handle({ output }: StageInput): Promise<StageOutput> {
    const { mkdirSync, writeFileSync } = await import("fs")

    mkdirSync(output, { recursive: true })

    const proc = Bun.spawn(["bun", "init", "--yes"], {
      cwd: output,
      stdout: "pipe",
      stderr: "pipe",
    })
    await proc.exited

    writeFileSync(
      `${output}/bunfig.toml`,
      `[install]\nsaveTextLockfile = true\nexact = true\n`,
      "utf-8",
    )

    return { files: [], deps: [] }
  },
}
