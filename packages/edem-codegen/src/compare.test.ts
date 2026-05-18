import { describe, expect, it } from "bun:test"
import {
  classifyArea,
  classifyReason,
  componentNameFromFile,
  countBy,
  createEntry,
  isLayoutComponent,
  shouldSkipDir,
} from "./compare"
import type { CompareContext, DiffEntry } from "./compare"

function makeContext(partial: Partial<CompareContext> = {}): CompareContext {
  return {
    manifestComponents: new Set(),
    routeRoots: new Set(),
    manifestAssets: new Set(),
    ...partial,
  }
}

describe("classifyArea", () => {
  it("classifies shell files", () => {
    expect(classifyArea("src/router.ts", makeContext())).toBe("shell")
  })

  it("classifies layout components", () => {
    expect(classifyArea("src/components/ProjectLayout.vue", makeContext())).toBe("layouts")
  })

  it("classifies route root components as pages", () => {
    const context = makeContext({ routeRoots: new Set(["ProjectsListPage"]) })
    expect(classifyArea("src/components/ProjectsListPage.vue", context)).toBe("pages")
  })

  it("classifies assets from src/assets", () => {
    expect(classifyArea("src/assets/logo.svg", makeContext())).toBe("assets")
  })

  it("falls back to other", () => {
    expect(classifyArea("src/utils/persist-route.ts", makeContext())).toBe("other")
  })
})

describe("classifyReason", () => {
  it("marks generated-only files as generator gaps", () => {
    expect(
      classifyReason("src/components/registry.ts", "other", "only_in_generated", makeContext()),
    ).toBe("generator gap")
  })

  it("marks shell diffs as generator gaps", () => {
    expect(classifyReason("src/App.vue", "shell", "different", makeContext())).toBe("generator gap")
  })

  it("marks manifest-backed pages as generator gaps", () => {
    const context = makeContext({ manifestComponents: new Set(["ProjectsListPage"]) })
    expect(
      classifyReason("src/components/ProjectsListPage.vue", "pages", "different", context),
    ).toBe("generator gap")
  })

  it("marks non-manifest layouts as migration gaps", () => {
    expect(
      classifyReason(
        "src/components/SettingsLayout.vue",
        "layouts",
        "only_in_reference",
        makeContext(),
      ),
    ).toBe("migration gap")
  })

  it("marks manifest-backed assets as generator gaps", () => {
    const context = makeContext({ manifestAssets: new Set(["logo.svg"]) })
    expect(classifyReason("src/assets/logo.svg", "assets", "different", context)).toBe(
      "generator gap",
    )
  })

  it("marks non-manifest assets as migration gaps", () => {
    expect(
      classifyReason("assets/linux/icon_64x64.png", "assets", "different", makeContext()),
    ).toBe("migration gap")
  })

  it("marks unrelated files as schema gaps", () => {
    expect(
      classifyReason("src/utils/persist-route.ts", "other", "only_in_reference", makeContext()),
    ).toBe("schema gap")
  })
})

describe("helpers", () => {
  it("extracts component name from vue component path", () => {
    expect(componentNameFromFile("src/components/FlowEditorPage.vue")).toBe("FlowEditorPage")
  })

  it("returns null for non-component paths", () => {
    expect(componentNameFromFile("src/router.ts")).toBeNull()
  })

  it("detects layout components", () => {
    expect(isLayoutComponent("ProjectLayout")).toBe(true)
    expect(isLayoutComponent("ProjectsSidebar")).toBe(true)
    expect(isLayoutComponent("ProjectPage")).toBe(false)
  })

  it("skips generated runtime directories", () => {
    expect(shouldSkipDir("node_modules")).toBe(true)
    expect(shouldSkipDir("dist")).toBe(true)
    expect(shouldSkipDir(".git")).toBe(true)
    expect(shouldSkipDir("src")).toBe(false)
  })

  it("creates a classified entry", () => {
    const entry = createEntry(
      "src/components/ProjectsListPage.vue",
      "different",
      makeContext({
        manifestComponents: new Set(["ProjectsListPage"]),
        routeRoots: new Set(["ProjectsListPage"]),
      }),
    )

    expect(entry).toEqual({
      file: "src/components/ProjectsListPage.vue",
      area: "pages",
      reason: "generator gap",
      status: "different",
    })
  })

  it("counts entries by selected key", () => {
    const entries: DiffEntry[] = [
      { file: "a", area: "shell", reason: "generator gap", status: "different" },
      { file: "b", area: "shell", reason: "generator gap", status: "different" },
      { file: "c", area: "pages", reason: "migration gap", status: "only_in_reference" },
    ]

    expect(countBy(entries, (entry) => entry.area)).toEqual({ shell: 2, pages: 1 })
    expect(countBy(entries, (entry) => entry.reason)).toEqual({
      "generator gap": 2,
      "migration gap": 1,
    })
  })
})
