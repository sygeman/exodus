<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { Node, Edge } from '@vue-flow/core'
import dagre from 'dagre'
import type { ACSDNode, ACSDEdge, ACSDNodeData } from '~/types/acsd'

const props = defineProps<{
  nodes: ACSDNode[]
  edges: ACSDEdge[]
}>()

const emit = defineEmits<{
  nodeSelect: [nodeId: string | null]
}>()

const { onNodeClick, onPaneClick, fitView } = useVueFlow()

const NODE_WIDTH = 160
const NODE_HEIGHT = 80
const HORIZONTAL_GAP = 40
const VERTICAL_GAP = 60

const nodeTypes = {
  acsd: markRaw(resolveComponent('AcsdNodesACSDNode')),
}

const edgeTypes = {
  acsd: markRaw(resolveComponent('AcsdEdgesACSDEdge')),
}

function calculateLayout(nodes: ACSDNode[], edges: ACSDEdge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    nodesep: HORIZONTAL_GAP,
    ranksep: VERTICAL_GAP,
    marginx: 50,
    marginy: 50,
  })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    const dagreNode = g.node(node.id)
    if (dagreNode) {
      positions.set(node.id, {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - NODE_HEIGHT / 2,
      })
    }
  }

  return positions
}

const vueFlowNodes = computed<Node<ACSDNodeData>[]>(() => {
  const positions = calculateLayout(props.nodes, props.edges)

  return props.nodes.map((node) => ({
    id: node.id,
    type: 'acsd',
    position: positions.get(node.id) || { x: 0, y: 0 },
    data: {
      level: node.level,
      type: node.type,
      text: node.text,
      status: node.status,
      ideaId: node.ideaId,
    },
  }))
})

const vueFlowEdges = computed<Edge[]>(() => {
  return props.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'acsd',
    data: { type: edge.type },
  }))
})

onNodeClick(({ node }) => {
  emit('nodeSelect', node.id)
})

onPaneClick(() => {
  emit('nodeSelect', null)
})

onMounted(() => {
  nextTick(() => fitView({ padding: 0.2 }))
})
</script>

<template>
  <div class="acsd-graph size-full bg-elevated">
    <VueFlow
      v-model:nodes="vueFlowNodes"
      :edges="vueFlowEdges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="true"
      fit-view-on-init
    >
      <Background />
    </VueFlow>
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';

.acsd-graph {
  --vf-node-bg: var(--color-neutral-900);
  --vf-node-text: var(--color-neutral-100);
  --vf-node-color: var(--color-neutral-700);
  --vf-handle: var(--color-neutral-600);
  --vf-box-shadow: none;
}

.vue-flow__edge-path {
  stroke: var(--color-neutral-500);
}

.vue-flow__background pattern line {
  stroke: var(--color-neutral-800);
}

.vue-flow__node {
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
}

.vue-flow__node.selected > * {
  box-shadow: 0 0 0 2px var(--color-primary-500) !important;
}
</style>
