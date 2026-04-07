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
  level: ACSDNodeLevel;
  type: ACSDNodeType;
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
  type: ACSDNodeType;
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
