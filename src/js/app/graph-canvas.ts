import { newInstance } from '@jsplumb/browser-ui'
import type { Graph } from '../graph/graph'
import { layoutGraph, type EdgeRoute, type GraphLayout, type NodeLayout } from '../layout/elk-layout-adapter'
import { interpolateEdgeRoutes, renderEdgeRoutes, updateEdgeRoutes } from '../rendering/svg-edge-renderer'
import { getMovedConnectedNodeIds } from './layout-animation'

const layoutAnimationDuration = 300

export class GraphCanvas {
  private readonly toolkit
  private readonly transientEdgeIds = new WeakMap<object, string>()
  private readonly nodeElements = new Map<string, HTMLElementTagNameMap['graph-node']>()
  private edgeSvg?: SVGSVGElement
  private currentRoutes: EdgeRoute[] = []
  private animationFrame?: number
  private renderGeneration = 0
  private renderingGraph = false

  constructor(
    private readonly container: HTMLDivElement,
    private readonly graph: Graph,
  ) {
    this.toolkit = newInstance({
      container,
      elementsDraggable: true,
    })
  }

  mount(): void {
    this.container.addEventListener('pointerdown', (event) => {
      if (event.button === 0) {
        this.focusNodeAtEvent(event)
      }
    }, true)
    this.container.addEventListener('click', (event) => this.focusNodeAtEvent(event), true)

    this.toolkit.bind('connection', ({ connection, sourceId, targetId }) => {
      if (this.renderingGraph) {
        return
      }

      const edge = this.graph.addEdge(sourceId, targetId)
      this.transientEdgeIds.set(connection, edge.id)
      this.render().catch(console.error)
    })

    this.toolkit.bind('connection:detach', ({ connection }) => {
      if (this.renderingGraph) {
        return
      }

      const edgeId = this.transientEdgeIds.get(connection)
      if (edgeId) {
        this.graph.removeEdge(edgeId)
        this.render().catch(console.error)
      }
    })

    this.toolkit.bind('drag:stop', ({ el }) => {
      if (el instanceof HTMLElement && el.localName === 'graph-node') {
        this.graph.updateNodePosition(el.id, {
          x: el.offsetLeft,
          y: el.offsetTop,
        })
      }
    })

    this.render().catch(console.error)
  }

  getNodeElement(id: string): HTMLElementTagNameMap['graph-node'] | undefined {
    return this.nodeElements.get(id)
  }

  async render(): Promise<void> {
    const generation = ++this.renderGeneration
    const layout = await layoutGraph(this.graph)
    if (generation !== this.renderGeneration) {
      return
    }

    this.cancelLayoutAnimation()
    const startPositions = new Map(
      Array.from(this.nodeElements, ([id, node]) => [
        id,
        { x: node.offsetLeft, y: node.offsetTop },
      ]),
    )
    const startRoutes = this.currentRoutes

    this.graph.nodes.forEach(({ id }) => {
      const position = layout.nodes.get(id)
      if (!position) {
        throw new Error(`Missing layout data for node "${id}"`)
      }

      this.graph.updateNodePosition(id, { x: position.x, y: position.y })
    })

    this.renderingGraph = true
    try {
      this.toolkit.deleteEveryConnection()
      const currentNodeIds = new Set(this.graph.nodes.map(({ id }) => id))
      this.nodeElements.forEach((node, id) => {
        if (!currentNodeIds.has(id)) {
          this.toolkit.unmanage(node, true)
          node.remove()
          this.nodeElements.delete(id)
        }
      })

      const connectedNodeIds = new Set(
        this.graph.edges.flatMap(({ sourceNodeId, targetNodeId }) => [sourceNodeId, targetNodeId]),
      )

      this.graph.nodes.forEach(({ id, label }) => {
        const position = layout.nodes.get(id)
        if (!position) {
          throw new Error(`Missing layout data for node "${id}"`)
        }

        let node = this.nodeElements.get(id)
        if (!node) {
          node = this.createNode(id, label, position)
          this.nodeElements.set(id, node)
        } else if (node.textContent !== label) {
          node.textContent = label
        }

        node.style.width = `${position.width}px`
        node.style.height = `${position.height}px`
        node.setAttribute('aria-label', `Node: ${label}`)
        this.toolkit.setDraggable(node, !connectedNodeIds.has(id))
      })

      if (!this.edgeSvg) {
        this.edgeSvg = renderEdgeRoutes(layout.edges, layout.width, layout.height)
        this.container.prepend(this.edgeSvg)
        this.currentRoutes = layout.edges
        return
      }
    } finally {
      this.renderingGraph = false
    }

    this.animateLayout(
      startPositions,
      this.createTransitionStartRoutes(startRoutes, startPositions, layout),
      layout,
    )
  }

