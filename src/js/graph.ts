export interface GraphNode {
  id: string
  label: string
}

export interface GraphEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export const graph: Graph = {
  nodes: [
    { id: 'n1', label: 'n1' },
    { id: 'n2', label: 'n2' },
    { id: 'n3', label: 'n3' },
    { id: 'n4', label: 'n4' },
    { id: 'n5', label: 'n5' },
    { id: 'n6', label: 'n6' },
  ],
  edges: [
    { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2' },
    { id: 'e2', sourceNodeId: 'n1', targetNodeId: 'n3' },
    { id: 'e3', sourceNodeId: 'n1', targetNodeId: 'n5' },
    { id: 'e4', sourceNodeId: 'n2', targetNodeId: 'n4' },
    { id: 'e5', sourceNodeId: 'n3', targetNodeId: 'n4' },
    { id: 'e6', sourceNodeId: 'n4', targetNodeId: 'n6' },
    { id: 'e7', sourceNodeId: 'n5', targetNodeId: 'n6' },
  ],
}
