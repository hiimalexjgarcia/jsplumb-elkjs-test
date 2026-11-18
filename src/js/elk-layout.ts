import ELK from 'elkjs/lib/elk.bundled.js'
import type { ElkNode, ElkPoint } from 'elkjs/lib/elk-api.js'
import type { Graph } from './graph'

const elk = new ELK()

export interface NodeLayout {
  x: number
  y: number
  width: number
  height: number
}

export interface EdgeRoute {
  id: string
  sections: ElkPoint[][]
}

export interface GraphLayout {
  nodes: Map<string, NodeLayout>
  edges: EdgeRoute[]
  width: number
  height: number
}

const nodeWidth = 100
const nodeHeight = 50

export async function layoutGraph(graph: Graph): Promise<GraphLayout> {
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.edgeRouting': 'ORTHOGONAL',
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
  const nodes = new Map(
    (result.children ?? []).map(({ id, x, y, width, height }) => {
      if (x === undefined || y === undefined || width === undefined || height === undefined) {
        throw new Error(`ELK did not return complete layout data for node "${id}"`)
      }
      return [id, { x, y, width, height }]
    }),
  )

  if (result.width === undefined || result.height === undefined) {
    throw new Error('ELK did not return graph dimensions')
  }

  return {
    nodes,
    edges: (result.edges ?? []).map(({ id, sections }) => ({
      id,
      sections: (sections ?? []).map(({ startPoint, bendPoints, endPoint }) => [
        startPoint,
        ...(bendPoints ?? []),
        endPoint,
      ]),
    })),
    width: result.width,
    height: result.height,
  }
}
