import { describe, expect, it } from "bun:test"
import {
  addUiNodeChild,
  canUiNodeAcceptChildren,
  getUiNodeAtPath,
  insertUiNodeRelative,
  moveUiNode,
  moveUiNodeRelative,
  replaceUiNodeChildrenAtPath,
  removeUiNodeAtPath,
  serializeUiNodePath,
  updateUiNodeAtPath,
} from "./project-ui-tree"

describe("project ui tree", () => {
  const tree = {
    component: "div",
    children: [
      { component: "header", children: [] },
      { component: "main", children: [] },
    ],
  }

  it("updates a node by path", () => {
    expect(
      updateUiNodeAtPath(tree, [1], (node) => ({
        ...node,
        component: "section",
      })),
    ).toEqual({
      component: "div",
      children: [
        { component: "header", children: [] },
        { component: "section", children: [] },
      ],
    })
  })

  it("adds a child node and returns its path", () => {
    const result = addUiNodeChild(tree, [1], { component: "p" })

    expect(result.tree).toEqual({
      component: "div",
      children: [
        { component: "header", children: [] },
        { component: "main", children: [{ component: "p" }] },
      ],
    })
    expect(serializeUiNodePath(result.path)).toBe("1.0")
    expect(getUiNodeAtPath(result.tree, result.path)).toEqual({ component: "p" })
  })

  it("inserts a sibling before the target node", () => {
    const result = insertUiNodeRelative(tree, [1], "before", { component: "section", children: [] })

    expect(result.tree).toEqual({
      component: "div",
      children: [
        { component: "header", children: [] },
        { component: "section", children: [] },
        { component: "main", children: [] },
      ],
    })
    expect(result.path).toEqual([1])
  })

  it("inserts a sibling after the target node", () => {
    const result = insertUiNodeRelative(tree, [0], "after", { component: "section", children: [] })

    expect(result.tree).toEqual({
      component: "div",
      children: [
        { component: "header", children: [] },
        { component: "section", children: [] },
        { component: "main", children: [] },
      ],
    })
    expect(result.path).toEqual([1])
  })

  it("inserts inside the target container", () => {
    const result = insertUiNodeRelative(tree, [1], "inside", { component: "section", children: [] })

    expect(result.tree).toEqual({
      component: "div",
      children: [
        { component: "header", children: [] },
        { component: "main", children: [{ component: "section", children: [] }] },
      ],
    })
    expect(result.path).toEqual([1, 0])
  })

  it("inserts inside root as the last child", () => {
    const result = insertUiNodeRelative(tree, [], "inside", { component: "footer", children: [] })

    expect(result.tree).toEqual({
      component: "div",
      children: [
        { component: "header", children: [] },
        { component: "main", children: [] },
        { component: "footer", children: [] },
      ],
    })
    expect(result.path).toEqual([2])
  })

  it("ignores inside insertion for leaf nodes", () => {
    const leafTree = {
      component: "div",
      children: [{ component: "input" }],
    }

    const result = insertUiNodeRelative(leafTree, [0], "inside", {
      component: "section",
      children: [],
    })

    expect(result.tree).toEqual(leafTree)
    expect(result.path).toEqual([0])
  })

  it("moves siblings up and down", () => {
    expect(moveUiNode(tree, [1], "up").tree).toEqual({
      component: "div",
      children: [
        { component: "main", children: [] },
        { component: "header", children: [] },
      ],
    })
  })

  it("moves a node before another sibling", () => {
    expect(
      moveUiNodeRelative(
        {
          component: "div",
          children: [
            { component: "header", children: [] },
            { component: "main", children: [] },
            { component: "footer", children: [] },
          ],
        },
        [2],
        [0],
        "before",
      ),
    ).toEqual({
      tree: {
        component: "div",
        children: [
          { component: "footer", children: [] },
          { component: "header", children: [] },
          { component: "main", children: [] },
        ],
      },
      path: [0],
    })
  })

  it("moves a node inside another container", () => {
    expect(
      moveUiNodeRelative(
        {
          component: "div",
          children: [
            { component: "header", children: [] },
            { component: "main", children: [] },
            { component: "section", children: [{ component: "p", children: [] }] },
          ],
        },
        [0],
        [2],
        "inside",
      ),
    ).toEqual({
      tree: {
        component: "div",
        children: [
          { component: "main", children: [] },
          {
            component: "section",
            children: [
              { component: "p", children: [] },
              { component: "header", children: [] },
            ],
          },
        ],
      },
      path: [1, 1],
    })
  })

  it("ignores dropping a node into its own descendant", () => {
    const nestedTree = {
      component: "div",
      children: [
        {
          component: "section",
          children: [{ component: "p", children: [] }],
        },
      ],
    }

    expect(moveUiNodeRelative(nestedTree, [0], [0, 0], "inside")).toEqual({
      tree: nestedTree,
      path: [0],
    })
  })

  it("removes a node and selects the nearest path", () => {
    const result = removeUiNodeAtPath(tree, [1])

    expect(result.tree).toEqual({
      component: "div",
      children: [{ component: "header", children: [] }],
    })
    expect(result.path).toEqual([0])
  })

  it("detects which nodes can accept children", () => {
    expect(canUiNodeAcceptChildren({ component: "div" })).toBe(true)
    expect(canUiNodeAcceptChildren({ component: "input" })).toBe(false)
    expect(canUiNodeAcceptChildren({ component: "UButton", children: "Save" })).toBe(false)
    expect(canUiNodeAcceptChildren({ component: "template" })).toBe(true)
  })

  it("replaces children at a container path", () => {
    expect(
      replaceUiNodeChildrenAtPath(tree, [1], [{ component: "section", children: [] }]),
    ).toEqual({
      component: "div",
      children: [
        { component: "header", children: [] },
        { component: "main", children: [{ component: "section", children: [] }] },
      ],
    })
  })
})
