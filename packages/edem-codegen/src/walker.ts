// ── Component Tree Walker ──────────────────────────────────────────────────────
// Generic recursive traversal for ExtendedComponentNode trees.
// Eliminates duplicated traversal logic across parse.ts and app.ts.

import type { ExtendedComponentNode } from "./ir"

type NodeVisitor = (node: ExtendedComponentNode) => void

/**
 * Walk every node in the component tree, calling `visitor` on each.
 * Traverses: bind.item, modal.footer, namedSlots, empty.action, children.
 */
export function walkComponentTree(node: ExtendedComponentNode, visitor: NodeVisitor): void {
  visitor(node)

  if (node.bind?.item) {
    walkComponentTree(node.bind.item, visitor)
  }

  if (node.modal?.footer) {
    for (const child of node.modal.footer) {
      walkComponentTree(child, visitor)
    }
  }

  if (node.namedSlots) {
    for (const slotNodes of Object.values(node.namedSlots)) {
      for (const child of slotNodes) {
        walkComponentTree(child, visitor)
      }
    }
  }

  if (node.empty?.action) {
    walkComponentTree(node.empty.action, visitor)
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkComponentTree(child, visitor)
    }
  }
}

/**
 * Collect all values returned by `collector` across the entire tree.
 * Deduplicates via Set.
 */
export function collectFromTree<T>(
  node: ExtendedComponentNode,
  collector: (node: ExtendedComponentNode) => T[],
): T[] {
  const result = new Set<T>()

  walkComponentTree(node, (n) => {
    for (const value of collector(n)) {
      result.add(value)
    }
  })

  return [...result]
}

/**
 * Returns true if `predicate` matches any node in the tree.
 */
export function someInTree(
  node: ExtendedComponentNode,
  predicate: (node: ExtendedComponentNode) => boolean,
): boolean {
  let found = false

  walkComponentTree(node, (n) => {
    if (predicate(n)) found = true
  })

  return found
}
