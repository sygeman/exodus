// API client for Control service
const getBaseUrl = () => {
  // В dev режиме используем прокси через Nitro
  // В production используем env переменную
  return '/api/control'
}

export interface Project {
  id: string
  name: string
  gitUrl: string | null
  path: string
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface CreateProjectRequest {
  name: string
  gitUrl?: string
  initEmpty?: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const baseUrl = getBaseUrl()

// Generic fetch wrapper with error handling
async function apiFetch<T>(url: string, options?: any): Promise<T> {
  try {
    const response = await $fetch<ApiResponse<T>>(`${baseUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    
    if (!response.success) {
      throw new ApiError(response.error || 'Unknown error')
    }
    
    if (!response.data) {
      throw new ApiError('No data in response')
    }
    
    return response.data
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error
    }
    
    // Handle network errors
    if (error.message?.includes('fetch')) {
      throw new ApiError('Network error. Please check your connection.')
    }
    
    throw new ApiError(error.message || 'Request failed')
  }
}

export const projectsApi = {
  // Queries
  getAll: (): Promise<Project[]> => apiFetch('/projects'),
  
  getById: (id: string): Promise<Project> => apiFetch(`/projects/${id}`),
  
  // Mutations
  create: (data: CreateProjectRequest): Promise<Project> => 
    apiFetch('/projects', { method: 'POST', body: data }),
  
  delete: (id: string): Promise<void> => 
    apiFetch(`/projects/${id}`, { method: 'DELETE' }),
}
