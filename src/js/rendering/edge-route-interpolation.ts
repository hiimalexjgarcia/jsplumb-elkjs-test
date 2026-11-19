import type { EdgeRoute } from '../layout/elk-layout'
import type { ElkPoint } from 'elkjs/lib/elk-api.js'

const interpolationPointCount = 16

export function interpolateEdgeRoutes(
  fromRoutes: EdgeRoute[],
  toRoutes: EdgeRoute[],
  progress: number,
): EdgeRoute[] {
  const fromById = new Map(fromRoutes.map((route) => [route.id, route]))
  return toRoutes.map((toRoute) => {
    const fromRoute = fromById.get(toRoute.id)
    if (!fromRoute) {
      return toRoute
    }

    return {
      id: toRoute.id,
      sections: toRoute.sections.map((toSection, index) => {
        const fromSection = fromRoute.sections[index]
        return fromSection
          ? interpolatePolylines(fromSection, toSection, progress)
          : toSection
      }),
    }
  })
}

function interpolatePolylines(from: ElkPoint[], to: ElkPoint[], progress: number): ElkPoint[] {
  const fromPoints = samplePolyline(from, interpolationPointCount)
  const toPoints = samplePolyline(to, interpolationPointCount)
  return fromPoints.map((point, index) => ({
    x: point.x + (toPoints[index].x - point.x) * progress,
    y: point.y + (toPoints[index].y - point.y) * progress,
  }))
}

function samplePolyline(points: ElkPoint[], count: number): ElkPoint[] {
  if (points.length === 1) {
    return Array.from({ length: count }, () => points[0])
  }

  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index]
    return Math.hypot(point.x - previous.x, point.y - previous.y)
  })
  const totalLength = lengths.reduce((total, length) => total + length, 0)
  if (totalLength === 0) {
    return Array.from({ length: count }, () => points[0])
  }

  return Array.from({ length: count }, (_, sampleIndex) => {
    let remaining = totalLength * sampleIndex / (count - 1)
    for (let segmentIndex = 0; segmentIndex < lengths.length; segmentIndex += 1) {
      const segmentLength = lengths[segmentIndex]
      if (remaining <= segmentLength || segmentIndex === lengths.length - 1) {
        const start = points[segmentIndex]
        const end = points[segmentIndex + 1]
        const fraction = segmentLength === 0 ? 0 : remaining / segmentLength
        return {
          x: start.x + (end.x - start.x) * fraction,
          y: start.y + (end.y - start.y) * fraction,
        }
      }
      remaining -= segmentLength
    }
    return points[points.length - 1]
  })
}
