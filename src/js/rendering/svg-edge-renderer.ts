import type { EdgeRoute } from '../layout/elk-layout'
import type { ElkPoint } from 'elkjs/lib/elk-api.js'

const svgNamespace = 'http://www.w3.org/2000/svg'
const edgeArrowId = 'graph-edge-arrow'
const interpolationPointCount = 16

export function renderEdgeRoutes(routes: EdgeRoute[], width: number, height: number): SVGSVGElement {
  const svg = document.createElementNS(svgNamespace, 'svg')
  svg.classList.add('graph-edges')
  svg.setAttribute('role', 'group')
  svg.setAttribute('aria-label', 'Graph connections')
  svg.setAttribute('width', `${width}`)
  svg.setAttribute('height', `${height}`)
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)

  const definitions = document.createElementNS(svgNamespace, 'defs')
  const arrow = document.createElementNS(svgNamespace, 'marker')
  arrow.id = edgeArrowId
  arrow.setAttribute('viewBox', '0 0 10 10')
  arrow.setAttribute('refX', '9')
  arrow.setAttribute('refY', '5')
  arrow.setAttribute('markerWidth', '8')
  arrow.setAttribute('markerHeight', '8')
  arrow.setAttribute('orient', 'auto')
  const arrowHead = document.createElementNS(svgNamespace, 'path')
  arrowHead.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z')
  arrow.appendChild(arrowHead)
  definitions.appendChild(arrow)
  svg.appendChild(definitions)

  updateEdgeRoutes(svg, routes, width, height)
  return svg
}

export function updateEdgeRoutes(
  svg: SVGSVGElement,
  routes: EdgeRoute[],
  width: number,
  height: number,
): void {
  svg.setAttribute('width', `${width}`)
  svg.setAttribute('height', `${height}`)
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)

  const existingPaths = new Map(
    Array.from(svg.querySelectorAll<SVGPathElement>('path[data-edge-id]'))
      .map((path) => [pathKey(path.dataset.edgeId!, Number(path.dataset.sectionIndex)), path]),
  )
  const updatedKeys = new Set<string>()

  routes.forEach(({ id, sections }) => {
    sections.forEach((points, index) => {
      if (points.length < 2) {
        return
      }

      const key = pathKey(id, index)
      const path = existingPaths.get(key) ?? document.createElementNS(svgNamespace, 'path')
      updatedKeys.add(key)
      const [start, ...remaining] = points
      path.dataset.edgeId = id
      path.dataset.sectionIndex = `${index}`
      path.setAttribute('role', 'button')
      path.setAttribute('tabindex', '0')
      path.setAttribute('aria-label', `Connection ${id}; activate for options`)
      path.setAttribute(
        'd',
        `M ${start.x} ${start.y} ${remaining.map(({ x, y }) => `L ${x} ${y}`).join(' ')}`,
      )
      if (index === sections.length - 1) {
        path.setAttribute('marker-end', `url(#${edgeArrowId})`)
      } else {
        path.removeAttribute('marker-end')
      }
      if (!path.isConnected) {
        svg.appendChild(path)
      }
    })
  })

  existingPaths.forEach((path, key) => {
    if (!updatedKeys.has(key)) {
      path.remove()
    }
  })
}

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

function pathKey(edgeId: string, sectionIndex: number): string {
  return JSON.stringify([edgeId, sectionIndex])
}
