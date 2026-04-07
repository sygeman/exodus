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
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
}

export const useProjectGraph = (id: string) => {
  const graphQuery = useQuery({
    queryKey: graphKeys.graph(id),
    queryFn: () => $fetch(`/api/control/projects/${id}/graph`).then((r: any) => {
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

    // Map node id to level
    const nodeLevels = new Map<string, string>(allNodes.map(n => [n.id, n.level]))
    // Special case for ROOT
    nodeLevels.set('ROOT', 'ROOT')

    return allEdges.filter(edge => {
      const sourceLevel = nodeLevels.get(edge.source) || ''
      const targetLevel = nodeLevels.get(edge.target) || ''

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
