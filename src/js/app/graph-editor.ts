import Modal from 'bootstrap/js/dist/modal'
import { GraphContextMenu } from '../components/graph-context-menu'
import { findFreeNodePosition } from '../graph/node-geometry'
import type { Graph } from '../graph/graph'
import type { GraphEditorAction } from './graph-editor-action'
import { GraphCanvas } from './graph-canvas'

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
  private readonly contextMenu: GraphContextMenu<GraphEditorAction>
  private readonly canvas: GraphCanvas

  constructor(
    root: HTMLElement,
    private readonly graph: Graph,
  ) {
    this.container = requireElement(root, '#graph-canvas')
    this.addNodeButton = requireElement(root, '#add-node')
    this.showGraphButton = requireElement(root, '#show-graph')
    this.graphDump = requireElement(root, '#graph-dump')
    this.graphModal = Modal.getOrCreateInstance(requireElement(root, '#graph-modal'))
    this.canvas = new GraphCanvas(this.container, graph)
    this.contextMenu = new GraphContextMenu<GraphEditorAction>((action) => this.handleContextAction(action))
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

    this.showGraphButton.addEventListener('click', () => {
      this.graphDump.textContent = JSON.stringify(this.graph, null, 2)
      this.graphModal.show()
    })

    this.canvas.mount()
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

    event.preventDefault()
    if (node) {
      this.showNodeContextMenu(node, event.clientX, event.clientY)
    } else if (edge?.dataset.edgeId) {
      this.showEdgeContextMenu(edge, event.clientX, event.clientY)
    } else {
      const bounds = this.container.getBoundingClientRect()
      const position = {
        x: Math.max(0, event.clientX - bounds.left + this.container.scrollLeft - 50),
        y: Math.max(0, event.clientY - bounds.top + this.container.scrollTop - 25),
      }
      this.contextMenu.show([
        { label: 'Add node', action: { type: 'add-node', position } },
      ], event.clientX, event.clientY, this.addNodeButton)
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

  private handleContextAction(action: GraphEditorAction): void {
    switch (action.type) {
      case 'edit-node':
        this.canvas.getNodeElement(action.nodeId)?.editLabel()
        break
      case 'delete-node':
        this.graph.removeNode(action.nodeId)
        this.addNodeButton.focus()
        this.canvas.render().catch(console.error)
        break
      case 'delete-edge':
        this.graph.removeEdge(action.edgeId)
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
}
