export interface ACSDNode {
  id: string
  level: 'L0' | 'L1' | 'L2' | 'L3' | 'L4'
  type: 'goal' | 'component' | 'invariant' | 'principle' | 'decision' | 'constraint' | 'non_goal'
  text: string
  status: 'exists' | 'draft' | 'gap'
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
  level: ACSDNode['level']
  type: ACSDNode['type']
  text: string
  status: ACSDNode['status']
  ideaId?: string
}
