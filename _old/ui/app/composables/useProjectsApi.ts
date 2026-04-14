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
