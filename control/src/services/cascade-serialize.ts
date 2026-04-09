import { writeFile, mkdir, rm } from 'fs/promises';
import { dirname, join } from 'path';
import YAML from 'yaml';
import type {
  ACSDNode,
  ACSDEdge,
  ACSDGraph,
  ACSDNodeLevel,
  YAMLIdea,
  YAMLFile,
  ExodusConfig,
  CascadeCommitResult,
} from '../types/cascade';

/**
 * Уровень -> тип артефакта
 */
const LEVEL_TO_TYPE: Record<ACSDNodeLevel, string> = {
  L0: 'vision',
  L1: 'design',
  L2: 'specification',
  L3: 'contract',
  L4: 'code',
};

/**
 * Путь к директории exodus для проекта
 */
function getExodusDir(projectPath: string): string {
  return join(projectPath, 'exodus');
}

/**
 * Получить путь к файлу для уровня
 */
function getFilePathForLevel(
  level: ACSDNodeLevel | 'draft',
  projectPath: string
): string {
  const exodusDir = getExodusDir(projectPath);
  switch (level) {
    case 'draft':
      return join(exodusDir, 'draft.yaml');
    case 'L0':
      return join(exodusDir, 'vision.yaml');
    case 'L1':
      return join(exodusDir, 'design.yaml');
    case 'L2':
      return join(exodusDir, 'specification.yaml');
    case 'L3':
      return join(exodusDir, 'contract.yaml');
    case 'L4':
      return join(exodusDir, 'code.yaml');
  }
}

/**
 * Получить derives_from для уровня
 */
function getDerivesFrom(level: ACSDNodeLevel): string | undefined {
  switch (level) {
    case 'L0':
      return undefined;
    case 'L1':
      return 'exodus-vision';
    case 'L2':
      return 'exodus-design';
    case 'L3':
      return 'exodus-specification';
    case 'L4':
      return 'exodus-contract';
  }
}

/**
 * Получить ID файла для уровня
 */
function getFileIdForLevel(level: ACSDNodeLevel): string {
  switch (level) {
    case 'L0':
      return 'exodus-vision';
    case 'L1':
      return 'exodus-design';
    case 'L2':
      return 'exodus-specification';
    case 'L3':
      return 'exodus-contract';
    case 'L4':
      return 'exodus-code';
  }
}

/**
 * Сгруппировать ноды по уровням
 */
function groupNodesByLevel(graph: ACSDGraph): Map<ACSDNodeLevel | 'draft', ACSDNode[]> {
  const groups = new Map<ACSDNodeLevel | 'draft', ACSDNode[]>();

  for (const node of graph.nodes) {
    // Пропускаем ROOT
    if (node.id === 'ROOT') continue;

    const key = node.level || 'draft';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(node);
  }

  return groups;
}

/**
 * Построить map связей для ноды
 */
function buildEdgeMap(
  edges: ACSDEdge[],
  nodeId: string
): Record<string, string[]> {
  const edgeMap: Record<string, string[]> = {};

  for (const edge of edges) {
    if (edge.source === nodeId) {
      if (!edgeMap[edge.type]) {
        edgeMap[edge.type] = [];
      }
      edgeMap[edge.type]!.push(edge.target);
    }
  }

  return edgeMap;
}

/**
 * Преобразовать ноду в YAMLIdea
 */
function nodeToIdea(node: ACSDNode, edgeMap: Record<string, string[]>): YAMLIdea {
  const idea: YAMLIdea = {
    id: node.id,
    type: node.type,
    text: node.text,
  };

  // Добавить связи
  for (const [edgeType, targets] of Object.entries(edgeMap)) {
    if (targets.length > 0) {
      switch (edgeType) {
        case 'implements':
          idea.implements = targets;
          break;
        case 'requires':
          idea.requires = targets;
          break;
        case 'part_of':
          idea.part_of = targets;
          break;
        case 'supports':
          idea.supports = targets;
          break;
        case 'contradicts':
          idea.contradicts = targets;
          break;
      }
    }
  }

  return idea;
}

/**
 * Построить YAML файл для уровня
 */
function buildYamlFileForLevel(
  level: ACSDNodeLevel | 'draft',
  nodes: ACSDNode[],
  graph: ACSDGraph
): YAMLFile {
  const edgeMapByNode = new Map<string, Record<string, string[]>>();

  // Построить map связей для каждой ноды
  for (const node of nodes) {
    edgeMapByNode.set(node.id, buildEdgeMap(graph.edges, node.id));
  }

  // Преобразовать ноды в идеи
  const ideas = nodes.map((node) =>
    nodeToIdea(node, edgeMapByNode.get(node.id) || {})
  );

  // Сортировать идеи по ID для детерминированности
  ideas.sort((a, b) => a.id.localeCompare(b.id));

  const yamlFile: YAMLFile = {
    meta: {
      level: level === 'draft' ? 'L0' : level,
      type: level === 'draft' ? 'draft' : LEVEL_TO_TYPE[level],
      id: level === 'draft' ? 'exodus-draft' : getFileIdForLevel(level),
      derives_from: level === 'draft' ? undefined : getDerivesFrom(level),
      status: level === 'draft' ? 'draft' : 'exists',
      created: new Date().toISOString().split('T')[0],
    },
    ideas,
  };

  return yamlFile;
}

/**
 * Сериализовать граф в YAML файлы
 */
export async function serializeGraphToYaml(
  graph: ACSDGraph,
  projectPath: string
): Promise<CascadeCommitResult> {
  const filesWritten: string[] = [];

  try {
    // Сгруппировать ноды по уровням
    const groups = groupNodesByLevel(graph);

    // Если граф пустой — удаляем все YAML файлы
    if (groups.size === 0) {
      const exodusDir = getExodusDir(projectPath);
      try {
        await rm(exodusDir, { recursive: true, force: true });
      } catch {
        // Директория уже не существует
      }
      return {
        success: true,
        filesWritten: [],
      };
    }

    // Записать файлы для каждого уровня
    for (const [level, nodes] of groups) {
      const yamlFile = buildYamlFileForLevel(level, nodes, graph);
      const filePath = getFilePathForLevel(level, projectPath);

      // Создать директорию если нужно
      await mkdir(dirname(filePath), { recursive: true });

      // Сериализовать в YAML
      const yamlContent = YAML.stringify(yamlFile, {
        indent: 2,
        lineWidth: 0, // Не переносить длинные строки
        nullStr: '',
      });

      await writeFile(filePath, yamlContent, 'utf-8');
      filesWritten.push(filePath);
    }

    // Записать exodus.yaml если L0 существует
    if (groups.has('L0')) {
      const configPath = join(projectPath, 'exodus.yaml');
      const config: ExodusConfig = {
        vision: './exodus/vision.yaml',
      };
      const configContent = YAML.stringify(config, { indent: 2 });
      await writeFile(configPath, configContent, 'utf-8');
      filesWritten.push(configPath);
    }

    return {
      success: true,
      filesWritten,
    };
  } catch (error) {
    return {
      success: false,
      filesWritten,
      error: `serialization_error: ${error}`,
    };
  }
}
