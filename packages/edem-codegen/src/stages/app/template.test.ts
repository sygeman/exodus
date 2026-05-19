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

  it("omits template wrappers for target item loops", () => {
    const node: ExtendedComponentNode = {
      component: "template",
      bind: {
        items: "data",
        alias: "project",
        key: "{{ project.id }}",
        target: "item",
        item: {
          component: "RouterLink",
          props: { to: "/project/{{ project.id }}/overview" },
          children: "{{ project.data.name }}",
        },
      },
    }

    const { template } = renderNode(node, "  ", ir, "ProjectsListPage")

    expect(template).toContain('<RouterLink v-for="project in data" :key="project.id"')
    expect(template).not.toContain("<template")
  })

  it("compresses sequential numeric arrays into count-based loops", () => {
    const node: ExtendedComponentNode = {
      component: "template",
      bind: {
        items: [1, 2, 3, 4, 5],
        alias: "i",
        key: "{{ i }}",
        target: "item",
        item: {
          component: "div",
          children: "{{ i }}",
        },
      },
    }

    const { template } = renderNode(node, "  ", ir, "ProjectsListPage")

    expect(template).toContain('<div v-for="i in 5" :key="i">{{ i }}</div>')
  })

  it("splits template literal class bindings into static and dynamic parts", () => {
    const node: ExtendedComponentNode = {
      component: "span",
      props: {
        class: "{{ `base classes ${statusClass ?? ''}` }}",
      },
      children: "Label",
    }

    const { template } = renderNode(node, "  ", ir, "ProjectFlowsPage")

    expect(template).toContain('class="base classes"')
    expect(template).toContain(`:class="statusClass ?? ''"`)
  })
})
