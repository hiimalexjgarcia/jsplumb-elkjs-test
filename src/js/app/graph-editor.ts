import { newInstance } from '@jsplumb/browser-ui'
import Modal from 'bootstrap/js/dist/modal'
import { GraphContextMenu, type GraphContextAction } from '../components/graph-context-menu'
import type { Graph } from '../graph/graph'
import { layoutGraph } from '../layout/elk-layout-adapter'
import { renderEdgeRoutes } from '../rendering/svg-edge-renderer'

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Required graph editor element not found: ${selector}`)
  }
  return element
}

export class GraphEditor {
  private readonly container: HTMLDivElement
  private readonly addNodeButton: HTMLButtonElement
  private readonly showGraphButton: HTMLButtonElement
  private readonly graphDump: HTMLPreElement
  private readonly graphModal: Modal
  private readonly contextMenu: GraphContextMenu
  private readonly toolkit
  private readonly transientEdgeIds = new WeakMap<object, string>()
  private nodeElements = new Map<string, HTMLElementTagNameMap['graph-node']>()
  private renderGeneration = 0
  private renderingGraph = false

  constructor(
    root: HTMLElement,
    private readonly graph: Graph,
  ) {
    this.container = requireElement(root, '#graph-canvas')
    this.addNodeButton = requireElement(root, '#add-node')
    this.showGraphButton = requireElement(root, '#show-graph')
    this.graphDump = requireElement(root, '#graph-dump')
    this.graphModal = Modal.getOrCreateInstance(requireElement(root, '#graph-modal'))
    this.toolkit = newInstance({
      container: this.container,
      elementsDraggable: true,
    })
    this.contextMenu = new GraphContextMenu((action) => this.handleContextAction(action))
  }

  mount(): void {
    this.container.addEventListener('contextmenu', (event) => this.showContextMenu(event))
    this.container.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      const path = event.composedPath()
      if (path.some((target) => target instanceof HTMLInputElement)) {
        return
      }

      const node = path.find(
        (target): target is HTMLElementTagNameMap['graph-node'] =>
          target instanceof HTMLElement && target.localName === 'graph-node',
      )
      if (node) {
        event.preventDefault()
        this.showNodeContextMenu(node, 0, 0)
      }
    })

    this.toolkit.bind('connection', ({ connection, sourceId, targetId }) => {
      if (this.renderingGraph) {
        return
      }

      const edge = this.graph.addEdge(sourceId, targetId)
      this.transientEdgeIds.set(connection, edge.id)
      this.renderGraph().catch(console.error)
    })

    this.toolkit.bind('connection:detach', ({ connection }) => {
      if (this.renderingGraph) {
        return
      }

      const edgeId = this.transientEdgeIds.get(connection)
      if (edgeId) {
        this.graph.removeEdge(edgeId)
        this.renderGraph().catch(console.error)
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

    this.addNodeButton.addEventListener('click', () => {
      this.graph.addNode()
      this.renderGraph().catch(console.error)
    })

    this.showGraphButton.addEventListener('click', () => {
      this.graphDump.textContent = JSON.stringify(this.graph, null, 2)
      this.graphModal.show()
    })

    this.renderGraph().catch(console.error)
  }

  private async renderGraph(): Promise<void> {
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
      const endpoints = new Map<string, ReturnType<typeof this.toolkit.addEndpoint>>()
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
        endpoints.set(id, endpoint)
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

      const edgeSvg = renderEdgeRoutes(layout.edges, layout.width, layout.height)
      edgeSvg.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          const edge = event.composedPath().find(
            (target): target is SVGPathElement =>
              target instanceof SVGPathElement && target.dataset.edgeId !== undefined,
          )
          if (edge) {
            this.showEdgeContextMenu(edge, 0, 0)
          }
        }
      })
      this.container.prepend(edgeSvg)
    } finally {
      this.renderingGraph = false
    }
  }

  private showContextMenu(event: MouseEvent): void {
    const path = event.composedPath()
    const edge = path.find(
      (target): target is SVGPathElement =>
        target instanceof SVGPathElement && target.dataset.edgeId !== undefined,
    )
    const node = path.find(
      (target): target is HTMLElementTagNameMap['graph-node'] =>
        target instanceof HTMLElement && target.localName === 'graph-node',
    )

    if (!edge && !node) {
      return
    }

    event.preventDefault()
    if (node) {
      this.showNodeContextMenu(node, event.clientX, event.clientY)
    } else if (edge?.dataset.edgeId) {
      this.showEdgeContextMenu(edge, event.clientX, event.clientY)
    }
  }

  private showNodeContextMenu(node: HTMLElementTagNameMap['graph-node'], x: number, y: number): void {
    const bounds = node.getBoundingClientRect()
    this.contextMenu.show([
      { label: 'Edit label', action: { type: 'edit-node', nodeId: node.id } },
      { label: 'Delete node', action: { type: 'delete-node', nodeId: node.id } },
    ], x || bounds.left, y || bounds.bottom, node)
  }

  private showEdgeContextMenu(edge: SVGPathElement, x: number, y: number): void {
    const edgeId = edge.dataset.edgeId
    if (!edgeId) {
      return
    }

    const bounds = edge.getBoundingClientRect()
    this.contextMenu.show([
      { label: 'Delete edge', action: { type: 'delete-edge', edgeId } },
    ], x || bounds.left, y || bounds.bottom, edge)
  }

  private handleContextAction(action: GraphContextAction): void {
    switch (action.type) {
      case 'edit-node':
        this.nodeElements.get(action.nodeId)?.editLabel()
        break
      case 'delete-node':
        this.graph.removeNode(action.nodeId)
        this.addNodeButton.focus()
        this.renderGraph().catch(console.error)
        break
      case 'delete-edge':
        this.graph.removeEdge(action.edgeId)
        this.addNodeButton.focus()
        this.renderGraph().catch(console.error)
        break
    }
  }
}
