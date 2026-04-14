import { describe, it, expect, beforeEach } from 'bun:test';
import { MutableGraph, GraphStore } from '../src/services/cascade-mutation';
import type { ACSDGraph, AddNodePayload, AddEdgePayload } from '@exodus/types';

describe('Cascade Mutation Service', () => {
  let graph: MutableGraph;

  const sampleGraph: ACSDGraph = {
    nodes: [
      {
        id: 'ROOT',
        level: 'L0',
        type: 'component',
        text: 'Test Project',
        status: 'exists',
        ideaId: 'ROOT',
        position: { x: 0, y: 0 },
      },
      {
        id: 'V-01',
        level: 'L0',
        type: 'goal',
        text: 'Test goal',
        status: 'exists',
        ideaId: 'V-01',
        position: { x: 0, y: 0 },
      },
      {
        id: 'V-02',
        level: 'L0',
        type: 'goal',
        text: 'Another goal',
        status: 'exists',
        ideaId: 'V-02',
        position: { x: 0, y: 0 },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'ROOT',
        target: 'V-01',
        type: 'supports',
      },
      {
        id: 'edge-2',
        source: 'V-02',
        target: 'V-01',
        type: 'requires',
      },
    ],
  };

  beforeEach(() => {
    graph = new MutableGraph(sampleGraph);
  });

  describe('Graph Initialization', () => {
    it('should initialize with existing graph', () => {
      const result = graph.getGraph();
      expect(result.nodes.length).toBe(3);
      expect(result.edges.length).toBe(2);
    });

    it('should initialize empty graph', () => {
      const emptyGraph = new MutableGraph();
      const result = emptyGraph.getGraph();
      expect(result.nodes.length).toBe(0);
      expect(result.edges.length).toBe(0);
    });
  });

  describe('Node Operations', () => {
    describe('Add Node', () => {
      it('should add a node with edges', () => {
        const payload: AddNodePayload = {
          level: 'L1',
          type: 'component',
          text: 'New component',
          edges: [
            { targetId: 'V-01', type: 'implements' },
          ],
        };

        const node = graph.addNode('D-COMP-001', payload);

        expect(node.id).toBe('D-COMP-001');
        expect(node.level).toBe('L1');
        expect(node.status).toBe('draft');

        const graphState = graph.getGraph();
        expect(graphState.nodes.length).toBe(4);
        expect(graphState.edges.length).toBe(3); // 2 original + 1 new
      });

      it('should add a node without edges', () => {
        const payload: AddNodePayload = {
          level: null,
          type: 'goal',
          text: 'Draft goal',
        };

        const node = graph.addNode('DRAFT-GOAL-001', payload);

        expect(node.level).toBeNull();
        expect(node.status).toBe('draft');

        const graphState = graph.getGraph();
        expect(graphState.nodes.length).toBe(4);
        expect(graphState.edges.length).toBe(2); // unchanged
      });

      it('should track added nodes in diff', () => {
        const payload: AddNodePayload = {
          level: 'L0',
          type: 'principle',
          text: 'New principle',
        };

        graph.addNode('D-PRIN-001', payload);

        const diff = graph.getDiff();
        expect(diff.addedNodes.length).toBe(1);
        expect(diff.addedNodes[0]!.id).toBe('D-PRIN-001');
      });
    });

    describe('Remove Node', () => {
      it('should remove a node and its connected edges', () => {
        const result = graph.removeNode({
          nodeId: 'V-02',
          removeConnectedEdges: true,
        });

        expect(result.removedNode.id).toBe('V-02');
        expect(result.removedEdges.length).toBe(1); // edge-2

        const graphState = graph.getGraph();
        expect(graphState.nodes.length).toBe(2);
        expect(graphState.edges.length).toBe(1); // only edge-1 remains
      });

      it('should fail to remove node with edges when removeConnectedEdges=false', () => {
        expect(() =>
          graph.removeNode({
            nodeId: 'V-02',
            removeConnectedEdges: false,
          })
        ).toThrow(/node_has_edges/);
      });

      it('should remove node without edges when removeConnectedEdges=false', () => {
        // First remove edges manually
        graph.removeEdge({ edgeId: 'edge-2' });

        const result = graph.removeNode({
          nodeId: 'V-02',
          removeConnectedEdges: false,
        });

        expect(result.removedNode.id).toBe('V-02');
        expect(result.removedEdges.length).toBe(0);
      });

      it('should fail to remove non-existent node', () => {
        expect(() =>
          graph.removeNode({
            nodeId: 'NON-EXISTENT',
            removeConnectedEdges: true,
          })
        ).toThrow(/node_not_found/);
      });

      it('should track removed nodes in diff', () => {
        graph.removeNode({
          nodeId: 'V-02',
          removeConnectedEdges: true,
        });

        const diff = graph.getDiff();
        expect(diff.removedNodes.length).toBe(1);
        expect(diff.removedNodes[0]!.id).toBe('V-02');
      });
    });

    describe('Get Node', () => {
      it('should get existing node', () => {
        const node = graph.getNode('V-01');
        expect(node).toBeDefined();
        expect(node!.type).toBe('goal');
      });

      it('should return undefined for non-existent node', () => {
        const node = graph.getNode('NON-EXISTENT');
        expect(node).toBeUndefined();
      });
    });
  });

  describe('Edge Operations', () => {
    describe('Add Edge', () => {
      it('should add an edge between existing nodes', () => {
        const payload: AddEdgePayload = {
          sourceId: 'V-01',
          targetId: 'V-02',
          type: 'supports',
        };

        const edge = graph.addEdge(payload);

        expect(edge.source).toBe('V-01');
        expect(edge.target).toBe('V-02');
        expect(edge.type).toBe('supports');

        const graphState = graph.getGraph();
        expect(graphState.edges.length).toBe(3);
      });

      it('should fail to add edge with non-existent source', () => {
        expect(() =>
          graph.addEdge({
            sourceId: 'NON-EXISTENT',
            targetId: 'V-01',
            type: 'supports',
          })
        ).toThrow(/source_node_not_found/);
      });

      it('should fail to add edge with non-existent target', () => {
        expect(() =>
          graph.addEdge({
            sourceId: 'V-01',
            targetId: 'NON-EXISTENT',
            type: 'supports',
          })
        ).toThrow(/target_node_not_found/);
      });

      it('should track added edges in diff', () => {
        graph.addEdge({
          sourceId: 'V-01',
          targetId: 'V-02',
          type: 'supports',
        });

        const diff = graph.getDiff();
        expect(diff.addedEdges.length).toBe(1);
      });
    });

    describe('Remove Edge', () => {
      it('should remove existing edge', () => {
        const edge = graph.removeEdge({ edgeId: 'edge-1' });

        expect(edge.id).toBe('edge-1');

        const graphState = graph.getGraph();
        expect(graphState.edges.length).toBe(1);
      });

      it('should fail to remove non-existent edge', () => {
        expect(() =>
          graph.removeEdge({ edgeId: 'NON-EXISTENT' })
        ).toThrow(/edge_not_found/);
      });

      it('should track removed edges in diff', () => {
        graph.removeEdge({ edgeId: 'edge-1' });

        const diff = graph.getDiff();
        expect(diff.removedEdge.length).toBe(1);
      });
    });
  });

  describe('Edge Queries', () => {
    it('should get incoming edges for a node', () => {
      const incoming = graph.getIncomingEdges('V-01');
      expect(incoming.length).toBe(2); // edge-1 and edge-2
    });

    it('should get outgoing edges for a node', () => {
      const outgoing = graph.getOutgoingEdges('V-02');
      expect(outgoing.length).toBe(1); // edge-2
    });

    it('should return empty array for node with no edges', () => {
      // Add isolated node
      graph.addNode('ISOLATED-001', {
        level: 'L0',
        type: 'goal',
        text: 'Isolated goal',
      });

      const incoming = graph.getIncomingEdges('ISOLATED-001');
      const outgoing = graph.getOutgoingEdges('ISOLATED-001');
      expect(incoming.length).toBe(0);
      expect(outgoing.length).toBe(0);
    });
  });

  describe('Diff Management', () => {
    it('should reset diff', () => {
      // Add some changes
      graph.addNode('D-001', {
        level: 'L0',
        type: 'goal',
        text: 'Test',
      });

      expect(graph.getDiff().addedNodes.length).toBe(1);

      graph.resetDiff();

      const diff = graph.getDiff();
      expect(diff.addedNodes.length).toBe(0);
      expect(diff.removedNodes.length).toBe(0);
      expect(diff.addedEdges.length).toBe(0);
      expect(diff.removedEdge.length).toBe(0);
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = MutableGraph.generateId();
      const id2 = MutableGraph.generateId();

      expect(id1).toMatch(/^[A-Z0-9]{8}$/);
      expect(id2).toMatch(/^[A-Z0-9]{8}$/);
      expect(id1).not.toBe(id2);
    });
  });
});

describe('Graph Store', () => {
  let store: GraphStore;

  beforeEach(() => {
    store = new GraphStore();
  });

  it('should store and retrieve graphs', () => {
    const graph = new MutableGraph();
    store.set('project-1', graph);

    const retrieved = store.get('project-1');
    expect(retrieved).toBe(graph);
  });

  it('should return undefined for non-existent project', () => {
    const retrieved = store.get('non-existent');
    expect(retrieved).toBeUndefined();
  });

  it('should check if project exists', () => {
    expect(store.has('project-1')).toBe(false);

    store.set('project-1', new MutableGraph());

    expect(store.has('project-1')).toBe(true);
  });

  it('should remove graph', () => {
    store.set('project-1', new MutableGraph());
    store.remove('project-1');

    expect(store.has('project-1')).toBe(false);
  });
});
