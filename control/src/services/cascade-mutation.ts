import type {
  ACSDNode,
  ACSDEdge,
  ACSDGraph,
  ACSDNodeLevel,
  ACSDNodeType,
  ACSDEdgeType,
  AddNodePayload,
  AddEdgePayload,
  RemoveNodePayload,
  RemoveEdgePayload,
  GraphDiff,
} from '../types/cascade';

/**
 * In-memory граф с поддержкой мутаций
 */
export class MutableGraph {
  private nodes: Map<string, ACSDNode> = new Map();
  private edges: Map<string, ACSDEdge> = new Map();
  private edgeCounter = 0;

  // Track changes for diff
  private diff: GraphDiff = {
    addedNodes: [],
    removedNodes: [],
    addedEdges: [],
    removedEdge: [],
  };

  constructor(initialGraph?: ACSDGraph) {
    if (initialGraph) {
      for (const node of initialGraph.nodes) {
        this.nodes.set(node.id, node);
      }
      for (const edge of initialGraph.edges) {
        this.edges.set(edge.id, edge);
      }
      // Set edge counter to max existing
      for (const edge of initialGraph.edges) {
        const num = parseInt(edge.id.replace('edge-', ''), 10);
        if (!isNaN(num) && num > this.edgeCounter) {
          this.edgeCounter = num;
        }
      }
    }
  }

  /**
   * Получить текущее состояние графа
   */
  getGraph(): ACSDGraph {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  /**
   * Получить ноду по ID
   */
  getNode(id: string): ACSDNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Получить все ноды
   */
  getAllNodes(): ACSDNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Получить связь по ID
   */
  getEdge(id: string): ACSDEdge | undefined {
    return this.edges.get(id);
  }

  /**
   * Получить все связи
   */
  getAllEdges(): ACSDEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Получить входящие связи для ноды
   */
  getIncomingEdges(nodeId: string): ACSDEdge[] {
    return Array.from(this.edges.values()).filter(
      (e) => e.target === nodeId
    );
  }

  /**
   * Получить исходящие связи для ноды
   */
  getOutgoingEdges(nodeId: string): ACSDEdge[] {
    return Array.from(this.edges.values()).filter(
      (e) => e.source === nodeId
    );
  }

  /**
   * Добавить ноду в граф
   */
  addNode(id: string, payload: AddNodePayload): ACSDNode {
    const node: ACSDNode = {
      id,
      level: payload.level ?? null,
      type: payload.type ?? null,
      text: payload.text,
      status: payload.status || 'draft',
      ideaId: id,
      position: { x: 0, y: 0 },
    };

    this.nodes.set(id, node);
    this.diff.addedNodes.push(node);

    // Добавить связи если указаны
    if (payload.edges) {
      for (const edgeDef of payload.edges) {
        this.addEdgeInternal(id, edgeDef.targetId, edgeDef.type);
      }
    }

    return node;
  }

  /**
   * Удалить ноду из графа
   */
  removeNode(payload: RemoveNodePayload): {
    removedNode: ACSDNode;
    removedEdges: ACSDEdge[];
  } {
    const node = this.nodes.get(payload.nodeId);
    if (!node) {
      throw new Error(`node_not_found: ${payload.nodeId}`);
    }

    const removeEdges = payload.removeConnectedEdges !== false;
    const removedEdges: ACSDEdge[] = [];

    // Удалить все связанные связи
    if (removeEdges) {
      const incoming = this.getIncomingEdges(payload.nodeId);
      const outgoing = this.getOutgoingEdges(payload.nodeId);

      for (const edge of [...incoming, ...outgoing]) {
        this.edges.delete(edge.id);
        removedEdges.push(edge);
        this.diff.removedEdge.push(edge);
      }
    } else {
      // Проверить что нет связей
      const incoming = this.getIncomingEdges(payload.nodeId);
      const outgoing = this.getOutgoingEdges(payload.nodeId);
      if (incoming.length > 0 || outgoing.length > 0) {
        throw new Error(
          `node_has_edges: ${payload.nodeId} has ${incoming.length} incoming and ${outgoing.length} outgoing edges. Set removeConnectedEdges=true or remove edges first.`
        );
      }
    }

    // Удалить ноду
    this.nodes.delete(payload.nodeId);
    this.diff.removedNodes.push(node);

    return { removedNode: node, removedEdges };
  }

  /**
   * Добавить связь между нодами
   */
  addEdge(payload: AddEdgePayload): ACSDEdge {
    // Проверить что обе ноды существуют
    if (!this.nodes.has(payload.sourceId)) {
      throw new Error(`source_node_not_found: ${payload.sourceId}`);
    }
    if (!this.nodes.has(payload.targetId)) {
      throw new Error(`target_node_not_found: ${payload.targetId}`);
    }

    return this.addEdgeInternal(payload.sourceId, payload.targetId, payload.type);
  }

  private addEdgeInternal(
    sourceId: string,
    targetId: string,
    type: ACSDEdgeType
  ): ACSDEdge {
    // Проверить что обе ноды существуют
    if (!this.nodes.has(sourceId)) {
      throw new Error(`source_node_not_found: ${sourceId}`);
    }
    if (!this.nodes.has(targetId)) {
      throw new Error(`target_node_not_found: ${targetId}`);
    }

    const edgeId = `edge-${++this.edgeCounter}`;
    const edge: ACSDEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type,
    };

    this.edges.set(edgeId, edge);
    this.diff.addedEdges.push(edge);

    return edge;
  }

  /**
   * Удалить связь
   */
  removeEdge(payload: RemoveEdgePayload): ACSDEdge {
    const edge = this.edges.get(payload.edgeId);
    if (!edge) {
      throw new Error(`edge_not_found: ${payload.edgeId}`);
    }

    this.edges.delete(payload.edgeId);
    this.diff.removedEdge.push(edge);

    return edge;
  }

  /**
   * Получить diff изменений с момента создания/последнего коммита
   */
  getDiff(): GraphDiff {
    return { ...this.diff };
  }

  /**
   * Сбросить diff (после коммита)
   */
  resetDiff() {
    this.diff = {
      addedNodes: [],
      removedNodes: [],
      addedEdges: [],
      removedEdge: [],
    };
  }

  /**
   * Сгенерировать уникальный ID для ноды
   */
  static generateId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

/**
 * In-memory хранилище графов по проектам
 */
export class GraphStore {
  private graphs: Map<string, MutableGraph> = new Map();

  /**
   * Получить или создать граф для проекта
   */
  get(projectId: string): MutableGraph | undefined {
    return this.graphs.get(projectId);
  }

  /**
   * Установить граф для проекта
   */
  set(projectId: string, graph: MutableGraph) {
    this.graphs.set(projectId, graph);
  }

  /**
   * Удалить граф для проекта
   */
  remove(projectId: string) {
    this.graphs.delete(projectId);
  }

  /**
   * Проверить что граф существует
   */
  has(projectId: string): boolean {
    return this.graphs.has(projectId);
  }
}

// Singleton instance
export const graphStore = new GraphStore();
