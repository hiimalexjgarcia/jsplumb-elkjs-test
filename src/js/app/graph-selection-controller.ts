import type { Graph } from '../graph/graph'
import { graphNodeHeight, graphNodeWidth } from '../graph/node-geometry'
import type { GraphCanvas } from './graph-canvas'

export type GraphSelection =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }

export class GraphSelectionController {
  private selection?: GraphSelection
  private connectMode = false
  private connectSourceId?: string

  constructor(
    private readonly container: HTMLDivElement,
    private readonly graph: Graph,
    private readonly canvas: GraphCanvas,
    private readonly connectModeButton: HTMLButtonElement,
    private readonly editSelectedButton: HTMLButtonElement,
    private readonly deleteSelectedButton: HTMLButtonElement,
    private readonly actionStatus: HTMLSpanElement,
  ) {}

  selectNode(nodeId: string): void {
    this.setSelection({ type: 'node', id: nodeId })
  }

  selectEdge(edgeId: string): void {
    this.setSelection({ type: 'edge', id: edgeId })
  }

  toggleConnectMode(): void {
    this.connectMode = !this.connectMode
    this.connectSourceId = this.connectMode && this.selection?.type === 'node'
      ? this.selection.id
      : undefined
    this.updateConnectModeStatus()
  }

  editSelection(): void {
    if (this.selection?.type === 'node') {
      this.canvas.getNodeElement(this.selection.id)?.editLabel()
    }
  }

  deleteSelection(): void {
    if (!this.selection) {
      return
    }

    if (this.selection.type === 'node') {
      this.deleteNode(this.selection.id)
    } else {
      this.deleteEdge(this.selection.id)
    }
  }

  deleteNode(nodeId: string): void {
    this.graph.removeNode(nodeId)
    this.clearConnectSource(nodeId)
    this.setSelection(undefined)
    this.render()
  }

  deleteEdge(edgeId: string): void {
    this.graph.removeEdge(edgeId)
    this.setSelection(undefined)
    this.render()
  }

  handleCanvasClick(
    event: MouseEvent,
    node?: HTMLElementTagNameMap['graph-node'],
    edge?: SVGPathElement,
  ): void {
    if (event.composedPath().some((target) => target instanceof HTMLInputElement)) {
      return
    }

    if (this.connectMode) {
      this.handleConnectModeClick(event, node, edge)
      return
    }

    if (node) {
      this.selectNode(node.id)
    } else if (edge?.dataset.edgeId) {
      this.selectEdge(edge.dataset.edgeId)
    } else {
      this.setSelection(undefined)
    }
  }

  private handleConnectModeClick(
    event: MouseEvent,
    node?: HTMLElementTagNameMap['graph-node'],
    edge?: SVGPathElement,
  ): void {
    if (node) {
      this.handleConnectNode(node)
      return
    }

    if (edge) {
      this.actionStatus.textContent = 'Tap a node or an empty area to connect.'
      return
    }

    if (!this.connectSourceId) {
      return
    }

    const point = this.canvas.canvasPointFromClient(event.clientX, event.clientY)
    if (!point) {
      return
    }

    const sourceId = this.connectSourceId
    this.connectSourceId = undefined
    this.actionStatus.textContent = 'Creating connected node...'
    this.canvas.addConnectedNode(sourceId, {
      x: Math.max(0, point.x - graphNodeWidth / 2),
      y: Math.max(0, point.y - graphNodeHeight / 2),
    }).then(() => {
      this.actionStatus.textContent = 'Connected. Tap a source node to continue.'
    }).catch((error: unknown) => {
      console.error(error)
      this.actionStatus.textContent = 'Could not create the connected node.'
    })
  }

  private handleConnectNode(node: HTMLElementTagNameMap['graph-node']): void {
    if (!this.connectSourceId) {
      this.connectSourceId = node.id
      this.selectNode(node.id)
      this.actionStatus.textContent = 'Source selected. Tap a target node or empty area.'
      return
    }

    if (this.connectSourceId === node.id) {
      this.actionStatus.textContent = 'Choose a different target node.'
      return
    }

    this.graph.addEdge(this.connectSourceId, node.id)
    this.connectSourceId = undefined
    this.selectNode(node.id)
    this.actionStatus.textContent = 'Connected. Tap a source node to continue.'
    this.render()
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

  private updateConnectModeStatus(): void {
    this.connectModeButton.setAttribute('aria-pressed', String(this.connectMode))
    this.connectModeButton.classList.toggle('btn-primary', this.connectMode)
    this.connectModeButton.classList.toggle('btn-outline-primary', !this.connectMode)
    this.actionStatus.textContent = this.connectMode
      ? this.connectSourceId
        ? 'Tap a target node or empty area.'
        : 'Tap a source node to begin connecting.'
      : ''
  }

  private clearConnectSource(nodeId: string): void {
    if (this.connectSourceId === nodeId) {
      this.connectSourceId = undefined
    }
  }

  private render(): void {
    this.canvas.render().catch(console.error)
  }
}
