import { describe, expect, it } from 'vitest'
import { Graph } from '../graph/graph'
import { graphNodeHeight, graphNodeWidth } from '../graph/node-geometry'
import { layoutGraph } from './elk-layout-adapter'

describe('layoutGraph', () => {
  it('preserves positioned isolated nodes without affecting connected node layout', async () => {
    const nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]
    const edges = [{ id: 'ab', sourceNodeId: 'a', targetNodeId: 'b' }]
    const connectedLayout = await layoutGraph(new Graph(nodes, edges))
    const isolatedPosition = { x: 800, y: 420 }
    const layoutWithIsolatedNode = await layoutGraph(new Graph(
      [...nodes, { id: 'free', label: 'Free', position: isolatedPosition }],
      edges,
    ))

    expect(layoutWithIsolatedNode.nodes.get('a')).toEqual(connectedLayout.nodes.get('a'))
    expect(layoutWithIsolatedNode.nodes.get('b')).toEqual(connectedLayout.nodes.get('b'))
    expect(layoutWithIsolatedNode.nodes.get('free')).toEqual({
      ...isolatedPosition,
      width: graphNodeWidth,
      height: graphNodeHeight,
    })
  })

  it('returns saved positions when every node is isolated', async () => {
    const position = { x: 180, y: 240 }
    const layout = await layoutGraph(new Graph(
      [{ id: 'free', label: 'Free', position }],
      [],
    ))

    expect(layout.nodes.get('free')).toEqual({
      ...position,
      width: graphNodeWidth,
      height: graphNodeHeight,
    })
    expect(layout.edges).toEqual([])
  })
})
