import type { GraphEdge, GraphPosition } from '../graph/graph'
import type { EdgeRoute, GraphLayout } from '../layout/elk-layout'
import { interpolateEdgeRoutes } from '../rendering/edge-route-interpolation'
import { updateEdgeRoutes } from '../rendering/svg-edge-renderer'

const layoutAnimationDuration = 300

type GraphNodeElement = HTMLElementTagNameMap['graph-node']

export function getMovedConnectedNodeIds(
  connectedNodeIds: ReadonlySet<string>,
  startPositions: ReadonlyMap<string, GraphPosition>,
  targetPositions: ReadonlyMap<string, GraphPosition>,
): Set<string> {
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

export class LayoutTransition {
  private currentRoutes: EdgeRoute[] = []
  private animationFrame?: number

  get routes(): EdgeRoute[] {
    return this.currentRoutes
  }

  setRoutes(routes: EdgeRoute[]): void {
    this.currentRoutes = routes
  }

  cancel(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = undefined
    }
  }

  animate(
    svg: SVGSVGElement,
    nodeElements: Map<string, GraphNodeElement>,
    connectedNodeIds: ReadonlySet<string>,
    edges: GraphEdge[],
    startPositions: Map<string, GraphPosition>,
    startRoutes: EdgeRoute[],
    layout: GraphLayout,
    revalidate: (node: HTMLElement) => void,
  ): void {
    const movingConnectedNodeIds = getMovedConnectedNodeIds(
      connectedNodeIds,
      startPositions,
      layout.nodes,
    )
    const movingNodes = Array.from(movingConnectedNodeIds, (id) => {
      const node = nodeElements.get(id)
      const start = startPositions.get(id)
      const target = layout.nodes.get(id)
      return node && start && target
        ? { node, start, target }
        : undefined
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)

    if (movingNodes.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.setNodePositions(layout, nodeElements, revalidate)
      updateEdgeRoutes(svg, layout.edges, layout.width, layout.height)
      this.currentRoutes = layout.edges
      return
    }

    this.setNodePositions(layout, nodeElements, revalidate, movingConnectedNodeIds)
    const startedAt = performance.now()
    const animationWidth = Math.max(Number(svg.getAttribute('width')) || 0, layout.width)
    const animationHeight = Math.max(Number(svg.getAttribute('height')) || 0, layout.height)
    const startRoutesWithNewEdges = this.createTransitionStartRoutes(
      edges,
      startRoutes,
      startPositions,
      layout,
    )
    const animate = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / layoutAnimationDuration)
      const easedProgress = progress * progress * (3 - 2 * progress)

      movingNodes.forEach(({ node, start, target }) => {
        node.style.left = `${start.x + (target.x - start.x) * easedProgress}px`
        node.style.top = `${start.y + (target.y - start.y) * easedProgress}px`
        revalidate(node)
      })

      this.currentRoutes = interpolateEdgeRoutes(
        startRoutesWithNewEdges,
        layout.edges,
        easedProgress,
      )
      updateEdgeRoutes(svg, this.currentRoutes, animationWidth, animationHeight)

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate)
      } else {
        this.animationFrame = undefined
        movingNodes.forEach(({ node, target }) => {
          node.style.left = `${target.x}px`
          node.style.top = `${target.y}px`
          revalidate(node)
        })
        updateEdgeRoutes(svg, layout.edges, layout.width, layout.height)
        this.currentRoutes = layout.edges
      }
    }

    this.animationFrame = requestAnimationFrame(animate)
  }

  private setNodePositions(
    layout: GraphLayout,
    nodeElements: Map<string, GraphNodeElement>,
    revalidate: (node: HTMLElement) => void,
    excludedNodeIds?: ReadonlySet<string>,
  ): void {
    layout.nodes.forEach((position, id) => {
      if (excludedNodeIds?.has(id)) {
        return
      }

      const node = nodeElements.get(id)
      if (!node) {
        return
      }

      const left = `${position.x}px`
      const top = `${position.y}px`
      if (node.style.left !== left || node.style.top !== top) {
        node.style.left = left
        node.style.top = top
        revalidate(node)
      }
    })
  }

  private createTransitionStartRoutes(
    edges: GraphEdge[],
    currentRoutes: EdgeRoute[],
    startPositions: Map<string, GraphPosition>,
    layout: GraphLayout,
  ): EdgeRoute[] {
    const routesById = new Map(currentRoutes.map((route) => [route.id, route]))
    const startRoutes = [...currentRoutes]

    layout.edges.forEach((route) => {
      if (routesById.has(route.id)) {
        return
      }

      const edge = edges.find(({ id }) => id === route.id)
      if (!edge || route.sections.length === 0) {
        return
      }

      const sections = route.sections.map((section) => section.map(({ x, y }) => ({ x, y })))
      const sourceLayout = layout.nodes.get(edge.sourceNodeId)
      const targetLayout = layout.nodes.get(edge.targetNodeId)
      const sourceStart = startPositions.get(edge.sourceNodeId)
      const targetStart = startPositions.get(edge.targetNodeId)
      if (sourceLayout && targetLayout && sections[0].length > 0) {
        sections[0][0] = {
          x: (sourceStart?.x ?? sourceLayout.x) + sourceLayout.width / 2,
          y: (sourceStart?.y ?? sourceLayout.y) + sourceLayout.height / 2,
        }
        const finalSection = sections[sections.length - 1]
        if (finalSection.length > 0) {
          finalSection[finalSection.length - 1] = {
            x: (targetStart?.x ?? targetLayout.x) + targetLayout.width / 2,
            y: (targetStart?.y ?? targetLayout.y) + targetLayout.height / 2,
          }
        }
      }
      startRoutes.push({ id: route.id, sections })
    })

    return startRoutes
  }
}
