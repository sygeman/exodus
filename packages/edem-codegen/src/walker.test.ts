import { describe, it, expect } from "bun:test"
import { walkComponentTree, collectFromTree, someInTree } from "./walker"
import type { ExtendedComponentNode } from "./ir"

function makeNode(partial: Partial<ExtendedComponentNode> = {}): ExtendedComponentNode {
  return { component: "div", ...partial }
}

describe("walkComponentTree", () => {
  it("visits root node", () => {
    const visited: string[] = []
    const node = makeNode({ props: { id: "root" } })
    walkComponentTree(node, (n) => visited.push(n.component))
    expect(visited).toEqual(["div"])
  })

  it("visits children", () => {
    const visited: string[] = []
    const node = makeNode({
      children: [makeNode({ component: "span" }), makeNode({ component: "p" })],
    })
    walkComponentTree(node, (n) => visited.push(n.component))
    expect(visited).toEqual(["div", "span", "p"])
  })

  it("visits bind.item", () => {
    const visited: string[] = []
    const node = makeNode({
      bind: { item: makeNode({ component: "li" }) },
    })
    walkComponentTree(node, (n) => visited.push(n.component))
    expect(visited).toEqual(["div", "li"])
  })

  it("visits modal.footer", () => {
    const visited: string[] = []
    const node = makeNode({
      modal: { vModel: "open", footer: [makeNode({ component: "button" })] },
    })
    walkComponentTree(node, (n) => visited.push(n.component))
    expect(visited).toEqual(["div", "button"])
  })

  it("visits namedSlots", () => {
    const visited: string[] = []
    const node = makeNode({
      namedSlots: { header: [makeNode({ component: "h1" })] },
    })
    walkComponentTree(node, (n) => visited.push(n.component))
    expect(visited).toEqual(["div", "h1"])
  })

  it("visits empty.action", () => {
    const visited: string[] = []
    const node = makeNode({
      empty: { action: makeNode({ component: "button" }) },
    })
    walkComponentTree(node, (n) => visited.push(n.component))
    expect(visited).toEqual(["div", "button"])
  })

  it("visits deeply nested structure", () => {
    const visited: string[] = []
    const node = makeNode({
      children: [
        makeNode({
          component: "section",
          children: [makeNode({ component: "span" })],
        }),
      ],
    })
    walkComponentTree(node, (n) => visited.push(n.component))
    expect(visited).toEqual(["div", "section", "span"])
  })
})

describe("collectFromTree", () => {
  it("collects values from all nodes", () => {
    const node = makeNode({
      bind: { collection: "users" },
      children: [
        makeNode({ bind: { collection: "posts" } }),
        makeNode({ bind: { collection: "users" } }),
      ],
    })
    const cols = collectFromTree(node, (n) => (n.bind?.collection ? [n.bind.collection] : []))
    expect(cols).toEqual(["users", "posts"])
  })
})

describe("someInTree", () => {
  it("returns true if any node matches", () => {
    const node = makeNode({
      children: [makeNode({ component: "span" }), makeNode({ skeleton: true })],
    })
    expect(someInTree(node, (n) => !!n.skeleton)).toBe(true)
  })

  it("returns false if no node matches", () => {
    const node = makeNode({
      children: [makeNode({ component: "span" })],
    })
    expect(someInTree(node, (n) => !!n.skeleton)).toBe(false)
  })
})
