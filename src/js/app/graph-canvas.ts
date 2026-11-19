import type { Graph, GraphPosition } from '../graph/graph'
import { layoutGraph, type NodeLayout } from '../layout/elk-layout'
import { renderEdgeRoutes } from '../rendering/svg-edge-renderer'
import { GraphInteractionController } from './graph-interaction-controller'
import { LayoutTransition } from './layout-transition'
import { GraphViewportController } from './graph-viewport-controller'

export class GraphCanvas {
  private readonly nodeElements = new Map<string, HTMLElementTagNameMap['graph-node']>()
  private readonly interactions: GraphInteractionController
  private readonly transition: LayoutTransition
  private readonly viewportController: GraphViewportController
  private edgeSvg?: SVGSVGElement
  private renderGeneration = 0

  constructor(
    private readonly container: HTMLDivElement,
    private readonly graph: Graph,
    viewport: HTMLDivElement,
    surface: HTMLDivElement,
  ) {
    this.viewportController = new GraphViewportController(
      viewport,
      surface,
      container,
      (zoom) => this.interactions.setZoom(zoom),
    )
    this.interactions = new GraphInteractionController(
      container,
      graph,
      this.nodeElements,
      () => this.render(),
      (x, y) => this.viewportController.canvasPointFromClient(x, y),
      (sourceId, position) => this.addConnectedNode(sourceId, position),
    )
    this.transition = new LayoutTransition()
  }

  mount(): void {
    this.viewportController.mount()
    this.interactions.mount()
    this.render().catch(console.error)
  }

  getNodeElement(id: string): HTMLElementTagNameMap['graph-node'] | undefined {
    return this.nodeElements.get(id)
  }

  canvasPointFromClient(clientX: number, clientY: number): GraphPosition | undefined {
    return this.viewportController.canvasPointFromClient(clientX, clientY)
  }

  zoomIn(): void {
    this.viewportController.zoomIn()
  }

  zoomOut(): void {
    this.viewportController.zoomOut()
  }

  fitToScreen(): void {
    this.viewportController.fitToScreen()
  }

  async addConnectedNode(sourceId: string, position: GraphPosition): Promise<void> {
    if (!this.graph.nodes.some(({ id }) => id === sourceId)) {
      throw new Error(`Cannot create a node for unknown source "${sourceId}"`)
    }

    const node = this.graph.addNode(position)
    await this.render()
    this.graph.addEdge(sourceId, node.id)
    await this.render()
  }

  async render(): Promise<void> {
    const generation = ++this.renderGeneration
    const layout = await layoutGraph(this.graph)
    if (generation !== this.renderGeneration) {
      return
    }

    this.viewportController.setContentSize(layout.width, layout.height)
    this.transition.cancel()
    const startPositions = new Map(
      Array.from(this.nodeElements, ([id, node]) => [
        id,
        { x: node.offsetLeft, y: node.offsetTop },
      ]),
    )
    const startRoutes = this.transition.routes
    this.graph.nodes.forEach(({ id }) => {
      const position = layout.nodes.get(id)
      if (!position) {
        throw new Error(`Missing layout data for node "${id}"`)
      }
      this.graph.updateNodePosition(id, { x: position.x, y: position.y })
    })

    let initialRender = false
    this.interactions.withEventsSuppressed(() => {
      this.interactions.deleteEveryConnection()
      const currentNodeIds = new Set(this.graph.nodes.map(({ id }) => id))
      this.nodeElements.forEach((node, id) => {
        if (!currentNodeIds.has(id)) {
          this.interactions.unmanageNode(node)
          node.remove()
          this.nodeElements.delete(id)
        }
      })

      const connectedNodeIds = this.graph.getConnectedNodeIds()
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
        this.interactions.setDraggable(node, !connectedNodeIds.has(id))
      })

      if (!this.edgeSvg) {
        this.edgeSvg = renderEdgeRoutes(layout.edges, layout.width, layout.height)
        this.container.prepend(this.edgeSvg)
        this.transition.setRoutes(layout.edges)
        initialRender = true
      }
    })

    if (initialRender || !this.edgeSvg) {
      this.viewportController.fitToScreen()
      return
    }

    this.transition.animate(
      this.edgeSvg,
      this.nodeElements,
      this.graph.getConnectedNodeIds(),
      this.graph.edges,
      startPositions,
      startRoutes,
      layout,
      (node) => this.interactions.revalidate(node),
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
    this.interactions.attachNode(node, id)
    return node
  }
}
