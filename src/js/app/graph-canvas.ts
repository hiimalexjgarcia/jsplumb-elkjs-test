import { newInstance } from '@jsplumb/browser-ui'
import type { Graph } from '../graph/graph'
import { layoutGraph } from '../layout/elk-layout-adapter'
import { renderEdgeRoutes } from '../rendering/svg-edge-renderer'

export class GraphCanvas {
  private readonly toolkit
  private readonly transientEdgeIds = new WeakMap<object, string>()
  private readonly nodeElements = new Map<string, HTMLElementTagNameMap['graph-node']>()
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
      this.container.querySelectorAll('graph-node').forEach((node) => this.toolkit.unmanage(node, true))
      this.container.querySelector('.graph-edges')?.remove()
      this.nodeElements.clear()
      const connectedNodeIds = new Set(
        this.graph.edges.flatMap(({ sourceNodeId, targetNodeId }) => [sourceNodeId, targetNodeId]),
      )

      this.graph.nodes.forEach(({ id, label }) => {
        const position = layout.nodes.get(id)
        if (!position) {
          throw new Error(`Missing layout data for node "${id}"`)
        }

        const node = document.createElement('graph-node')
        node.id = id
        node.textContent = label
        node.style.top = `${position.y}px`
        node.style.left = `${position.x}px`
        node.style.width = `${position.width}px`
        node.style.height = `${position.height}px`
        node.tabIndex = 0
        node.setAttribute('aria-label', `Node: ${label}`)
        this.container.appendChild(node)
        this.nodeElements.set(id, node)
        const endpoint = this.toolkit.addEndpoint(node, {
          source: true,
          target: true,
          maxConnections: -1,
          anchor: 'Center',
          endpoint: { type: 'Dot', options: { radius: 8, cssClass: 'graph-endpoint' } },
          connectorOverlays: [{ type: 'Arrow', options: { location: 1 } }],
        })
        this.toolkit.setDraggable(node, !connectedNodeIds.has(id))

        const updateEndpointEmphasis = (): void => {
          requestAnimationFrame(() => {
            if (node.matches(':hover, :focus-within')) {
              endpoint.addClass('graph-endpoint-emphasized')
            } else {
              endpoint.removeClass('graph-endpoint-emphasized')
            }
          })
        }
        node.addEventListener('pointerenter', updateEndpointEmphasis)
        node.addEventListener('pointerleave', updateEndpointEmphasis)
        node.addEventListener('focusin', updateEndpointEmphasis)
        node.addEventListener('focusout', updateEndpointEmphasis)

        node.addEventListener('label-change', ({ detail }) => {
          this.graph.updateNodeLabel(id, detail.label)
        })
      })

      this.container.prepend(renderEdgeRoutes(layout.edges, layout.width, layout.height))
    } finally {
      this.renderingGraph = false
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
