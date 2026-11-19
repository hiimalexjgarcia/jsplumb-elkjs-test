import { newInstance, type Connection } from '@jsplumb/browser-ui'
import type { Graph, GraphPosition } from '../graph/graph'
import { graphNodeHeight, graphNodeWidth } from '../graph/node-geometry'

export class GraphInteractionController {
  private readonly toolkit
  private readonly transientEdgeIds = new WeakMap<object, string>()
  private eventsSuppressed = false

  constructor(
    private readonly container: HTMLDivElement,
    private readonly graph: Graph,
    private readonly nodeElements: Map<string, HTMLElementTagNameMap['graph-node']>,
    private readonly render: () => Promise<void>,
    private readonly canvasPointFromClient: (x: number, y: number) => GraphPosition | undefined,
    private readonly addConnectedNode: (sourceId: string, position: GraphPosition) => Promise<void>,
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
      if (this.eventsSuppressed) {
        return
      }

      const edge = this.graph.addEdge(sourceId, targetId)
      this.transientEdgeIds.set(connection, edge.id)
      this.requestRender()
    })

    this.toolkit.bind('connection:detach', ({ connection }) => {
      if (this.eventsSuppressed) {
        return
      }

      const edgeId = this.transientEdgeIds.get(connection)
      if (edgeId) {
        this.graph.removeEdge(edgeId)
        this.requestRender()
      }
    })

    this.toolkit.bind<Connection>('connection:abort', (connection, originalEvent) => {
      if (this.eventsSuppressed || !originalEvent) {
        return
      }

      this.createConnectedNodeAtDrop(connection, originalEvent).catch(console.error)
    })

    this.toolkit.bind('drag:stop', ({ el }) => {
      if (el instanceof HTMLElement && el.localName === 'graph-node') {
        this.graph.updateNodePosition(el.id, {
          x: el.offsetLeft,
          y: el.offsetTop,
        })
      }
    })
  }

  attachNode(node: HTMLElementTagNameMap['graph-node'], id: string): void {
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
  }

  withEventsSuppressed<T>(action: () => T): T {
    this.eventsSuppressed = true
    try {
      return action()
    } finally {
      this.eventsSuppressed = false
    }
  }

  deleteEveryConnection(): void {
    this.toolkit.deleteEveryConnection()
  }

  unmanageNode(node: HTMLElement): void {
    this.toolkit.unmanage(node, true)
  }

  setDraggable(node: HTMLElement, draggable: boolean): void {
    this.toolkit.setDraggable(node, draggable)
  }

  revalidate(node: HTMLElement): void {
    this.toolkit.revalidate(node)
  }

  setZoom(zoom: number): void {
    this.toolkit.setZoom(zoom, true)
  }

  private requestRender(): void {
    this.render().catch(console.error)
  }

  private async createConnectedNodeAtDrop(connection: Connection, event: Event): Promise<void> {
    const point = this.getClientPoint(event)
    if (!point || this.isOccupiedDropTarget(point.x, point.y)) {
      return
    }

    const position = this.canvasPointFromClient(point.x, point.y)
    if (!position) {
      return
    }

    if (!this.graph.nodes.some(({ id }) => id === connection.sourceId)) {
      throw new Error(`Cannot create a node for unknown source "${connection.sourceId}"`)
    }

    await this.addConnectedNode(connection.sourceId, {
      x: Math.max(0, position.x - graphNodeWidth / 2),
      y: Math.max(0, position.y - graphNodeHeight / 2),
    })
  }

  private getClientPoint(event: Event): { x: number; y: number } | undefined {
    if (event instanceof MouseEvent) {
      return { x: event.clientX, y: event.clientY }
    }

    if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
      const touch = event.changedTouches[0] ?? event.touches[0]
      return touch ? { x: touch.clientX, y: touch.clientY } : undefined
    }

    return undefined
  }

  private isOccupiedDropTarget(clientX: number, clientY: number): boolean {
    const selectors = 'graph-node, .graph-endpoint, .graph-edges path[data-edge-id]'
    const overNode = Array.from(this.nodeElements.values()).some((node) => {
      const bounds = node.getBoundingClientRect()
      return clientX >= bounds.left
        && clientX <= bounds.right
        && clientY >= bounds.top
        && clientY <= bounds.bottom
    })
    if (overNode) {
      return true
    }

    const target = document.elementFromPoint(clientX, clientY)
    return target !== null && (target.matches(selectors) || target.closest(selectors) !== null)
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
