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
  it("generates defineProps when manifest template uses props", () => {
    const component: IRComponent = {
      name: "SettingsLayout",
      tree: {
        component: "section",
        children: "{{ props.title }}",
      },
      usedCollections: [],
      usedFlows: [],
      routeParams: [],
      needsRouter: false,
      needsEdem: false,
      hasFormBindings: false,
    }

    const script = renderScript(component, makeIR(component), new Map())

    expect(script).toContain("const props = defineProps<{ [key: string]: unknown }>()")
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
