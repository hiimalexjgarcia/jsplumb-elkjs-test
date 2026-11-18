export interface GraphNode {
  id: string
  label: string
}

export interface GraphEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
}

export class Graph {
  constructor(
    readonly nodes: GraphNode[],
    readonly edges: GraphEdge[],
  ) {}

  addNode(): GraphNode {
    const node = { id: crypto.randomUUID(), label: 'New node' }
    this.nodes.push(node)
    return node
  }

  addEdge(sourceNodeId: string, targetNodeId: string): GraphEdge {
    for (const id of [sourceNodeId, targetNodeId]) {
      if (!this.nodes.some((node) => node.id === id)) {
        throw new Error(`Cannot connect unknown node "${id}"`)
      }
    }

    const edge = { id: crypto.randomUUID(), sourceNodeId, targetNodeId }
    this.edges.push(edge)
    return edge
  }

  removeEdge(sourceNodeId: string, targetNodeId: string): void {
    const edgeIndex = this.edges.findIndex(
      (edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId,
    )
    if (edgeIndex !== -1) {
      this.edges.splice(edgeIndex, 1)
    }
  }

  updateNodeLabel(id: string, label: string): void {
    const node = this.nodes.find(({ id: nodeId }) => nodeId === id)
    if (!node) {
      throw new Error(`Cannot update label for unknown node "${id}"`)
    }

    node.label = label
  }
}

export const graph = new Graph(
  [
    { id: 'n1', label: 'n1' },
    { id: 'n2', label: 'n2' },
    { id: 'n3', label: 'n3' },
    { id: 'n4', label: 'n4' },
    { id: 'n5', label: 'n5' },
    { id: 'n6', label: 'n6' },
  ],
  [
    { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2' },
    { id: 'e2', sourceNodeId: 'n1', targetNodeId: 'n3' },
    { id: 'e3', sourceNodeId: 'n1', targetNodeId: 'n5' },
    { id: 'e4', sourceNodeId: 'n2', targetNodeId: 'n4' },
    { id: 'e5', sourceNodeId: 'n3', targetNodeId: 'n4' },
    { id: 'e6', sourceNodeId: 'n4', targetNodeId: 'n6' },
    { id: 'e7', sourceNodeId: 'n5', targetNodeId: 'n6' },
  ],
)
