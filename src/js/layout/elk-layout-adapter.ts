import ELK from 'elkjs/lib/elk.bundled.js'
import type { ElkNode, ElkPoint } from 'elkjs/lib/elk-api.js'
import type { Graph } from '../graph/graph'
import { graphNodeHeight, graphNodeWidth } from '../graph/node-geometry'

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

export async function layoutGraph(graph: Graph): Promise<GraphLayout> {
  const connectedNodeIds = new Set(
    graph.edges.flatMap(({ sourceNodeId, targetNodeId }) => [sourceNodeId, targetNodeId]),
  )
  const nodesToLayout = graph.nodes.filter(
    ({ id, position }) => connectedNodeIds.has(id) || position === undefined,
  )
  const isolatedPositions: Array<[string, NodeLayout]> = []
  graph.nodes.forEach(({ id, position }) => {
    if (!connectedNodeIds.has(id) && position) {
      isolatedPositions.push([
        id,
        { x: position.x, y: position.y, width: graphNodeWidth, height: graphNodeHeight },
      ])
    }
  })

  if (nodesToLayout.length === 0) {
    const nodes = new Map(isolatedPositions)
    return {
      nodes,
      edges: [],
      width: Math.max(0, ...Array.from(nodes.values(), ({ x, width }) => x + width)),
      height: Math.max(0, ...Array.from(nodes.values(), ({ y, height }) => y + height)),
    }
  }

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.baseValue': '100',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    },
    children: nodesToLayout.map(({ id }) => ({
      id,
      width: graphNodeWidth,
      height: graphNodeHeight,
    })),
    edges: graph.edges.map(({ id, sourceNodeId, targetNodeId }) => ({
      id,
      sources: [sourceNodeId],
      targets: [targetNodeId],
    })),
  }

  const result = await elk.layout(elkGraph)
  const laidOutNodes = new Map<string, NodeLayout>(
    (result.children ?? []).map(({ id, x, y, width, height }) => {
      if (x === undefined || y === undefined || width === undefined || height === undefined) {
        throw new Error(`ELK did not return complete layout data for node "${id}"`)
      }
      return [id, { x, y, width, height }] as [string, NodeLayout]
    }),
  )

  if (result.width === undefined || result.height === undefined) {
    throw new Error('ELK did not return graph dimensions')
  }

  const nodes = new Map(laidOutNodes)
  isolatedPositions.forEach(([id, position]) => nodes.set(id, position))
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
    width: Math.max(result.width, ...Array.from(nodes.values(), ({ x, width }) => x + width)),
    height: Math.max(result.height, ...Array.from(nodes.values(), ({ y, height }) => y + height)),
  }
}
