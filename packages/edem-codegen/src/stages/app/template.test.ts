import { describe, expect, it } from "bun:test"
import { renderNode } from "./template"
import type { ExtendedComponentNode, IR } from "../../ir"

const ir: IR = {
  project: { name: "test", identifier: "test.local" },
  components: [],
  routes: [],
  collections: [],
  flows: [],
  assets: [],
  layout: { hasAppLayout: false, hasSidebar: false, hasTopMenu: false, navigation: [] },
  platform: { platform: "electrobun", features: { waylandWorkaround: false } },
  usedComponents: [],
}

describe("renderNode", () => {
  it("uses bind alias and hoists repeated item attrs onto the item node", () => {
    const node: ExtendedComponentNode = {
      component: "div",
      bind: {
        items: "locales",
        key: "{{ l.value }}",
        alias: "l",
        target: "item",
        item: {
          component: "button",
          props: {
            type: "button",
            class:
              "{{ { 'base classes': true, 'selected': selectedLocale === l.value, 'muted': selectedLocale !== l.value } }}",
          },
          events: { click: { expression: "selectedLocale = l.value" } },
          children: [{ component: "span", children: "{{ l.label }}" }],
        },
      },
    }

    const { template } = renderNode(node, "  ", ir, "SettingsLanguage")

    expect(template).toContain('<button v-for="l in locales" :key="l.value" type="button"')
    expect(template).toContain('class="base classes"')
    expect(template).toContain(
      `:class="{ 'selected': selectedLocale === l.value, 'muted': selectedLocale !== l.value }"`,
    )
    expect(template).not.toContain("(l, idx)")
  })
})
