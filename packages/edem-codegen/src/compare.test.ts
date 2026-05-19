import { describe, expect, it } from "bun:test"
import {
  classifyArea,
  classifyReason,
  componentNameFromFile,
  contentsMatchForParity,
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

  it("treats blank-line-only text diffs as parity matches", () => {
    const reference = Buffer.from("const a = 1\n\nconst b = 2\n")
    const generated = Buffer.from("const a = 1\nconst b = 2\n")

    expect(contentsMatchForParity("src/example.ts", reference, generated)).toBe(true)
  })

  it("treats trailing whitespace diffs as parity matches", () => {
    const reference = Buffer.from("<div>\n  <span>Hi</span>  \n</div>\n")
    const generated = Buffer.from("<div>\n  <span>Hi</span>\n</div>\n")

    expect(contentsMatchForParity("src/example.vue", reference, generated)).toBe(true)
  })

  it("treats reordered import lines as parity matches", () => {
    const reference = Buffer.from(
      'import { computed } from "vue"\nimport { useT } from "@exodus/edem-vue"\n\nconst t = useT()\n',
    )
    const generated = Buffer.from(
      'import { useT } from "@exodus/edem-vue"\nimport { computed } from "vue"\n\nconst t = useT()\n',
    )

    expect(contentsMatchForParity("src/example.ts", reference, generated)).toBe(true)
  })

  it("treats multiline vue interpolations as parity matches", () => {
    const reference = Buffer.from(
      '<h3 class="text-base font-medium">\n  {{ t({ en: "Dark mode" }) }}\n</h3>\n',
    )
    const generated = Buffer.from(
      '<h3 class="text-base font-medium">{{ t({ en: "Dark mode" }) }}</h3>\n',
    )

    expect(contentsMatchForParity("src/example.vue", reference, generated)).toBe(true)
  })

  it("treats wrapped interpolation bodies as parity matches", () => {
    const reference = Buffer.from(
      '<UButton to="/projects" color="primary">\n  {{ t({ en: "Back to projects", ru: "Назад к проектам" }) }}\n</UButton>\n',
    )
    const generated = Buffer.from(
      '<UButton to="/projects" color="primary">{{\n  t({ en: "Back to projects", ru: "Назад к проектам" })\n}}</UButton>\n',
    )

    expect(contentsMatchForParity("src/example.vue", reference, generated)).toBe(true)
  })

  it("keeps meaningful text diffs as mismatches", () => {
    const reference = Buffer.from("const a = 1\n")
    const generated = Buffer.from("const a = 2\n")

    expect(contentsMatchForParity("src/example.ts", reference, generated)).toBe(false)
  })

  it("does not normalize binary files", () => {
    const reference = Buffer.from([0, 1, 2, 3])
    const generated = Buffer.from([0, 1, 2, 4])

    expect(contentsMatchForParity("assets/icon.png", reference, generated)).toBe(false)
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
