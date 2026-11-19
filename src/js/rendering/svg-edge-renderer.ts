import type { EdgeRoute } from '../layout/elk-layout'

const svgNamespace = 'http://www.w3.org/2000/svg'
const edgeArrowId = 'graph-edge-arrow'

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

function pathKey(edgeId: string, sectionIndex: number): string {
  return JSON.stringify([edgeId, sectionIndex])
}
