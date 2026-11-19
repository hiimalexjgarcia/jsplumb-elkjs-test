import Modal from 'bootstrap/js/dist/modal'
import { GraphContextMenu } from '../components/graph-context-menu'
import { findFreeNodePosition, graphNodeHeight, graphNodeWidth } from '../graph/node-geometry'
import type { Graph } from '../graph/graph'
import type { GraphEditorAction } from './graph-editor-action'
import { GraphCanvas } from './graph-canvas'

type GraphSelection =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }

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
  private selection?: GraphSelection
  private connectMode = false
  private connectSourceId?: string

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
    this.contextMenu = new GraphContextMenu<GraphEditorAction>((action) => this.handleContextAction(action))
  }

  mount(): void {
    this.container.addEventListener('contextmenu', (event) => this.showContextMenu(event))
    this.container.addEventListener('click', (event) => this.handleCanvasClick(event))
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
        return
      }

      const edge = path.find(
        (target): target is SVGPathElement =>
          target instanceof SVGPathElement && target.dataset.edgeId !== undefined,
      )
      if (edge) {
        event.preventDefault()
        this.showEdgeContextMenu(edge, 0, 0)
      }
    })

    this.addNodeButton.addEventListener('click', () => {
      const occupied = this.graph.nodes.flatMap(({ position }) => position ? [position] : [])
      this.graph.addNode(findFreeNodePosition(occupied, this.container.clientWidth))
      this.canvas.render().catch(console.error)
    })

    this.connectModeButton.addEventListener('click', () => {
      this.connectMode = !this.connectMode
      this.connectSourceId = this.connectMode && this.selection?.type === 'node'
        ? this.selection.id
        : undefined
      this.updateConnectModeStatus()
    })
    this.editSelectedButton.addEventListener('click', () => {
      if (this.selection?.type === 'node') {
        this.canvas.getNodeElement(this.selection.id)?.editLabel()
      }
    })
    this.deleteSelectedButton.addEventListener('click', () => this.deleteSelection())
    this.zoomInButton.addEventListener('click', () => this.canvas.zoomIn())
    this.zoomOutButton.addEventListener('click', () => this.canvas.zoomOut())
    this.fitGraphButton.addEventListener('click', () => {
      this.canvas.fitToScreen()
    })

    this.showGraphButton.addEventListener('click', () => {
      this.graphDump.textContent = JSON.stringify(this.graph, null, 2)
      this.graphModal.show()
    })

    this.canvas.mount()
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
    this.setSelection({ type: 'node', id: node.id })
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

    this.setSelection({ type: 'edge', id: edgeId })
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
        this.graph.removeNode(action.nodeId)
        this.clearConnectSource(action.nodeId)
        this.setSelection(undefined)
        this.addNodeButton.focus()
        this.canvas.render().catch(console.error)
        break
      case 'delete-edge':
        this.graph.removeEdge(action.edgeId)
        this.setSelection(undefined)
        this.addNodeButton.focus()
        this.canvas.render().catch(console.error)
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
    if (path.some((target) => target instanceof HTMLInputElement)) {
      return
    }

    const node = this.nodeFromPath(path) ?? this.nodeAtPoint(event.clientX, event.clientY)
    const edge = this.edgeFromPath(path)

    if (this.connectMode) {
      if (node) {
        this.handleConnectNode(node)
      } else if (edge) {
        this.actionStatus.textContent = 'Tap a node or an empty area to connect.'
      } else if (this.connectSourceId) {
        const point = this.canvas.canvasPointFromClient(event.clientX, event.clientY)
        if (point) {
          this.canvas.addConnectedNode(this.connectSourceId, {
            x: Math.max(0, point.x - graphNodeWidth / 2),
            y: Math.max(0, point.y - graphNodeHeight / 2),
          }).then(() => {
            this.actionStatus.textContent = 'Connected. Tap a source node to continue.'
          }).catch((error: unknown) => {
            console.error(error)
            this.actionStatus.textContent = 'Could not create the connected node.'
          })
          this.connectSourceId = undefined
          this.actionStatus.textContent = 'Creating connected node...'
        }
      }
      return
    }

    if (node) {
      this.setSelection({ type: 'node', id: node.id })
    } else if (edge?.dataset.edgeId) {
      this.setSelection({ type: 'edge', id: edge.dataset.edgeId })
    } else {
      this.setSelection(undefined)
    }
  }

  private handleConnectNode(node: HTMLElementTagNameMap['graph-node']): void {
    if (!this.connectSourceId) {
      this.connectSourceId = node.id
      this.setSelection({ type: 'node', id: node.id })
      this.actionStatus.textContent = 'Source selected. Tap a target node or empty area.'
      return
    }

    if (this.connectSourceId === node.id) {
      this.actionStatus.textContent = 'Choose a different target node.'
      return
    }

    this.graph.addEdge(this.connectSourceId, node.id)
    this.connectSourceId = undefined
    this.setSelection({ type: 'node', id: node.id })
    this.actionStatus.textContent = 'Connected. Tap a source node to continue.'
    this.canvas.render().catch(console.error)
  }

  private setSelection(selection: GraphSelection | undefined): void {
    this.selection = selection
    this.container.querySelectorAll<HTMLElementTagNameMap['graph-node']>('graph-node')
      .forEach((node) => node.classList.toggle(
        'graph-node-selected',
        selection?.type === 'node' && selection.id === node.id,
      ))
    this.container.querySelectorAll<SVGPathElement>('.graph-edges path[data-edge-id]')
      .forEach((edge) => edge.classList.toggle(
        'graph-edge-selected',
        selection?.type === 'edge' && selection.id === edge.dataset.edgeId,
      ))
    this.editSelectedButton.disabled = selection?.type !== 'node'
    this.deleteSelectedButton.disabled = selection === undefined
  }

  private deleteSelection(): void {
    if (!this.selection) {
      return
    }

    if (this.selection.type === 'node') {
      this.graph.removeNode(this.selection.id)
      this.clearConnectSource(this.selection.id)
    } else {
      this.graph.removeEdge(this.selection.id)
    }
    this.setSelection(undefined)
    this.canvas.render().catch(console.error)
  }

  private updateConnectModeStatus(): void {
    this.connectModeButton.setAttribute('aria-pressed', String(this.connectMode))
    this.connectModeButton.classList.toggle('btn-primary', this.connectMode)
    this.connectModeButton.classList.toggle('btn-outline-primary', !this.connectMode)
    if (this.connectMode) {
      this.actionStatus.textContent = this.connectSourceId
        ? 'Tap a target node or empty area.'
        : 'Tap a source node to begin connecting.'
    } else {
      this.connectSourceId = undefined
      this.actionStatus.textContent = ''
    }
  }

  private clearConnectSource(nodeId: string): void {
    if (this.connectSourceId === nodeId) {
      this.connectSourceId = undefined
    }
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
