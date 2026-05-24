import { toRaw } from "vue"
import type { ComponentNode } from "@/project-manifest-schemas"

export type UiNodePath = number[]
export type UiNodeInsertPosition = "before" | "after" | "inside"

const VOID_HTML_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
])

const SLOT_COMPONENTS = new Set(["RouterLink", "UButton", "UTooltip"])

export function serializeUiNodePath(path: UiNodePath): string {
  return path.length === 0 ? "root" : path.join(".")
}

export function parseUiNodePath(value: string | null | undefined): UiNodePath {
  if (!value || value === "root") {
    return []
  }

  return value
    .split(".")
    .map((segment) => Number(segment))
    .filter((segment) => Number.isInteger(segment) && segment >= 0)
}

export function getUiNodeLabel(node: ComponentNode): string {
  if (typeof node.children === "string" && node.children.trim() !== "") {
    return `${node.component} · ${node.children.trim().slice(0, 32)}`
  }

  return node.component
}

export function cloneUiTreeValue<T>(value: T): T {
  return structuredClone(toRaw(value))
}

function cloneTree(tree: ComponentNode): ComponentNode {
  return cloneUiTreeValue(tree)
}

function isPathPrefix(prefix: UiNodePath, value: UiNodePath): boolean {
  return prefix.length <= value.length && prefix.every((segment, index) => segment === value[index])
}

function adjustPathAfterRemoval(sourcePath: UiNodePath, targetPath: UiNodePath): UiNodePath {
  const maxDepth = Math.min(sourcePath.length, targetPath.length)

  for (let index = 0; index < maxDepth; index += 1) {
    if (index === sourcePath.length - 1) {
      if (targetPath[index] > sourcePath[index]) {
        return [
          ...targetPath.slice(0, index),
          targetPath[index] - 1,
          ...targetPath.slice(index + 1),
        ]
      }

      return targetPath
    }

    if (sourcePath[index] !== targetPath[index]) {
      return targetPath
    }
  }

  return targetPath
}

function getChildren(node: ComponentNode): ComponentNode[] | null {
  return Array.isArray(node.children) ? node.children : null
}

export function canUiNodeAcceptChildren(node: ComponentNode): boolean {
  if (typeof node.children === "string") {
    return false
  }

  if (Array.isArray(node.children)) {
    return true
  }

  if (node.component === "template") {
    return true
  }

  const isHtmlTag = node.component[0] === node.component[0]?.toLowerCase()
  if (isHtmlTag) {
    return !VOID_HTML_ELEMENTS.has(node.component)
  }

  return SLOT_COMPONENTS.has(node.component) || node.component.endsWith("Layout")
}

export function getUiNodeAtPath(tree: ComponentNode, path: UiNodePath): ComponentNode | null {
  let current: ComponentNode = tree

  for (const index of path) {
    const children = getChildren(current)
    if (!children || !children[index]) {
      return null
    }
    current = children[index]
  }

  return current
}

export function getUiNodeChildrenAtPath(tree: ComponentNode, path: UiNodePath): ComponentNode[] {
  const node = getUiNodeAtPath(tree, path)
  if (!node || !canUiNodeAcceptChildren(node)) {
    return []
  }

  return Array.isArray(node.children) ? node.children : []
}

export function updateUiNodeAtPath(
  tree: ComponentNode,
  path: UiNodePath,
  updater: (node: ComponentNode) => ComponentNode,
): ComponentNode {
  if (path.length === 0) {
    return updater(cloneTree(tree))
  }

  const nextTree = cloneTree(tree)
  const parent = getUiNodeAtPath(nextTree, path.slice(0, -1))
  const children = parent ? getChildren(parent) : null
  const targetIndex = path.at(-1)

  if (!children || targetIndex === undefined || !children[targetIndex]) {
    return nextTree
  }

  children[targetIndex] = updater(children[targetIndex])
  return nextTree
}

export function addUiNodeChild(
  tree: ComponentNode,
  path: UiNodePath,
  child: ComponentNode,
): { tree: ComponentNode; path: UiNodePath } {
  const nextTree = cloneTree(tree)
  const parent = getUiNodeAtPath(nextTree, path)

  if (!parent) {
    return { tree: nextTree, path }
  }

  if (!canUiNodeAcceptChildren(parent)) {
    throw new Error("Нельзя добавить child в узел с текстовыми children")
  }

  const nextChildren = Array.isArray(parent.children) ? [...parent.children] : []
  nextChildren.push(child)
  parent.children = nextChildren

  return {
    tree: nextTree,
    path: [...path, nextChildren.length - 1],
  }
}

