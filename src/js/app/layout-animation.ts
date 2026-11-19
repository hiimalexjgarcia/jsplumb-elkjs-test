import type { GraphEdge, GraphPosition } from '../graph/graph'

export function getMovedConnectedNodeIds(
  edges: GraphEdge[],
  startPositions: ReadonlyMap<string, GraphPosition>,
  targetPositions: ReadonlyMap<string, GraphPosition>,
): Set<string> {
  const connectedNodeIds = new Set(
    edges.flatMap(({ sourceNodeId, targetNodeId }) => [sourceNodeId, targetNodeId]),
  )

  return new Set(
    Array.from(connectedNodeIds).filter((id) => {
      const start = startPositions.get(id)
      const target = targetPositions.get(id)
      return start !== undefined
        && target !== undefined
        && (start.x !== target.x || start.y !== target.y)
    }),
  )
}
