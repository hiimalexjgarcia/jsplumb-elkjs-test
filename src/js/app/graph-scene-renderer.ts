import type { Graph } from '../graph/graph'
import type { GraphLayout, NodeLayout } from '../layout/elk-layout'
import { renderEdgeRoutes } from '../rendering/svg-edge-renderer'
import { GraphInteractionController } from './graph-interaction-controller'

export class GraphSceneRenderer {
  readonly nodeElements = new Map<string, HTMLElementTagNameMap['graph-node']>()
  private renderedEdges?: SVGSVGElement

  constructor(private readonly container: HTMLDivElement) {}

  get edgeSvg(): SVGSVGElement | undefined {
    return this.renderedEdges
  }

  getNodeElement(id: string): HTMLElementTagNameMap['graph-node'] | undefined {
    return this.nodeElements.get(id)
  }

  dispose(): void {
    this.nodeElements.forEach((node) => node.remove())
    this.nodeElements.clear()
    this.renderedEdges?.remove()
    this.renderedEdges = undefined
  }

  captureStartPositions(): Map<string, { x: number; y: number }> {
    return new Map(
      Array.from(this.nodeElements, ([id, node]) => [
        id,
        { x: node.offsetLeft, y: node.offsetTop },
      ]),
    )
  }

  sync(graph: Graph, layout: GraphLayout, interactions: GraphInteractionController): boolean {
    let firstRender = false
    interactions.withEventsSuppressed(() => {
      interactions.deleteEveryConnection()
      const currentNodeIds = new Set(graph.nodes.map(({ id }) => id))
      this.nodeElements.forEach((node, id) => {
        if (!currentNodeIds.has(id)) {
          interactions.unmanageNode(node)
          node.remove()
          this.nodeElements.delete(id)
        }
      })

      const connectedNodeIds = graph.getConnectedNodeIds()
      graph.nodes.forEach(({ id, label }) => {
        const position = this.getNodeLayout(layout, id)
        let node = this.nodeElements.get(id)
        if (!node) {
          node = this.createNode(id, label, position, interactions)
          this.nodeElements.set(id, node)
        } else if (node.textContent !== label) {
          node.textContent = label
        }

        node.style.width = `${position.width}px`
        node.style.height = `${position.height}px`
        node.setAttribute('aria-label', `Node: ${label}`)
        interactions.setDraggable(node, !connectedNodeIds.has(id))
      })

      if (!this.renderedEdges) {
        this.renderedEdges = renderEdgeRoutes(layout.edges, layout.width, layout.height)
        this.container.prepend(this.renderedEdges)
        firstRender = true
      }
    })
    return firstRender
  }

  private createNode(
    id: string,
    label: string,
    position: NodeLayout,
    interactions: GraphInteractionController,
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
    interactions.attachNode(node, id)
    return node
  }

  private getNodeLayout(layout: GraphLayout, id: string): NodeLayout {
    const position = layout.nodes.get(id)
    if (!position) {
      throw new Error(`Missing layout data for node "${id}"`)
    }
    return position
  }
}
