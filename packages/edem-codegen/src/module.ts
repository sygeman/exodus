import { z } from "zod"
import { createEdemModule } from "@exodus/edem-core"
import { existsSync, readFileSync, readdirSync } from "fs"
import { dirname, join, relative, resolve } from "path"
import { parseManifests, type Manifests } from "./parse"
import { validateIR } from "./validate"
import {
  bunStage,
  electrobunStage,
  vueStage,
  dataStage,
  flowsStage,
  appStage,
  platformStage,
} from "./stages"
import type { Stage, OutputFile } from "./ir"

// ── Pipeline ──────────────────────────────────────────────────────────────────

const stages: Stage[] = [
  bunStage,
  electrobunStage,
  vueStage,
  dataStage,
  flowsStage,
  appStage,
  platformStage,
]

// ── Module ────────────────────────────────────────────────────────────────────

export const codegenModule = createEdemModule("codegen", (module) => {
  return module
    .context(async () => ({}))
    .mutation("generateProject", {
      input: z.object({
        project_id: z.string(),
        output: z.string(),
        manifests: z.any(),
        project_name: z.string().optional(),
        manifests_dir: z.string().optional(),
      }),
      output: z.object({
        files: z.number(),
        output: z.string(),
      }),
      resolve: async ({ input }) => {
        const manifests = input.manifests as Manifests
        const { mkdirSync, writeFileSync, rmSync, chmodSync } = await import("fs")

        // 1. Parse manifests → IR
        const ir = parseManifests(manifests, input.project_name)

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
        const allDevDeps: string[] = []
        const allScripts: Record<string, string> = {}
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
          if (result.devDeps) allDevDeps.push(...result.devDeps)
          if (result.scripts) {
            Object.assign(allScripts, result.scripts)
          }
        }

        const sharedSourceFiles = collectSharedSourceFiles(allFiles, input.manifests_dir)
        allFiles.push(...sharedSourceFiles)
        allDeps.push(...collectRuntimeDependencies(allFiles))

        // 5. Separate workspace and external deps
        const uniqueDeps = [...new Set(allDeps)]
        const workspaceDeps = uniqueDeps.filter((d) => d.startsWith("@exodus/"))
        const externalDeps = uniqueDeps.filter((d) => !d.startsWith("@exodus/"))

        const uniqueDevDeps = [...new Set(allDevDeps)]
        const workspaceDevDeps = uniqueDevDeps.filter((d) => d.startsWith("@exodus/"))
        const externalDevDeps = uniqueDevDeps.filter((d) => !d.startsWith("@exodus/"))
        const versionCatalog = collectDependencyVersions(input.manifests_dir ?? input.output)

        // 6. Write package.json directly without invoking package manager.
        const pkg = {
          name: input.project_id,
          version: "0.0.0",
          description: ir.project.name,
          type: "module" as const,
          private: true,
          scripts: allScripts,
          dependencies: buildDependencyMap(externalDeps, workspaceDeps, versionCatalog),
          devDependencies: buildDependencyMap(externalDevDeps, workspaceDevDeps, versionCatalog),
        }

        const pkgPath = join(input.output, "package.json")
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf-8")

        // 7. Write manifests
        const manifestsDir = join(input.output, "edem-manifests")
        mkdirSync(manifestsDir, { recursive: true })
        writeFileSync(
          join(manifestsDir, "routes.json"),
          JSON.stringify(manifests.routes, null, 2),
          "utf-8",
        )
        // Write components/ directory
        if (manifests.components && Object.keys(manifests.components).length > 0) {
          const componentsDir = join(manifestsDir, "components")
          mkdirSync(componentsDir, { recursive: true })
          for (const [name, tree] of Object.entries(manifests.components)) {
            writeFileSync(
              join(componentsDir, `${name}.json`),
              JSON.stringify(tree, null, 2),
              "utf-8",
            )
          }
        }
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
        if (manifests.platform) {
          writeFileSync(
            join(manifestsDir, "platform.json"),
            JSON.stringify(manifests.platform, null, 2),
            "utf-8",
          )
        }
        if (manifests.assets) {
          writeFileSync(
            join(manifestsDir, "assets.json"),
            JSON.stringify(manifests.assets, null, 2),
            "utf-8",
          )
          // Copy assets/ directory into edem-manifests/assets/
          if (input.manifests_dir) {
            const assetsSrcDir = join(input.manifests_dir, "assets")
            if (existsSync(assetsSrcDir)) {
              const assetsManifestDir = join(manifestsDir, "assets")
              mkdirSync(assetsManifestDir, { recursive: true })
              const assetFiles = readdirSync(assetsSrcDir)
              for (const file of assetFiles) {
                writeFileSync(join(assetsManifestDir, file), readFileSync(join(assetsSrcDir, file)))
              }
            }
          }
        }

        // Copy asset files (e.g. SVGs) from manifests dir to output
        if (ir.assets.length > 0 && input.manifests_dir) {
          const assetsSrcDir = join(input.manifests_dir, "assets")
          const assetsOutDir = join(input.output, "src", "assets")
          if (existsSync(assetsSrcDir)) {
            mkdirSync(assetsOutDir, { recursive: true })
            for (const asset of ir.assets) {
              const srcFile = join(assetsSrcDir, asset.src)
              if (existsSync(srcFile)) {
                const content = readFileSync(srcFile, "utf-8")
                writeFileSync(join(assetsOutDir, asset.src), content, "utf-8")
              }
            }
          }
        }

        // 8. Write generated files
        for (const file of allFiles) {
          const outPath = join(input.output, file.path)
          const dir = dirname(outPath)
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
          }
          writeFileSync(outPath, file.content, "utf-8")
        }

        // Make shell scripts executable
        for (const file of allFiles) {
          if (file.path.endsWith(".sh")) {
            chmodSync(join(input.output, file.path), 0o755)
          }
        }

        // Generate platform icons from logo.svg
        const iconsScript = join(input.output, "scripts", "generate-icons.sh")
        if (existsSync(iconsScript)) {
          const proc = Bun.spawn(["bash", iconsScript], {
            cwd: input.output,
            stdout: "pipe",
            stderr: "pipe",
          })
          const exitCode = await proc.exited
          if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text()
            console.warn(`[codegen] icons generation failed: ${stderr}`)
          }
        }

        return { files: allFiles.length + 3 + (manifests.platform ? 1 : 0), output: input.output }
      },
    })
})

