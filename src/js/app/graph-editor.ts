import Modal from 'bootstrap/js/dist/modal'
import { GraphContextMenu } from '../ui/graph-context-menu'
import { findFreeNodePosition, graphNodeHeight, graphNodeWidth } from '../graph/node-geometry'
import type { Graph, GraphPosition } from '../graph/graph'
import { GraphCanvas } from './graph-canvas'
import { GraphSelectionController } from './graph-selection-controller'

type GraphEditorAction =
  | { type: 'edit-node'; nodeId: string }
  | { type: 'delete-node'; nodeId: string }
  | { type: 'delete-edge'; edgeId: string }
  | { type: 'add-node'; position: GraphPosition }

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
  private readonly connectModeButton: HTMLButtonElement
  private readonly editSelectedButton: HTMLButtonElement
  private readonly deleteSelectedButton: HTMLButtonElement
  private readonly zoomInButton: HTMLButtonElement
  private readonly zoomOutButton: HTMLButtonElement
  private readonly fitGraphButton: HTMLButtonElement
  private readonly actionStatus: HTMLSpanElement
  private readonly graphDump: HTMLPreElement
  private readonly graphModal: Modal
  private readonly contextMenu: GraphContextMenu<GraphEditorAction>
  private readonly canvas: GraphCanvas
  private readonly selection: GraphSelectionController
  private mounted = false
  private listenerController?: AbortController
  private disposed = false

  constructor(
    root: HTMLElement,
    private readonly graph: Graph,
  ) {
    this.container = requireElement(root, '#graph-canvas')
    this.addNodeButton = requireElement(root, '#add-node')
    this.showGraphButton = requireElement(root, '#show-graph')
    this.connectModeButton = requireElement(root, '#connect-mode')
    this.editSelectedButton = requireElement(root, '#edit-selected')
    this.deleteSelectedButton = requireElement(root, '#delete-selected')
    this.zoomInButton = requireElement(root, '#zoom-in')
    this.zoomOutButton = requireElement(root, '#zoom-out')
    this.fitGraphButton = requireElement(root, '#fit-graph')
    this.actionStatus = requireElement(root, '#graph-action-status')
    this.graphDump = requireElement(root, '#graph-dump')
    this.graphModal = Modal.getOrCreateInstance(requireElement(root, '#graph-modal'))
    this.canvas = new GraphCanvas(
      this.container,
      graph,
      requireElement(root, '#graph-viewport'),
      requireElement(root, '#graph-surface'),
    )
    this.selection = new GraphSelectionController(
      this.container,
      graph,
      this.canvas,
      this.connectModeButton,
      this.editSelectedButton,
      this.deleteSelectedButton,
      this.actionStatus,
    )
    this.contextMenu = new GraphContextMenu<GraphEditorAction>((action) => this.handleContextAction(action))
  }

  mount(): void {
    if (this.disposed) {
      throw new Error('Cannot mount a disposed graph editor')
    }
    if (this.mounted) {
      return
    }
    this.mounted = true
    const listeners = new AbortController()
    this.listenerController = listeners
    this.container.addEventListener('contextmenu', (event) => this.showContextMenu(event), { signal: listeners.signal })
    this.container.addEventListener('click', (event) => this.handleCanvasClick(event), { signal: listeners.signal })
    this.container.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      const path = event.composedPath()
      if (path.some((target) => target instanceof HTMLInputElement)) {
        return
      }

      const node = this.nodeFromPath(path)
      if (node) {
        event.preventDefault()
        this.showNodeContextMenu(node, 0, 0)
        return
      }

      const edge = this.edgeFromPath(path)
      if (edge) {
        event.preventDefault()
        this.showEdgeContextMenu(edge, 0, 0)
      }
    }, { signal: listeners.signal })

    this.addNodeButton.addEventListener('click', () => {
      const occupied = this.graph.nodes.flatMap(({ position }) => position ? [position] : [])
      this.graph.addNode(findFreeNodePosition(occupied, this.container.clientWidth))
      this.canvas.render().catch(console.error)
    }, { signal: listeners.signal })

    this.connectModeButton.addEventListener('click', () => {
      this.selection.toggleConnectMode()
    }, { signal: listeners.signal })
    this.editSelectedButton.addEventListener('click', () => this.selection.editSelection(), { signal: listeners.signal })
    this.deleteSelectedButton.addEventListener('click', () => this.selection.deleteSelection(), { signal: listeners.signal })
    this.zoomInButton.addEventListener('click', () => this.canvas.zoomIn(), { signal: listeners.signal })
    this.zoomOutButton.addEventListener('click', () => this.canvas.zoomOut(), { signal: listeners.signal })
    this.fitGraphButton.addEventListener('click', () => {
      this.canvas.fitToScreen()
    }, { signal: listeners.signal })

    this.showGraphButton.addEventListener('click', () => {
      this.graphDump.textContent = JSON.stringify(this.graph, null, 2)
      this.graphModal.show()
    }, { signal: listeners.signal })

    this.canvas.mount()
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.listenerController?.abort()
    this.contextMenu.dispose()
    this.canvas.dispose()
  }

  private showContextMenu(event: MouseEvent): void {
    const path = event.composedPath()
    const edge = this.edgeFromPath(path)
    const node = this.nodeFromPath(path) ?? this.nodeAtPoint(event.clientX, event.clientY)

    event.preventDefault()
    if (node) {
      this.showNodeContextMenu(node, event.clientX, event.clientY)
    } else if (edge?.dataset.edgeId) {
      this.showEdgeContextMenu(edge, event.clientX, event.clientY)
    } else {
      const point = this.canvas.canvasPointFromClient(event.clientX, event.clientY)
      if (!point) {
        return
      }
      const position = {
        x: Math.max(0, point.x - graphNodeWidth / 2),
        y: Math.max(0, point.y - graphNodeHeight / 2),
      }
      this.contextMenu.show([
        { label: 'Add node', action: { type: 'add-node', position } },
      ], event.clientX, event.clientY, this.addNodeButton)
    }
  }

  private showNodeContextMenu(node: HTMLElementTagNameMap['graph-node'], x: number, y: number): void {
    this.selection.selectNode(node.id)
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

    this.selection.selectEdge(edgeId)
    const bounds = edge.getBoundingClientRect()
    this.contextMenu.show([
      { label: 'Delete edge', action: { type: 'delete-edge', edgeId } },
    ], x || bounds.left, y || bounds.bottom, edge)
  }

  private handleContextAction(action: GraphEditorAction): void {
    switch (action.type) {
      case 'edit-node':
        this.canvas.getNodeElement(action.nodeId)?.editLabel()
        break
      case 'delete-node':
        this.selection.deleteNode(action.nodeId)
        this.addNodeButton.focus()
        break
      case 'delete-edge':
        this.selection.deleteEdge(action.edgeId)
        this.addNodeButton.focus()
        break
      case 'add-node':
        this.graph.addNode(action.position)
        this.addNodeButton.focus()
        this.canvas.render().catch(console.error)
        break
    }
  }

  private handleCanvasClick(event: MouseEvent): void {
    const path = event.composedPath()
    const node = this.nodeFromPath(path) ?? this.nodeAtPoint(event.clientX, event.clientY)
    const edge = this.edgeFromPath(path)
    this.selection.handleCanvasClick(event, node, edge)
  }

  private nodeFromPath(path: EventTarget[]): HTMLElementTagNameMap['graph-node'] | undefined {
    return path.find(
      (target): target is HTMLElementTagNameMap['graph-node'] =>
        target instanceof HTMLElement && target.localName === 'graph-node',
    )
  }

  private edgeFromPath(path: EventTarget[]): SVGPathElement | undefined {
    return path.find(
      (target): target is SVGPathElement =>
        target instanceof SVGPathElement && target.dataset.edgeId !== undefined,
    )
  }

  private nodeAtPoint(x: number, y: number): HTMLElementTagNameMap['graph-node'] | undefined {
    return Array.from(this.container.querySelectorAll<HTMLElementTagNameMap['graph-node']>('graph-node'))
      .find((node) => {
        const bounds = node.getBoundingClientRect()
        return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
      })
  }
}