  private createNode(
    id: string,
    label: string,
    position: NodeLayout,
  ): HTMLElementTagNameMap['graph-node'] {
    const node = document.createElement('graph-node')
    node.id = id
    node.textContent = label
    node.style.left = `${position.x}px`
    node.style.top = `${position.y}px`
    node.style.width = `${position.width}px`
    node.style.height = `${position.height}px`
    node.tabIndex = 0
    node.setAttribute('aria-label', `Node: ${label}`)
    this.container.appendChild(node)

    const endpoint = this.toolkit.addEndpoint(node, {
      source: true,
      target: true,
      maxConnections: -1,
      anchor: 'Center',
      endpoint: { type: 'Dot', options: { radius: 8, cssClass: 'graph-endpoint' } },
      connectorOverlays: [{ type: 'Arrow', options: { location: 1 } }],
    })
    const updateEndpointEmphasis = (): void => {
      requestAnimationFrame(() => {
        if (node.matches(':hover, :focus-within')) {
          endpoint.addClass('graph-endpoint-emphasized')
        } else {
          endpoint.removeClass('graph-endpoint-emphasized')
        }
      })
    }
    node.addEventListener('label-edit-start', () => endpoint.addClass('graph-endpoint-hidden'))
    node.addEventListener('label-edit-end', () => {
      endpoint.removeClass('graph-endpoint-hidden')
      updateEndpointEmphasis()
    })
    node.addEventListener('pointerenter', updateEndpointEmphasis)
    node.addEventListener('pointerleave', updateEndpointEmphasis)
    node.addEventListener('focusin', updateEndpointEmphasis)
    node.addEventListener('focusout', updateEndpointEmphasis)
    node.addEventListener('label-change', ({ detail }) => {
      this.graph.updateNodeLabel(id, detail.label)
    })

    return node
  }

  private animateLayout(
    startPositions: Map<string, { x: number; y: number }>,
    startRoutes: EdgeRoute[],
    layout: GraphLayout,
  ): void {
    if (!this.edgeSvg) {
      return
    }

    const movingConnectedNodeIds = getMovedConnectedNodeIds(
      this.graph.edges,
      startPositions,
      layout.nodes,
    )
    const movingNodes = Array.from(movingConnectedNodeIds, (id) => {
      const node = this.nodeElements.get(id)
      const start = startPositions.get(id)
      const target = layout.nodes.get(id)
      return node && start && target
        ? { node, start, target }
        : undefined
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)

    if (movingNodes.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.setNodePositions(layout)
      updateEdgeRoutes(this.edgeSvg, layout.edges, layout.width, layout.height)
      this.currentRoutes = layout.edges
      return
    }

    this.setNodePositions(layout, movingConnectedNodeIds)
    const startedAt = performance.now()
    const animationWidth = Math.max(Number(this.edgeSvg.getAttribute('width')) || 0, layout.width)
    const animationHeight = Math.max(Number(this.edgeSvg.getAttribute('height')) || 0, layout.height)
    const animate = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / layoutAnimationDuration)
      const easedProgress = progress * progress * (3 - 2 * progress)

      movingNodes.forEach(({ node, start, target }) => {
        const x = start.x + (target.x - start.x) * easedProgress
        const y = start.y + (target.y - start.y) * easedProgress
        node.style.left = `${x}px`
        node.style.top = `${y}px`
        this.toolkit.revalidate(node)
      })

      const routes = interpolateEdgeRoutes(startRoutes, layout.edges, easedProgress)
      updateEdgeRoutes(this.edgeSvg!, routes, animationWidth, animationHeight)
      this.currentRoutes = routes

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate)
      } else {
        this.animationFrame = undefined
        movingNodes.forEach(({ node, target }) => {
          node.style.left = `${target.x}px`
          node.style.top = `${target.y}px`
          this.toolkit.revalidate(node)
        })
        updateEdgeRoutes(this.edgeSvg!, layout.edges, layout.width, layout.height)
        this.currentRoutes = layout.edges
      }
    }

    this.animationFrame = requestAnimationFrame(animate)
  }

  private setNodePositions(layout: GraphLayout, excludedNodeIds?: ReadonlySet<string>): void {
    layout.nodes.forEach((position, id) => {
      if (excludedNodeIds?.has(id)) {
        return
      }

      const node = this.nodeElements.get(id)
      if (!node) {
        return
      }

      const left = `${position.x}px`
      const top = `${position.y}px`
      if (node.style.left !== left || node.style.top !== top) {
        node.style.left = left
        node.style.top = top
        this.toolkit.revalidate(node)
      }
    })
  }

  private createTransitionStartRoutes(
    currentRoutes: EdgeRoute[],
    startPositions: Map<string, { x: number; y: number }>,
    layout: GraphLayout,
  ): EdgeRoute[] {
    const routesById = new Map(currentRoutes.map((route) => [route.id, route]))
    const startRoutes = [...currentRoutes]

    layout.edges.forEach((route) => {
      if (routesById.has(route.id)) {
        return
      }

      const edge = this.graph.edges.find(({ id }) => id === route.id)
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

  private cancelLayoutAnimation(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = undefined
    }
  }

  private focusNodeAtEvent(event: MouseEvent): void {
    const path = event.composedPath()
    if (path.some((target) => target instanceof HTMLInputElement)) {
      return
    }

    const nodeFromPath = path.find(
      (target): target is HTMLElementTagNameMap['graph-node'] =>
        target instanceof HTMLElement && target.localName === 'graph-node',
    )
    const node = nodeFromPath ?? Array.from(this.nodeElements.values()).find((candidate) => {
      const bounds = candidate.getBoundingClientRect()
      return event.clientX >= bounds.left
        && event.clientX <= bounds.right
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom
    })
    if (node) {
      requestAnimationFrame(() => {
        if (node.isConnected && !(node.shadowRoot?.activeElement instanceof HTMLInputElement)) {
          node.focus()
        }
      })
    }
  }
}