export function insertUiNodeRelative(
  tree: ComponentNode,
  path: UiNodePath,
  position: UiNodeInsertPosition,
  node: ComponentNode,
): { tree: ComponentNode; path: UiNodePath } {
  const nextTree = cloneTree(tree)

  if (position === "inside") {
    const parent = getUiNodeAtPath(nextTree, path)
    if (!parent || !canUiNodeAcceptChildren(parent)) {
      return { tree: nextTree, path }
    }

    const nextChildren = Array.isArray(parent.children) ? [...parent.children] : []
    nextChildren.push(node)
    parent.children = nextChildren

    return {
      tree: nextTree,
      path: [...path, nextChildren.length - 1],
    }
  }

  if (path.length === 0) {
    return { tree: nextTree, path }
  }

  const parentPath = path.slice(0, -1)
  const parent = getUiNodeAtPath(nextTree, parentPath)
  const children = parent ? getChildren(parent) : null
  const targetIndex = path.at(-1)

  if (!parent || !children || targetIndex === undefined || !children[targetIndex]) {
    return { tree: nextTree, path }
  }

  const insertIndex = position === "before" ? targetIndex : targetIndex + 1
  children.splice(insertIndex, 0, node)
  parent.children = children

  return {
    tree: nextTree,
    path: [...parentPath, insertIndex],
  }
}

export function removeUiNodeAtPath(
  tree: ComponentNode,
  path: UiNodePath,
): { tree: ComponentNode; path: UiNodePath } {
  if (path.length === 0) {
    return { tree, path }
  }

  const nextTree = cloneTree(tree)
  const parentPath = path.slice(0, -1)
  const parent = getUiNodeAtPath(nextTree, parentPath)
  const children = parent ? getChildren(parent) : null
  const targetIndex = path.at(-1)

  if (!parent || !children || targetIndex === undefined || !children[targetIndex]) {
    return { tree: nextTree, path: parentPath }
  }

  children.splice(targetIndex, 1)
  parent.children = children.length > 0 ? children : undefined

  if (children.length === 0) {
    return { tree: nextTree, path: parentPath }
  }

  return {
    tree: nextTree,
    path: [...parentPath, Math.min(targetIndex, children.length - 1)],
  }
}

export function moveUiNode(
  tree: ComponentNode,
  path: UiNodePath,
  direction: "up" | "down",
): { tree: ComponentNode; path: UiNodePath } {
  if (path.length === 0) {
    return { tree, path }
  }

  const nextTree = cloneTree(tree)
  const parentPath = path.slice(0, -1)
  const parent = getUiNodeAtPath(nextTree, parentPath)
  const children = parent ? getChildren(parent) : null
  const targetIndex = path.at(-1)

  if (!children || targetIndex === undefined || !children[targetIndex]) {
    return { tree: nextTree, path }
  }

  const nextIndex = direction === "up" ? targetIndex - 1 : targetIndex + 1
  if (nextIndex < 0 || nextIndex >= children.length) {
    return { tree: nextTree, path }
  }

  ;[children[targetIndex], children[nextIndex]] = [children[nextIndex], children[targetIndex]]

  return {
    tree: nextTree,
    path: [...parentPath, nextIndex],
  }
}

export function moveUiNodeRelative(
  tree: ComponentNode,
  sourcePath: UiNodePath,
  targetPath: UiNodePath,
  position: UiNodeInsertPosition,
): { tree: ComponentNode; path: UiNodePath } {
  if (sourcePath.length === 0 || isPathPrefix(sourcePath, targetPath)) {
    return { tree, path: sourcePath }
  }

  const sourceNode = getUiNodeAtPath(tree, sourcePath)
  if (!sourceNode) {
    return { tree, path: sourcePath }
  }

  const nextNode = cloneUiTreeValue(sourceNode)
  const removed = removeUiNodeAtPath(tree, sourcePath)
  const adjustedTargetPath = adjustPathAfterRemoval(sourcePath, targetPath)

  return insertUiNodeRelative(removed.tree, adjustedTargetPath, position, nextNode)
}

export function replaceUiNodeChildrenAtPath(
  tree: ComponentNode,
  path: UiNodePath,
  children: ComponentNode[],
): ComponentNode {
  const nextTree = cloneTree(tree)
  const target = getUiNodeAtPath(nextTree, path)

  if (!target || !canUiNodeAcceptChildren(target)) {
    return nextTree
  }

  target.children = children
  return nextTree
}
