import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Project, CreateProjectRequest } from './useProjectsApi'

// Query keys
const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: string) => [...projectKeys.lists(), { filters }] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
}

export const useProjects = () => {
  const queryClient = useQueryClient()
  const toast = useToast()
  
  // Queries
  const projectsQuery = useQuery({
    queryKey: projectKeys.lists(),
    queryFn: () => $fetch('/api/control/projects').then((r: any) => {
      if (!r.success) throw new Error(r.error)
      return r.data as Project[]
    }),
  })
  
  const useProject = (id: string) => useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => $fetch(`/api/control/projects/${id}`).then((r: any) => {
      if (!r.success) throw new Error(r.error)
      return r.data as Project
    }),
    enabled: !!id,
  })
  
  // Mutations
  const createProject = useMutation({
    mutationFn: (data: CreateProjectRequest) => 
      $fetch('/api/control/projects', { 
        method: 'POST', 
        body: data 
      }).then((r: any) => {
        if (!r.success) throw new Error(r.error)
        return r.data[0] as Project
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      toast.add({
        title: 'Project created',
        description: `"${data.name}" has been created successfully`,
        color: 'success',
      })
    },
    onError: (error: Error) => {
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to create project',
        color: 'error',
      })
    },
  })
  
  const deleteProject = useMutation({
    mutationFn: (id: string) => 
      $fetch(`/api/control/projects/${id}`, { 
        method: 'DELETE' 
      }).then((r: any) => {
        if (!r.success) throw new Error(r.error)
        return id
      }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) })
      toast.add({
        title: 'Project archived',
        color: 'success',
      })
    },
    onError: (error: Error) => {
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to archive project',
        color: 'error',
      })
    },
  })

  const pullProject = useMutation({
    mutationFn: (id: string) => 
      $fetch(`/api/control/projects/${id}/pull`, { 
        method: 'POST' 
      }).then((r: any) => {
        if (!r.success) throw new Error(r.error)
        return id
      }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) })
      toast.add({
        title: 'Pulled latest changes',
        color: 'success',
      })
    },
    onError: (error: Error) => {
      toast.add({
        title: 'Error',
        description: error.message || 'Failed to pull',
        color: 'error',
      })
    },
  })
  
  return {
    // Queries
    projects: computed(() => projectsQuery.data.value ?? []),
    isLoading: projectsQuery.isLoading,
    isError: projectsQuery.isError,
    error: projectsQuery.error,
    refetch: projectsQuery.refetch,
    useProject,
    
    // Mutations
    createProject,
    deleteProject,
    pullProject,
  }
}
