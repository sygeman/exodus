export type ACSDNodeLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export type ACSDNodeType =
  | 'goal'
  | 'non_goal'
  | 'constraint'
  | 'invariant'
  | 'component'
  | 'decision'
  | 'principle';

export type ACSDNodeStatus = 'exists' | 'draft' | 'gap';

export type ACSDEdgeType =
  | 'implements'
  | 'requires'
  | 'part_of'
  | 'supports'
  | 'contradicts';

export interface ACSDNode {
  id: string;
  level: ACSDNodeLevel | null;
  type: ACSDNodeType | null;
  text: string;
  status: ACSDNodeStatus;
  ideaId?: string;
  position: { x: number; y: number };
}

export interface ACSDEdge {
  id: string;
  source: string;
  target: string;
  type: ACSDEdgeType;
}

export interface ACSDGraph {
  nodes: ACSDNode[];
  edges: ACSDEdge[];
}

// YAML file structure
export interface YAMLMeta {
  level: ACSDNodeLevel;
  type: string;
  id: string;
  derives_from?: string;
  status?: string;
  created?: string;
}

export interface YAMLIdea {
  id: string;
  type: ACSDNodeType | null;
  text: string;
  implements?: string | string[];
  requires?: string | string[];
  part_of?: string | string[];
  supports?: string | string[];
  contradicts?: string | string[];
}

export interface YAMLFile {
  meta: YAMLMeta;
  ideas?: YAMLIdea[];
}

// Root config
export interface ExodusConfig {
  vision: string;
}

// === Graph Mutation Types ===

export interface AddNodePayload {
  level: ACSDNodeLevel | null;
  type: ACSDNodeType | null;
  text: string;
  status?: ACSDNodeStatus;
  parentId?: string; // для связи implements с родителем
  edges?: Array<{
    targetId: string;
    type: ACSDEdgeType;
  }>;
}

export interface RemoveNodePayload {
  nodeId: string;
  removeConnectedEdges?: boolean; // по умолчанию true
}

export interface AddEdgePayload {
  sourceId: string;
  targetId: string;
  type: ACSDEdgeType;
}

export interface RemoveEdgePayload {
  edgeId: string;
}

export type GraphOperation =
  | { type: 'add_node'; payload: AddNodePayload & { id?: string } }
  | { type: 'remove_node'; payload: RemoveNodePayload }
  | { type: 'add_edge'; payload: AddEdgePayload }
  | { type: 'remove_edge'; payload: RemoveEdgePayload };

export interface GraphDiff {
  addedNodes: ACSDNode[];
  removedNodes: ACSDNode[];
  addedEdges: ACSDEdge[];
  removedEdge: ACSDEdge[];
}

export interface CascadeCommitResult {
  success: boolean;
  filesWritten: string[];
  error?: string;
}
