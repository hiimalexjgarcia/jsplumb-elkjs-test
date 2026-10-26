import type { ElkNode } from 'elkjs/lib/elk-api.js'
import type { ELK } from 'elkjs/lib/elk-api.js'
import type { Graph } from './graph'

export interface NodeLayout {
  x: number
  y: number
  width: number
  height: number
}

const nodeWidth = 100
const nodeHeight = 50

export async function layoutGraph(graph: Graph, elk: ELK): Promise<Map<string, NodeLayout>> {
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.layered.spacing.baseValue': '100',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    },
    children: graph.nodes.map(({ id }) => ({
      id,
      width: nodeWidth,
      height: nodeHeight,
    })),
    edges: graph.edges.map(({ id, sourceNodeId, targetNodeId }) => ({
      id,
      sources: [sourceNodeId],
      targets: [targetNodeId],
    })),
  }

  const result = await elk.layout(elkGraph)
  return new Map(
    (result.children ?? []).map(({ id, x, y, width, height }) => {
      if (x === undefined || y === undefined || width === undefined || height === undefined) {
        throw new Error(`ELK did not return complete layout data for node "${id}"`)
      }
      return [id, { x, y, width, height }]
    }),
  )
}
