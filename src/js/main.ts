import { newInstance } from '@jsplumb/browser-ui'
import Modal from 'bootstrap/js/dist/modal'
import './graph-node'
import 'bootstrap/dist/css/bootstrap.css'
import '../scss/styles.scss'
import { graph } from './graph'
import { layoutGraph } from './elk-layout'
import { renderEdgeRoutes } from './elk-edge-renderer'

const toolkit = newInstance({
  container: document.querySelector<HTMLDivElement>('#app')!,
  elementsDraggable: false,
})

const container = document.querySelector<HTMLDivElement>('#app')!
const addNodeButton = document.querySelector<HTMLButtonElement>('#add-node')!
const showGraphButton = document.querySelector<HTMLButtonElement>('#show-graph')!
const graphDump = document.querySelector<HTMLPreElement>('#graph-dump')!
const graphModal = Modal.getOrCreateInstance(document.querySelector<HTMLDivElement>('#graph-modal')!)
let renderGeneration = 0
let renderingGraph = false

toolkit.bind('connection', ({ sourceId, targetId }) => {
  if (!renderingGraph) {
    graph.addEdge(sourceId, targetId)
    renderGraph().catch(console.error)
  }
})

toolkit.bind('connection:detach', ({ sourceId, targetId }) => {
  if (!renderingGraph) {
    graph.removeEdge(sourceId, targetId)
    renderGraph().catch(console.error)
  }
})

async function renderGraph(): Promise<void> {
  const generation = ++renderGeneration
  const layout = await layoutGraph(graph)
  if (generation !== renderGeneration) {
    return
  }

  renderingGraph = true
  try {
    toolkit.deleteEveryConnection()
    container.querySelectorAll('graph-node').forEach((node) => toolkit.unmanage(node, true))
    container.querySelector('.graph-edges')?.remove()
    const endpoints = new Map<string, ReturnType<typeof toolkit.addEndpoint>>()

    graph.nodes.forEach(({ id, label }) => {
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
      container.appendChild(node)
      endpoints.set(id, toolkit.addEndpoint(node, {
        source: true,
        target: true,
        maxConnections: -1,
        anchor: { type: 'Perimeter', options: { shape: 'Rectangle' } },
        endpoint: { type: 'Dot', options: { radius: 5 } },
        connectorOverlays: [{ type: 'Arrow', options: { location: 1 } }],
      }))
      node.addEventListener('label-change', ({ detail }) => {
        graph.updateNodeLabel(id, detail.label)
      })
    })

    container.prepend(renderEdgeRoutes(layout.edges, layout.width, layout.height))
  } finally {
    renderingGraph = false
  }
}

addNodeButton.addEventListener('click', () => {
  graph.addNode()
  renderGraph().catch(console.error)
})

showGraphButton.addEventListener('click', () => {
  graphDump.textContent = JSON.stringify(graph, null, 2)
  graphModal.show()
})

renderGraph().catch(console.error)
