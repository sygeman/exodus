import { describe, it, expect } from "bun:test"
import { ref, Teleport, Transition, type Component } from "vue"
import { renderNode, type RenderContext, type ComponentRegistry } from "./renderer"
import type { ComponentNode } from "@exodus/edem-ui"

function createContext(overrides?: Partial<RenderContext>): RenderContext {
  return {
    route: {},
    state: {},
    collections: {},
    singletons: {},
    helpers: {},
    t: (messages, params) => {
      const msg = messages.en ?? Object.values(messages)[0]
      if (!params) return msg
      return msg.replace(/\{(\w+)\}/g, (_, key: string) =>
        key in params ? String(params[key]) : `{${key}}`,
      )
    },
    handlers: {},
    ...overrides,
  }
}

function createRegistry(components?: Record<string, unknown>): ComponentRegistry {
  const registry: ComponentRegistry = {
    div: "div",
    span: "span",
    p: "p",
    h1: "h1",
    h2: "h2",
    h3: "h3",
    button: "button",
    section: "section",
    aside: "aside",
    nav: "nav",
    label: "label",
    pre: "pre",
    main: "main",
  }
  if (components) {
    for (const [name, comp] of Object.entries(components)) {
      registry[name] = comp as Component
    }
  }
  return registry
}

describe("renderNode", () => {
  it("renders native HTML element", () => {
    const node: ComponentNode = {
      component: "div",
      props: { class: "flex" },
    }

    const vNode = renderNode(node, createRegistry(), createContext())
    expect(vNode).not.toBeNull()
    expect(vNode!.type).toBe("div")
    expect(vNode!.props).toEqual({ class: "flex" })
  })

  it("renders component from registry", () => {
    const MockButton = { name: "MockButton" }
    const registry = createRegistry({ UButton: MockButton })
    const node: ComponentNode = {
      component: "UButton",
      props: { color: "primary" },
    }

    const vNode = renderNode(node, registry, createContext())
    expect(vNode).not.toBeNull()
    expect(vNode!.type).toBe(MockButton)
    expect(vNode!.props).toEqual({ color: "primary" })
  })

  it("resolves template expression in props", () => {
    const ctx = createContext({
      route: { id: "123" },
    })
    const node: ComponentNode = {
      component: "div",
      props: { "data-id": "{{ route.id }}" },
    }

    const vNode = renderNode(node, createRegistry(), ctx)
    expect(vNode!.props!["data-id"]).toBe("123")
  })

  it("resolves nested template expression", () => {
    const ctx = createContext({
      state: { item: ref({ name: "Test" }) },
    })
    const node: ComponentNode = {
      component: "span",
      props: { class: "{{ item.name }}" },
    }

    const vNode = renderNode(node, createRegistry(), ctx)
    expect(vNode!.props!.class).toBe("Test")
  })

  it("renders string children", () => {
    const node: ComponentNode = {
      component: "div",
      children: "Hello world",
    }

    const vNode = renderNode(node, createRegistry(), createContext())
    expect(vNode!.children).toBe("Hello world")
  })

  it("renders translation children", () => {
    const ctx = createContext()
    const node: ComponentNode = {
      component: "div",
      children: {
        $type: "translation",
        en: "Hello",
        ru: "Привет",
      },
    }

    const vNode = renderNode(node, createRegistry(), ctx)
    expect(vNode!.children).toBe("Hello")
  })

  it("renders translation with params", () => {
    const ctx = createContext()
    const node: ComponentNode = {
      component: "div",
      children: {
        $type: "translation",
        en: "{total} items",
      },
    }

    const vNode = renderNode(node, createRegistry(), ctx)
    expect(vNode!.children).toBe("{total} items")
  })

  it("renders array children", () => {
    const node: ComponentNode = {
      component: "div",
      children: [
        { component: "span", children: "one" },
        { component: "span", children: "two" },
      ],
    }

    const vNode = renderNode(node, createRegistry(), createContext())
    expect(Array.isArray(vNode!.children)).toBe(true)
    const children = vNode!.children as any[]
    expect(children.length).toBe(2)
    expect(children[0].type).toBe("span")
    expect(children[0].children).toBe("one")
    expect(children[1].type).toBe("span")
    expect(children[1].children).toBe("two")
  })

  it("skips node when if condition is false", () => {
    const ctx = createContext({ state: { loading: ref(false) } })
    const node: ComponentNode = {
      component: "div",
      if: "loading",
      children: "Loading...",
    }

    const vNode = renderNode(node, createRegistry(), ctx)
    expect(vNode).toBeNull()
  })

  it("renders node when if condition is true", () => {
    const ctx = createContext({ state: { loading: ref(true) } })
    const node: ComponentNode = {
      component: "div",
      if: "loading",
      children: "Loading...",
    }

    const vNode = renderNode(node, createRegistry(), ctx)
    expect(vNode).not.toBeNull()
    expect(vNode!.children).toBe("Loading...")
  })

  it("renders elseWhen branch", () => {
    const ctx = createContext({ state: { loading: ref(false), error: ref(null) } })
    const node: ComponentNode = {
      component: "div",
      elseIf: "error",
      children: "Error occurred",
    }

    const vNode = renderNode(node, createRegistry(), ctx)
    expect(vNode).toBeNull()
  })

  it("renders else branch", () => {
    const ctx = createContext()
    const node: ComponentNode = {
      component: "div",
      else: true,
      children: "Default content",
    }

    const vNode = renderNode(node, createRegistry(), ctx)
    expect(vNode).not.toBeNull()
    expect(vNode!.children).toBe("Default content")
  })

  it("renders named slots", () => {
    const MockCard = { name: "MockCard" }
    const registry = createRegistry({ UCard: MockCard })
    const node: ComponentNode = {
      component: "UCard",
      namedSlots: {
        header: [{ component: "h1", children: "Title" }],
        default: [{ component: "p", children: "Content" }],
      },
    }

    const vNode = renderNode(node, registry, createContext())
    expect(vNode).not.toBeNull()
    expect(vNode!.type).toBe(MockCard)

    const slots = vNode!.children as Record<string, () => any[]>
    expect(typeof slots.header).toBe("function")
    expect(typeof slots.default).toBe("function")

    const headerVNodes = slots.header()
    expect(headerVNodes.length).toBe(1)
    expect(headerVNodes[0].type).toBe("h1")
    expect(headerVNodes[0].children).toBe("Title")

    const defaultVNodes = slots.default()
    expect(defaultVNodes.length).toBe(1)
    expect(defaultVNodes[0].type).toBe("p")
    expect(defaultVNodes[0].children).toBe("Content")
  })

  it("renders teleport", () => {
    const node: ComponentNode = {
      component: "div",
      teleport: "body",
      children: [{ component: "span", children: "teleported" }],
    }

    const vNode = renderNode(node, createRegistry(), createContext())
    expect(vNode).not.toBeNull()
    expect(vNode!.type).toBe(Teleport)
    expect(vNode!.props).toEqual({ to: "body" })
  })

  it("renders transition", () => {
    const node: ComponentNode = {
      component: "div",
      transition: {
        enterActiveClass: "transition-opacity",
        enterFromClass: "opacity-0",
      },
      children: [{ component: "span", children: "fade" }],
    }

    const vNode = renderNode(node, createRegistry(), createContext())
    expect(vNode).not.toBeNull()
    expect(vNode!.type).toBe(Transition)
    expect(vNode!.props).toEqual({
      "enter-active-class": "transition-opacity",
      "enter-from-class": "opacity-0",
    })
  })

  it("maps model binding to Vue model props", () => {
    const handler = () => {}
    const ctx = createContext({
      handlers: { "flow:updateField": handler },
    })
    const node: ComponentNode = {
      component: "UInput",
      model: {
        value: "{{ route.id }}",
        onChange: { flow: "updateField" },
      },
    }

    const vNode = renderNode(node, createRegistry({ UInput: { name: "UInput" } }), {
      ...ctx,
      route: { id: "abc" },
    })
    expect(vNode).not.toBeNull()
    expect(vNode!.props!.modelValue).toBe("abc")
    expect(typeof vNode!.props!["onUpdate:modelValue"]).toBe("function")
  })

  it("renders modal wrapper", () => {
    const registry = createRegistry({ UModal: { name: "UModal" } })
    const node: ComponentNode = {
      component: "div",
      modal: {
        vModel: "open",
        title: { $type: "translation", en: "Confirm" },
      },
      children: [{ component: "span", children: "Body" }],
    }

    const vNode = renderNode(node, registry, createContext({ state: { open: ref(true) } }))
    expect(vNode).not.toBeNull()
    expect(vNode!.type).toBe(registry.UModal)
    expect(vNode!.props!.open).toBe(true)
    expect(vNode!.props!.title).toBe("Confirm")
  })

  it("binds event handlers", () => {
    const handler = () => {}
    const ctx = createContext({
      handlers: { "flow:clearLogs": handler },
    })
    const node: ComponentNode = {
      component: "button",
      events: {
        click: { flow: "clearLogs" },
      },
    }

    const vNode = renderNode(node, createRegistry(), ctx)
    expect(vNode).not.toBeNull()
    expect(typeof vNode!.props!.onClick).toBe("function")
  })

  it("resolves translation in props", () => {
    const ctx = createContext()
    const node: ComponentNode = {
      component: "UButton",
      props: {
        label: { $type: "translation", en: "Click me", ru: "Нажми" },
      },
    }

    const vNode = renderNode(node, createRegistry(), ctx)
    expect(vNode!.props!.label).toBe("Click me")
  })

  it("handles null children", () => {
    const node: ComponentNode = {
      component: "div",
    }

    const vNode = renderNode(node, createRegistry(), createContext())
    expect(vNode).not.toBeNull()
    expect(vNode!.children).toBeNull()
  })

  it("handles nested component trees", () => {
    const node: ComponentNode = {
      component: "div",
      props: { class: "container" },
      children: [
        {
          component: "h1",
          children: "Title",
        },
        {
          component: "p",
          props: { class: "text" },
          children: [
            {
              component: "span",
              children: "nested",
            },
          ],
        },
      ],
    }

    const vNode = renderNode(node, createRegistry(), createContext())
    expect(vNode).not.toBeNull()
    expect(vNode!.type).toBe("div")

    const children = vNode!.children as any[]
    expect(children.length).toBe(2)
    expect(children[0].type).toBe("h1")
    expect(children[0].children).toBe("Title")
    expect(children[1].type).toBe("p")
    expect(children[1].props!.class).toBe("text")

    const innerChildren = children[1].children as any[]
    expect(innerChildren.length).toBe(1)
    expect(innerChildren[0].type).toBe("span")
    expect(innerChildren[0].children).toBe("nested")
  })
})
