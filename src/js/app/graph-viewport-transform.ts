import type { GraphPosition } from '../graph/graph'

export function viewportPointToCanvasPoint(
  point: GraphPosition,
  zoom: number,
  pan: GraphPosition,
): GraphPosition {
  return {
    x: (point.x - pan.x) / zoom,
    y: (point.y - pan.y) / zoom,
  }
}

export function getPanForZoomAnchor(
  viewportPoint: GraphPosition,
  canvasPoint: GraphPosition,
  zoom: number,
): GraphPosition {
  return {
    x: viewportPoint.x - canvasPoint.x * zoom,
    y: viewportPoint.y - canvasPoint.y * zoom,
  }
}
