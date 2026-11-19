import { describe, expect, it } from 'vitest'
import { getMovedConnectedNodeIds } from './layout-animation'

describe('getMovedConnectedNodeIds', () => {
  it('ignores isolated nodes when their positions change', () => {
    const edges = [{ id: 'edge', sourceNodeId: 'connected-a', targetNodeId: 'connected-b' }]
    const startPositions = new Map([
      ['connected-a', { x: 0, y: 0 }],
      ['connected-b', { x: 100, y: 0 }],
      ['isolated', { x: 200, y: 0 }],
    ])
    const targetPositions = new Map([
      ['connected-a', { x: 0, y: 0 }],
      ['connected-b', { x: 100, y: 0 }],
      ['isolated', { x: 250, y: 0 }],
    ])

    expect(getMovedConnectedNodeIds(edges, startPositions, targetPositions)).toEqual(new Set())
  })

  it('excludes a node isolated by edge deletion but includes moved connected nodes', () => {
    const remainingEdges = [{ id: 'remaining', sourceNodeId: 'connected-b', targetNodeId: 'connected-c' }]
    const startPositions = new Map([
      ['isolated', { x: 0, y: 0 }],
      ['connected-b', { x: 100, y: 0 }],
      ['connected-c', { x: 200, y: 0 }],
    ])
    const targetPositions = new Map([
      ['isolated', { x: 50, y: 0 }],
      ['connected-b', { x: 120, y: 0 }],
      ['connected-c', { x: 200, y: 0 }],
    ])

    expect(getMovedConnectedNodeIds(remainingEdges, startPositions, targetPositions))
      .toEqual(new Set(['connected-b']))
  })
})
