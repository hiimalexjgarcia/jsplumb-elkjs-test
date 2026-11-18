export interface GraphPosition {
  x: number
  y: number
}

export interface GraphNode {
  id: string
  label: string
  position?: GraphPosition
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

  addNode(position?: GraphPosition): GraphNode {
    const node: GraphNode = { id: crypto.randomUUID(), label: 'New node' }
    if (position) {
      node.position = position
    }
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

  removeNode(id: string): void {
    const nodeIndex = this.nodes.findIndex((node) => node.id === id)
    if (nodeIndex === -1) {
      throw new Error(`Cannot remove unknown node "${id}"`)
    }

    this.nodes.splice(nodeIndex, 1)
    for (let edgeIndex = this.edges.length - 1; edgeIndex >= 0; edgeIndex -= 1) {
      const edge = this.edges[edgeIndex]
      if (edge.sourceNodeId === id || edge.targetNodeId === id) {
        this.edges.splice(edgeIndex, 1)
      }
    }
  }

  removeEdge(id: string): void {
    const edgeIndex = this.edges.findIndex((edge) => edge.id === id)
    if (edgeIndex === -1) {
      throw new Error(`Cannot remove unknown edge "${id}"`)
    }

    this.edges.splice(edgeIndex, 1)
  }

  updateNodeLabel(id: string, label: string): void {
    const node = this.nodes.find(({ id: nodeId }) => nodeId === id)
    if (!node) {
      throw new Error(`Cannot update label for unknown node "${id}"`)
    }

    node.label = label
  }

  updateNodePosition(id: string, position: GraphPosition): void {
    const node = this.nodes.find(({ id: nodeId }) => nodeId === id)
    if (!node) {
      throw new Error(`Cannot update position for unknown node "${id}"`)
    }

    node.position = position
  }
}
