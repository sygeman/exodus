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
  parentId?: string;
  edges?: Array<{
    targetId: string;
    type: ACSDEdgeType;
  }>;
}

export interface RemoveNodePayload {
  nodeId: string;
  removeConnectedEdges?: boolean;
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

// === API Types ===

export interface Project {
  id: string;
  name: string;
  gitUrl: string | null;
  path: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskRequest {
  task_id: string;
  command: string;
  callback_url: string;
  working_dir?: string;
  model?: {
    provider: string;
    modelId: string;
    apiKey: string;
  };
  role_prompt?: string;
}

export interface TaskResponse {
  success: boolean;
  status: 'accepted' | 'rejected' | 'completed' | 'failed';
  task_id: string;
  model?: {
    provider: string;
    modelId: string;
  };
  error?: string;
}

export interface CallbackPayload {
  task_id: string;
  status: string;
  result?: string;
  error?: string | null;
  exit_code: number;
}

export interface SuggestionResult {
  text: string;
  level: string | null;
  type: string | null;
  edges: Array<{ targetId: string; type: string }>;
}

export interface SuggestRequest {
  nodeId: string;
  userInput?: string;
}

export interface SuggestResponse {
  success: boolean;
  data?: SuggestionResult;
  error?: string;
}
