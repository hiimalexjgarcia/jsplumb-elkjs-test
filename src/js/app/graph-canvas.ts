import type { Graph, GraphPosition } from '../graph/graph'
import { layoutGraph } from '../layout/elk-layout'
import { GraphInteractionController } from './graph-interaction-controller'
import { LayoutTransition } from './layout-transition'
import { GraphViewportController } from './graph-viewport-controller'
import { GraphSceneRenderer } from './graph-scene-renderer'

export class GraphCanvas {
  private readonly scene: GraphSceneRenderer
  private readonly interactions: GraphInteractionController
  private readonly transition: LayoutTransition
  private readonly viewportController: GraphViewportController
  private renderGeneration = 0
  private mounted = false
  private disposed = false

  constructor(
    container: HTMLDivElement,
    private readonly graph: Graph,
    viewport: HTMLDivElement,
    surface: HTMLDivElement,
  ) {
    this.scene = new GraphSceneRenderer(container)
    this.viewportController = new GraphViewportController(
      viewport,
      surface,
      container,
      (zoom) => this.interactions.setZoom(zoom),
    )
    this.interactions = new GraphInteractionController(
      container,
      graph,
      this.scene.nodeElements,
      () => this.render(),
      (x, y) => this.viewportController.canvasPointFromClient(x, y),
      (sourceId, position) => this.addConnectedNode(sourceId, position),
    )
    this.transition = new LayoutTransition()
  }

  mount(): void {
    if (this.disposed) {
      throw new Error('Cannot mount a disposed graph canvas')
    }
    if (this.mounted) {
      return
    }
    this.mounted = true
    this.viewportController.mount()
    this.interactions.mount()
    this.render().catch(console.error)
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.renderGeneration += 1
    this.transition.cancel()
    this.viewportController.dispose()
    this.interactions.dispose()
    this.scene.dispose()
  }

  getNodeElement(id: string): HTMLElementTagNameMap['graph-node'] | undefined {
    return this.scene.getNodeElement(id)
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
    const startPositions = this.scene.captureStartPositions()
    const startRoutes = this.transition.routes
    this.graph.nodes.forEach(({ id }) => {
      const position = layout.nodes.get(id)
      if (!position) {
        throw new Error(`Missing layout data for node "${id}"`)
      }
      this.graph.updateNodePosition(id, { x: position.x, y: position.y })
    })

    const initialRender = this.scene.sync(this.graph, layout, this.interactions)

    if (initialRender) {
      this.transition.setRoutes(layout.edges)
      this.viewportController.fitToScreen()
      return
    }

    const edgeSvg = this.scene.edgeSvg
    if (!edgeSvg) {
      this.viewportController.fitToScreen()
      return
    }

    this.transition.animate(
      edgeSvg,
      this.scene.nodeElements,
      this.graph.getConnectedNodeIds(),
      this.graph.edges,
      startPositions,
      startRoutes,
      layout,
      (node) => this.interactions.revalidate(node),
    )
  }
}