interface PackageManifest {
  workspaces?: string[]
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function buildDependencyMap(
  externalDeps: string[],
  workspaceDeps: string[],
  versionCatalog: Map<string, string>,
): Record<string, string> {
  const deps: Record<string, string> = {}

  for (const dep of externalDeps) {
    deps[dep] = resolveDependencyVersion(dep, versionCatalog)
  }

  for (const dep of workspaceDeps) {
    deps[dep] = "workspace:*"
  }

  return deps
}

function resolveDependencyVersion(dep: string, versionCatalog: Map<string, string>): string {
  const version = versionCatalog.get(dep)
  if (!version) {
    throw new Error(`Cannot resolve version for dependency "${dep}" from workspace manifests`)
  }

  return version
}

function collectDependencyVersions(startDir: string): Map<string, string> {
  const workspaceRoot = findWorkspaceRoot(startDir)
  if (!workspaceRoot) {
    return new Map()
  }

  const rootManifest = readPackageManifest(join(workspaceRoot, "package.json"))
  const catalog = new Map<string, string>()

  addManifestDeps(catalog, rootManifest)

  for (const pkgPath of expandWorkspacePackagePaths(workspaceRoot, rootManifest.workspaces ?? [])) {
    addManifestDeps(catalog, readPackageManifest(pkgPath))
  }

  return catalog
}

function collectSharedSourceFiles(files: OutputFile[], manifestsDir?: string): OutputFile[] {
  if (!manifestsDir) return []

  const sourceRoot = join(dirname(manifestsDir), "src")
  if (!existsSync(sourceRoot)) return []

  const knownPaths = new Set(files.map((file) => file.path))
  const pending = [...files]
  const copied: OutputFile[] = []

  while (pending.length > 0) {
    const file = pending.shift()!

    for (const specifier of extractLocalImportSpecifiers(file.content)) {
      const resolvedFile = resolveSharedSourceFile(sourceRoot, file.path, specifier)
      if (!resolvedFile || knownPaths.has(resolvedFile.outputPath)) continue

      const content = readFileSync(resolvedFile.sourcePath, "utf-8")
      const copiedFile = { path: resolvedFile.outputPath, content }
      knownPaths.add(copiedFile.path)
      copied.push(copiedFile)
      pending.push(copiedFile)
    }
  }

  return copied
}

function extractLocalImportSpecifiers(content: string): string[] {
  const specifiers = new Set<string>()
  const importPatterns = [/\bfrom\s+["']([^"']+)["']/g, /\bimport\s+["']([^"']+)["']/g]

  for (const pattern of importPatterns) {
    for (const match of content.matchAll(pattern)) {
      const specifier = match[1]
      if (specifier.startsWith("@/") || specifier.startsWith("./") || specifier.startsWith("../")) {
        specifiers.add(specifier)
      }
    }
  }

  return [...specifiers]
}

function resolveSharedSourceFile(sourceRoot: string, importerPath: string, specifier: string) {
  const importerDir = dirname(
    importerPath.startsWith("src/") ? importerPath.slice(4) : importerPath,
  )
  const basePath = specifier.startsWith("@/")
    ? resolve(sourceRoot, specifier.slice(2))
    : resolve(sourceRoot, importerDir, specifier)

  if (!basePath.startsWith(sourceRoot)) return null

  for (const candidate of buildSourceCandidates(basePath)) {
    if (!existsSync(candidate)) continue
    const outputPath = `src/${relative(sourceRoot, candidate)}`
    return { sourcePath: candidate, outputPath }
  }

  return null
}

function buildSourceCandidates(basePath: string): string[] {
  return [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.vue`,
    join(basePath, "index.ts"),
    join(basePath, "index.tsx"),
    join(basePath, "index.js"),
    join(basePath, "index.jsx"),
  ]
}

function collectRuntimeDependencies(files: OutputFile[]): string[] {
  const packages = new Set<string>()

  for (const file of files) {
    if (!file.path.startsWith("src/")) continue

    for (const specifier of extractImportSpecifiers(file.content)) {
      if (specifier.startsWith("@/") || specifier.startsWith("./") || specifier.startsWith("../")) {
        continue
      }

      const packageName = getPackageName(specifier)
      if (!packageName || isBuiltinPackage(packageName)) continue
      packages.add(packageName)
    }
  }

  return [...packages]
}

function extractImportSpecifiers(content: string): string[] {
  const specifiers = new Set<string>()
  const importPatterns = [/\bfrom\s+["']([^"']+)["']/g, /\bimport\s+["']([^"']+)["']/g]

  for (const pattern of importPatterns) {
    for (const match of content.matchAll(pattern)) {
      specifiers.add(match[1])
    }
  }

  return [...specifiers]
}

function getPackageName(specifier: string): string | null {
  if (!specifier) return null
  if (specifier.startsWith("@")) {
    const [scope, name] = specifier.split("/")
    return scope && name ? `${scope}/${name}` : null
  }

  const [name] = specifier.split("/")
  return name || null
}

function isBuiltinPackage(packageName: string): boolean {
  return packageName === "bun" || packageName === "node" || packageName === "path"
}

function addManifestDeps(catalog: Map<string, string>, manifest: PackageManifest): void {
  for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
    catalog.set(name, version)
  }

  for (const [name, version] of Object.entries(manifest.devDependencies ?? {})) {
    catalog.set(name, version)
  }
}

function readPackageManifest(filePath: string): PackageManifest {
  return JSON.parse(readFileSync(filePath, "utf-8")) as PackageManifest
}

function findWorkspaceRoot(startDir: string): string | null {
  let current = startDir

  while (true) {
    const pkgPath = join(current, "package.json")
    if (existsSync(pkgPath)) {
      const manifest = readPackageManifest(pkgPath)
      if (Array.isArray(manifest.workspaces)) {
        return current
      }
    }

    const parent = dirname(current)
    if (parent === current) {
      return null
    }

    current = parent
  }
}

function expandWorkspacePackagePaths(workspaceRoot: string, patterns: string[]): string[] {
  const packagePaths = new Set<string>()

  for (const pattern of patterns) {
    if (!pattern.endsWith("/*")) {
      continue
    }

    const baseDir = join(workspaceRoot, pattern.slice(0, -2))
    if (!existsSync(baseDir)) {
      continue
    }

    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }

      const pkgPath = join(baseDir, entry.name, "package.json")
      if (existsSync(pkgPath)) {
        packagePaths.add(pkgPath)
      }
    }
  }

  return [...packagePaths]
}
