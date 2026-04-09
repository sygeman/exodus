import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import YAML from 'yaml';
import { readdir } from 'fs/promises';
import type {
  ACSDNode,
  ACSDEdge,
  ACSDGraph,
  YAMLFile,
  ExodusConfig,
  YAMLIdea,
  ACSDEdgeType,
  ACSDNodeLevel,
  ACSDNodeType,
} from '../types/cascade';

const EDGE_TYPES: ACSDEdgeType[] = [
  'implements',
  'requires',
  'part_of',
  'supports',
  'contradicts',
];

/**
 * Read and parse YAML file
 */
async function readYamlFile<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, 'utf-8');
    return YAML.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Find files in directory that match the derives_from filter
 */
async function findDerivedFiles(
  basePath: string,
  derivesFrom: string
): Promise<string[]> {
  const results: string[] = [];

  async function scanDir(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
          const content = await readYamlFile<YAMLFile>(fullPath);
          if (content?.meta?.derives_from === derivesFrom) {
            results.push(fullPath);
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  await scanDir(basePath);
  return results;
}

/**
 * Parse level from meta.level
 */
function parseLevel(level: string): ACSDNodeLevel | null {
  if (['L0', 'L1', 'L2', 'L3', 'L4'].includes(level)) {
    return level as ACSDNodeLevel;
  }
  return null;
}

/**
 * Parse node type
 */
function parseNodeType(type: string): ACSDNodeType | null {
  const validTypes: ACSDNodeType[] = [
    'goal',
    'non_goal',
    'constraint',
    'invariant',
    'component',
    'decision',
    'principle',
  ];
  if (validTypes.includes(type as ACSDNodeType)) {
    return type as ACSDNodeType;
  }
  return null;
}

/**
 * Build graph from YAML files following derives_from chain
 */
export async function buildGraphFromYaml(
  projectPath: string,
  projectName?: string
): Promise<ACSDGraph> {
  const nodes: ACSDNode[] = [];
  const edges: ACSDEdge[] = [];
  const processedFiles = new Set<string>();
  const nodeIds = new Set<string>();
  let edgeCounter = 0;

  // Read exodus.yaml
  const configPath = join(projectPath, 'exodus.yaml');
  const config = await readYamlFile<ExodusConfig>(configPath);

  if (!config?.vision) {
    // Пустой проект — пробуем загрузить только draft
    const exodusDir = join(projectPath, 'exodus');
    const draftPath = join(exodusDir, 'draft.yaml');
    const draftContent = await readYamlFile<YAMLFile>(draftPath);
    if (draftContent?.meta && draftContent.ideas) {
      for (const idea of draftContent.ideas) {
        const nodeType = idea.type ? parseNodeType(idea.type) : null;

        const node: ACSDNode = {
          id: idea.id,
          level: null,
          type: nodeType,
          text: idea.text,
          status: 'draft',
          ideaId: idea.id,
          position: { x: 0, y: 0 },
        };
        nodes.push(node);
        nodeIds.add(idea.id);
      }
    }
    return { nodes, edges };
  }

  // Resolve vision path
  const visionPath = join(projectPath, config.vision);
  const exodusDir = join(projectPath, 'exodus');

  // Queue of files to process with their level
  const queue: Array<{ path: string; level: ACSDNodeLevel }> = [
    { path: visionPath, level: 'L0' },
  ];

  // Collect all L0 node IDs to connect them to root
  const l0NodeIds: string[] = [];

  // Process files level by level
  while (queue.length > 0) {
    const { path: filePath, level } = queue.shift()!;

    if (processedFiles.has(filePath)) {
      continue;
    }
    processedFiles.add(filePath);

    const content = await readYamlFile<YAMLFile>(filePath);
    if (!content?.meta) {
      continue;
    }

    const fileId = content.meta.id;
    const fileLevel = parseLevel(content.meta.level) || level;
    const fileStatus = content.meta.status || 'exists';

    // Process ideas
    const ideas = content.ideas || [];
    for (const idea of ideas) {
      if (!idea.type) continue;
      if (!idea.type) continue;
        const nodeType = parseNodeType(idea.type);
      if (!nodeType) {
        continue;
      }

      // Create node
      const node: ACSDNode = {
        id: idea.id,
        level: fileLevel,
        type: nodeType,
        text: idea.text,
        status: fileStatus === 'draft' ? 'draft' : 'exists',
        ideaId: idea.id,
        position: { x: 0, y: 0 },
      };

      if (!nodeIds.has(idea.id)) {
        nodes.push(node);
        nodeIds.add(idea.id);

        // Collect L0 nodes for root connection
        if (fileLevel === 'L0') {
          l0NodeIds.push(idea.id);
        }
      }

      // Create edges from idea links
      for (const edgeType of EDGE_TYPES) {
        const targets = idea[edgeType];
        if (!targets) continue;

        const targetList = Array.isArray(targets) ? targets : [targets];

        for (const target of targetList) {
          const edge: ACSDEdge = {
            id: `edge-${++edgeCounter}`,
            source: idea.id,
            target,
            type: edgeType,
          };
          edges.push(edge);
        }
      }
    }

    // Find next level files
    const nextLevelMap: Record<ACSDNodeLevel, ACSDNodeLevel | null> = {
      L0: 'L1',
      L1: 'L2',
      L2: 'L3',
      L3: 'L4',
      L4: null,
    };

    const nextLevel = nextLevelMap[fileLevel];
    if (nextLevel) {
      const derivedFiles = await findDerivedFiles(exodusDir, fileId);

      for (const derivedPath of derivedFiles) {
        if (!processedFiles.has(derivedPath)) {
          queue.push({ path: derivedPath, level: nextLevel });
        }
      }
    }
  }

  // Загрузить draft ноды из draft.yaml
  const draftPath = join(exodusDir, 'draft.yaml');
  const draftContent = await readYamlFile<YAMLFile>(draftPath);
  if (draftContent?.meta && draftContent.ideas) {
    for (const idea of draftContent.ideas) {
      const nodeType = idea.type ? parseNodeType(idea.type) : null;

      const node: ACSDNode = {
        id: idea.id,
        level: null,
        type: nodeType,
        text: idea.text,
        status: 'draft',
        ideaId: idea.id,
        position: { x: 0, y: 0 },
      };

      if (!nodeIds.has(idea.id)) {
        nodes.push(node);
        nodeIds.add(idea.id);
      }

      for (const edgeType of EDGE_TYPES) {
        const targets = idea[edgeType];
        if (!targets) continue;
        const targetList = Array.isArray(targets) ? targets : [targets];
        for (const target of targetList) {
          edges.push({
            id: `edge-${++edgeCounter}`,
            source: idea.id,
            target,
            type: edgeType,
          });
        }
      }
    }
  }

  // Add root node with project name
  const rootNodeId = 'ROOT';
  const rootNode: ACSDNode = {
    id: rootNodeId,
    level: 'L0',
    type: 'component',
    text: projectName || 'Project',
    status: 'exists',
    ideaId: rootNodeId,
    position: { x: 0, y: 0 },
  };
  nodes.unshift(rootNode);

  // Connect root to all L0 nodes
  for (const l0Id of l0NodeIds) {
    const edge: ACSDEdge = {
      id: `edge-${++edgeCounter}`,
      source: rootNodeId,
      target: l0Id,
      type: 'supports',
    };
    edges.push(edge);
  }

  return { nodes, edges };
}
