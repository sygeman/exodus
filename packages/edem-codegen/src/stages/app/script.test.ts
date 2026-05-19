import { describe, expect, it } from "bun:test"
import { renderScript } from "./script"
import type { IR, IRComponent } from "../../ir"

function makeIR(component: IRComponent): IR {
  return {
    project: { name: "test", identifier: "test.local" },
    components: [component],
    routes: [],
    collections: [],
    flows: [],
    assets: [],
    layout: { hasAppLayout: false, hasSidebar: false, hasTopMenu: false, navigation: [] },
    platform: { platform: "electrobun", features: { waylandWorkaround: false } },
    usedComponents: [],
  }
}

describe("renderScript", () => {
  it("hoists rawScript imports before generated statements", () => {
    const component: IRComponent = {
      name: "SettingsLanguage",
      tree: {
        component: "section",
        children: { $type: "translation", en: "Language", ru: "Язык" },
        rawScript:
          "import { computed } from 'vue'\nimport { useSingleton } from '@/hooks'\n\nconst { data: appState } = useSingleton('app_state')\nconst selectedLocale = computed(() => appState.value?.data.locale)",
      },
      usedCollections: [],
      usedFlows: [],
      routeParams: [],
      needsRouter: false,
      needsEdem: false,
      hasFormBindings: false,
    }

    const script = renderScript(component, makeIR(component), new Map())

    expect(script).toContain("import { computed } from 'vue'")
    expect(script).toContain('import { useT } from "@exodus/edem-vue"')
    expect(script).toContain("import { useSingleton } from '@/hooks'")
    expect(script.indexOf("import { computed } from 'vue'")).toBeLessThan(
      script.indexOf("const t = useT()"),
    )
    expect(script.indexOf("import { useSingleton } from '@/hooks'")).toBeLessThan(
      script.indexOf("const t = useT()"),
    )
  })

  it("skips useRoute when a catch-all route param is unused", () => {
    const component: IRComponent = {
      name: "NotFound",
      tree: {
        component: "div",
        children: { $type: "translation", en: "Page not found", ru: "Страница не найдена" },
      },
      usedCollections: [],
      usedFlows: [],
      routeParams: [],
      needsRouter: false,
      needsEdem: false,
      hasFormBindings: false,
    }

    const ir = makeIR(component)
    ir.routes = [
      {
        path: "/:pathMatch(.*)*",
        name: "not-found",
        componentName: "NotFound",
        params: ["pathMatch"],
      },
    ]

    const script = renderScript(component, ir, new Map())

    expect(script).not.toContain("useRoute")
    expect(script).not.toContain("const route = useRoute()")
  })
})
