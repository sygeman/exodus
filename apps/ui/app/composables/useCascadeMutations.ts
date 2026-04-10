import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { ACSDNode, ACSDEdge, ACSDNodeLevel, ACSDNodeType, ACSDEdgeType } from '~/types/acsd'

interface GraphResponse {
  nodes: ACSDNode[]
  edges: ACSDEdge[]
}

interface DiffResponse {
  addedNodes: ACSDNode[]
  removedNodes: ACSDNode[]
  addedEdges: ACSDEdge[]
  removedEdge: ACSDEdge[]
}

interface AddNodeRequest {
  level: ACSDNodeLevel | null
  type?: ACSDNodeType
  text: string
  parentId?: string
  edges?: Array<{ targetId: string; type: ACSDEdgeType }>
}

interface AddEdgeRequest {
  sourceId: string
  targetId: string
  type: ACSDEdgeType
}

const cascadeKeys = {
  all: ['projects'] as const,
  graph: (id: string) => [...cascadeKeys.all, id, 'graph'] as const,
  diff: (id: string) => [...cascadeKeys.all, id, 'cascade', 'diff'] as const,
}

export const useCascadeMutations = (projectId: string) => {
  const queryClient = useQueryClient()
  const toast = useToast()

  const invalidateGraph = () => {
    queryClient.refetchQueries({ queryKey: cascadeKeys.graph(projectId) })
    queryClient.invalidateQueries({ queryKey: cascadeKeys.diff(projectId) })
  }

  // === GET /diff ===
  const diffQuery = useQuery({
    queryKey: cascadeKeys.diff(projectId),
    queryFn: () =>
      $fetch(`/api/control/projects/${projectId}/cascade/diff`).then((r: any) => {
        if (!r.success) throw new Error(r.error)
        return r.data as DiffResponse
      }),
    enabled: !!projectId,
    refetchOnWindowFocus: false,
  })

  // === POST /nodes ===
  const addNode = useMutation({
    mutationFn: (data: AddNodeRequest) =>
      $fetch(`/api/control/projects/${projectId}/cascade/nodes`, {
        method: 'POST',
        body: data,
      }).then((r: any) => {
        if (!r.success) throw new Error(r.error)
        return r.data as ACSDNode
      }),
    onMutate: async (newNode) => {
      await queryClient.cancelQueries({ queryKey: cascadeKeys.graph(projectId) })
      const previous = queryClient.getQueryData<GraphResponse>(cascadeKeys.graph(projectId))

      // Оптимистично добавляем ноду в кэш
      queryClient.setQueryData(cascadeKeys.graph(projectId), (old: GraphResponse | undefined) => {
        if (!old) return old
        return {
          ...old,
          nodes: [...old.nodes, {
            id: `temp-${Date.now()}`,
            level: newNode.level,
            type: null,
            text: newNode.text,
            status: 'draft' as const,
            position: { x: 0, y: 0 },
          }],
        }
      })

      return { previous }
    },
    onError: (error: Error, _vars, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(cascadeKeys.graph(projectId), context.previous)
      }
      toast.add({
        title: 'Error',
        description: error.message,
        color: 'error',
      })
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: cascadeKeys.graph(projectId) })
      queryClient.invalidateQueries({ queryKey: cascadeKeys.diff(projectId) })
      toast.add({
        title: 'Element created',
        description: 'Draft element added to the cascade',
        color: 'success',
      })
    },
  })

  // === DELETE /nodes/:nodeId ===
  const removeNode = useMutation({
    mutationFn: (nodeId: string) =>
      $fetch(`/api/control/projects/${projectId}/cascade/nodes/${nodeId}`, {
        method: 'DELETE',
      }).then((r: any) => {
        if (!r.success) throw new Error(r.error)
        return r.data
      }),
    onMutate: async (nodeId) => {
      await queryClient.cancelQueries({ queryKey: cascadeKeys.graph(projectId) })
      const previous = queryClient.getQueryData<GraphResponse>(cascadeKeys.graph(projectId))

      queryClient.setQueryData(cascadeKeys.graph(projectId), (old: GraphResponse | undefined) => {
        if (!old) return old
        return {
          nodes: old.nodes.filter(n => n.id !== nodeId),
          edges: old.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        }
      })

      return { previous }
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: cascadeKeys.graph(projectId) })
      queryClient.invalidateQueries({ queryKey: cascadeKeys.diff(projectId) })
      toast.add({
        title: 'Element removed',
        color: 'success',
      })
    },
    onError: (error: Error, _vars, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(cascadeKeys.graph(projectId), context.previous)
      }
      toast.add({
        title: 'Error',
        description: error.message,
        color: 'error',
      })
    },
  })

  // === POST /edges ===
  const addEdge = useMutation({
    mutationFn: (data: AddEdgeRequest) =>
      $fetch(`/api/control/projects/${projectId}/cascade/edges`, {
        method: 'POST',
        body: data,
      }).then((r: any) => {
        if (!r.success) throw new Error(r.error)
        return r.data as ACSDEdge
      }),
    onSuccess: () => {
      invalidateGraph()
    },
    onError: (error: Error) => {
      toast.add({
        title: 'Error',
        description: error.message,
        color: 'error',
      })
    },
  })

  // === DELETE /edges/:edgeId ===
  const removeEdge = useMutation({
    mutationFn: (edgeId: string) =>
      $fetch(`/api/control/projects/${projectId}/cascade/edges/${edgeId}`, {
        method: 'DELETE',
      }).then((r: any) => {
        if (!r.success) throw new Error(r.error)
        return r.data as ACSDEdge
      }),
    onSuccess: () => {
      invalidateGraph()
    },
    onError: (error: Error) => {
      toast.add({
        title: 'Error',
        description: error.message,
        color: 'error',
      })
    },
  })

  // === POST /commit ===
  const commit = useMutation({
    mutationFn: () =>
      $fetch(`/api/control/projects/${projectId}/cascade/commit`, {
        method: 'POST',
      }).then((r: any) => {
        if (!r.success) throw new Error(r.error)
        return r.data
      }),
    onSuccess: (data) => {
      invalidateGraph()
      toast.add({
        title: 'Committed',
        description: `${data.filesWritten?.length || 0} file(s) written to disk`,
        color: 'success',
      })
    },
    onError: (error: Error) => {
      toast.add({
        title: 'Error',
        description: error.message,
        color: 'error',
      })
    },
  })

  return {
    // Queries
    diff: computed(() => diffQuery.data.value ?? null),
    isDiffLoading: diffQuery.isLoading,

    // Mutations
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    commit,
  }
}
