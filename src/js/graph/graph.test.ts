import { describe, expect, it } from 'vitest'
import { Graph } from './graph'

describe('Graph.getConnectedNodeIds', () => {
  it('returns unique node IDs from edges, excluding isolated nodes', () => {
    const graph = new Graph(
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'isolated', label: 'Isolated' },
      ],
      [
        { id: 'ab', sourceNodeId: 'a', targetNodeId: 'b' },
        { id: 'ba', sourceNodeId: 'b', targetNodeId: 'a' },
      ],
    )

    expect(graph.getConnectedNodeIds()).toEqual(new Set(['a', 'b']))
  })
})
