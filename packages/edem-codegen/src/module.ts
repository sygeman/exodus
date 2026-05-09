import { z } from "zod"
import { createEdemModule } from "@exodus/edem-core"
import { parseManifests, type Manifests } from "./parse"
import { validateIR } from "./validate"
import { bunStage, electrobunStage, vueStage, dataStage, flowsStage, appStage } from "./stages"
import type { Stage, OutputFile } from "./ir"

// ── Pipeline ──────────────────────────────────────────────────────────────────

const stages: Stage[] = [bunStage, electrobunStage, vueStage, dataStage, flowsStage, appStage]

// ── Module ────────────────────────────────────────────────────────────────────

export const codegenModule = createEdemModule("codegen", (module) => {
  return module
    .context(async () => ({}))
    .mutation("generateProject", {
      input: z.object({
        project_id: z.string(),
        output: z.string(),
        manifests: z.any(),
      }),
      output: z.object({
        files: z.number(),
        output: z.string(),
      }),
      resolve: async ({ input }) => {
        const manifests = input.manifests as Manifests
        const { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } = await import("fs")
        const { join } = await import("path")

        // 1. Parse manifests → IR
        const ir = parseManifests(manifests)

        // 2. Validate
        const errors = validateIR(ir)
        const criticalErrors = errors.filter((e) => e.type === "error")
        if (criticalErrors.length > 0) {
          throw new Error(
            `Validation failed:\n${criticalErrors.map((e) => `  - ${e.message}`).join("\n")}`,
          )
        }

        // 3. Clear output
        if (existsSync(input.output)) {
          rmSync(input.output, { recursive: true })
        }
        mkdirSync(input.output, { recursive: true })

        // 4. Run stages
        const allFiles: OutputFile[] = []
        const allDeps: string[] = []
        const context: Record<string, unknown> = { manifests }

        for (const stage of stages) {
          const result = await stage.handle({
            ir,
            output: input.output,
            manifests,
            context,
          })
          allFiles.push(...result.files)
          allDeps.push(...result.deps)
        }

        // 5. Separate workspace and external deps
        const uniqueDeps = [...new Set(allDeps)]
        const workspaceDeps = uniqueDeps.filter((d) => d.startsWith("@exodus/"))
        const externalDeps = uniqueDeps.filter((d) => !d.startsWith("@exodus/"))

        // 6. Install external dependencies via bun add
        if (externalDeps.length > 0) {
          const proc = Bun.spawn(["bun", "add", ...externalDeps], {
            cwd: input.output,
            stdout: "pipe",
            stderr: "pipe",
          })
          const exitCode = await proc.exited
          if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text()
            throw new Error(`bun add failed (exit ${exitCode}): ${stderr}`)
          }
        }

        // 7. Add workspace deps to package.json (after bun add)
        if (workspaceDeps.length > 0) {
          const pkgPath = join(input.output, "package.json")
          const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
          pkg.dependencies = pkg.dependencies ?? {}
          for (const dep of workspaceDeps) {
            pkg.dependencies[dep] = "workspace:*"
          }
          writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf-8")
        }

        // 8. Write manifests
        const manifestsDir = join(input.output, "edem-manifests")
        mkdirSync(manifestsDir, { recursive: true })
        writeFileSync(join(manifestsDir, "ui.json"), JSON.stringify(manifests.ui, null, 2), "utf-8")
        writeFileSync(
          join(manifestsDir, "data.json"),
          JSON.stringify(manifests.data, null, 2),
          "utf-8",
        )
        writeFileSync(
          join(manifestsDir, "flows.json"),
          JSON.stringify(manifests.flows, null, 2),
          "utf-8",
        )

        // 9. Write generated files
        const { dirname } = await import("path")

        for (const file of allFiles) {
          const outPath = join(input.output, file.path)
          const dir = dirname(outPath)
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
          }
          writeFileSync(outPath, file.content, "utf-8")
        }

        return { files: allFiles.length + 3, output: input.output }
      },
    })
})

export default codegenModule
