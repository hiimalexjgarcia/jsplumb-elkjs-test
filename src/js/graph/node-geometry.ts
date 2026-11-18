import type { GraphPosition } from './graph'

export const graphNodeWidth = 100
export const graphNodeHeight = 50

export function findFreeNodePosition(occupied: GraphPosition[], canvasWidth: number): GraphPosition {
  const gap = 20
  const padding = 16
  const columns = Math.max(1, Math.floor(((canvasWidth || 720) - padding * 2 + gap) / (graphNodeWidth + gap)))

  for (let index = 0; ; index += 1) {
    const position = {
      x: padding + (index % columns) * (graphNodeWidth + gap),
      y: padding + Math.floor(index / columns) * (graphNodeHeight + gap),
    }
    const overlaps = occupied.some((other) =>
      position.x < other.x + graphNodeWidth + gap
      && position.x + graphNodeWidth + gap > other.x
      && position.y < other.y + graphNodeHeight + gap
      && position.y + graphNodeHeight + gap > other.y,
    )
    if (!overlaps) {
      return position
    }
  }
}
