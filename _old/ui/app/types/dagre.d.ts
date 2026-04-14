declare module 'dagre' {
  interface Graph {
    setDefaultEdgeLabel(callback: () => any): void
    setGraph(options: Record<string, any>): void
    setNode(id: string, options: { width: number; height: number }): void
    setEdge(source: string, target: string, label?: any): void
    node(id: string): { x: number; y: number; width: number; height: number } | undefined
    layout(): void
  }

  interface GraphConstructor {
    new (): Graph
    Graph: GraphConstructor
  }

  interface Dagre {
    graphlib: { Graph: GraphConstructor }
    layout(g: Graph): void
  }

  const dagre: Dagre
  export default dagre
}
