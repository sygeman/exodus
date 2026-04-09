export type ACSDNodeLevel = null | 'L0' | 'L1' | 'L2' | 'L3' | 'L4'

export type ACSDNodeType =
  | 'goal'
  | 'non_goal'
  | 'constraint'
  | 'invariant'
  | 'component'
  | 'decision'
  | 'principle'

export type ACSDNodeStatus = 'exists' | 'draft' | 'gap'

export type ACSDEdgeType =
  | 'implements'
  | 'requires'
  | 'part_of'
  | 'supports'
  | 'contradicts'

export interface ACSDNode {
  id: string
  level: ACSDNodeLevel
  type: ACSDNodeType
  text: string
  status: ACSDNodeStatus
  ideaId?: string
  position: { x: number; y: number }
}

export interface ACSDEdge {
  id: string
  source: string
  target: string
  type: 'implements' | 'requires' | 'part_of' | 'supports' | 'contradicts'
}

export interface ACSDGraph {
  nodes: ACSDNode[]
  edges: ACSDEdge[]
}

export interface ACSDNodeData {
  level: ACSDNodeLevel
  type: ACSDNodeType
  text: string
  status: ACSDNodeStatus
  ideaId?: string
}
