import { describe, expect, it } from 'vitest'
import { findFreeNodePosition, graphNodeHeight, graphNodeWidth } from './node-geometry'

describe('findFreeNodePosition', () => {
  it('uses the first canvas slot when it is unoccupied', () => {
    expect(findFreeNodePosition([], 600)).toEqual({ x: 16, y: 16 })
  })

  it('chooses a slot that does not overlap existing nodes', () => {
    const occupied = [
      { x: 16, y: 16 },
      { x: 16 + graphNodeWidth + 20, y: 16 },
    ]

    const position = findFreeNodePosition(occupied, 600)

    expect(occupied.some((other) =>
      position.x < other.x + graphNodeWidth + 20
      && position.x + graphNodeWidth + 20 > other.x
      && position.y < other.y + graphNodeHeight + 20
      && position.y + graphNodeHeight + 20 > other.y,
    )).toBe(false)
  })
})
