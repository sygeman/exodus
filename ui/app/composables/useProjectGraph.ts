import { useQuery } from '@tanstack/vue-query'
import type { ACSDNode, ACSDEdge } from '~/types/acsd'

interface GraphResponse {
  nodes: ACSDNode[]
  edges: ACSDEdge[]
}

// Query keys
const graphKeys = {
  all: ['projects'] as const,
  graph: (id: string) => [...graphKeys.all, id, 'graph'] as const,
}

const levelOrder: Record<string, number> = {
  ROOT: -1,
  draft: 0,
  L0: 1,
  L1: 2,
  L2: 3,
  L3: 4,
  L4: 5,
}

export const useProjectGraph = (id: string) => {
  const graphQuery = useQuery({
    queryKey: graphKeys.graph(id),
    queryFn: () => $fetch(`/api/control/projects/${id}/cascade/graph`).then((r: any) => {
      if (!r.success) throw new Error(r.error)
      return r.data as GraphResponse
    }),
    enabled: !!id,
  })

  const nodes = computed(() => graphQuery.data.value?.nodes ?? [])
  const edges = computed(() => graphQuery.data.value?.edges ?? [])

  // Filter only hierarchy edges (between adjacent levels)
  const hierarchyEdges = computed(() => {
    const allNodes = nodes.value
    const allEdges = edges.value

    // Map node id to level (null for draft)
    const nodeLevels = new Map<string, string | null>(allNodes.map(n => [n.id, n.level]))
    // Special case for ROOT
    nodeLevels.set('ROOT', 'ROOT')

    return allEdges.filter(edge => {
      const sourceLevel = nodeLevels.get(edge.source) ?? null
      const targetLevel = nodeLevels.get(edge.target) ?? null

      // Skip edges involving draft nodes
      if (sourceLevel === null || targetLevel === null) return false
      if (sourceLevel === 'ROOT' || targetLevel === 'ROOT') return true

      const sourceOrder = levelOrder[sourceLevel] ?? 999
      const targetOrder = levelOrder[targetLevel] ?? 999

      // Keep only edges to next level (hierarchy)
      return targetOrder === sourceOrder + 1
    })
  })

  return {
    nodes,
    edges,
    hierarchyEdges,
    isLoading: graphQuery.isLoading,
    isError: graphQuery.isError,
    error: graphQuery.error,
    refetch: graphQuery.refetch,
  }
}
