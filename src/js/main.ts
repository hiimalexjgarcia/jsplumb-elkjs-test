import { newInstance } from '@jsplumb/browser-ui'
import ELK from 'elkjs/lib/elk.bundled.js'
import './graph-node'
import 'bootstrap/dist/css/bootstrap.css'
import '../scss/styles.scss'
import { graph } from './graph'
import { layoutGraph } from './elk-layout'

const toolkit = newInstance({
  container: document.querySelector<HTMLDivElement>('#app')!,
  elementsDraggable: false,
})

const elk = new ELK()
const container = document.querySelector<HTMLDivElement>('#app')!

layoutGraph(graph, elk)
  .then((layout) => {
    const elements = new Map<string, HTMLElement>()

    graph.nodes.forEach(({ id, label }) => {
      const position = layout.get(id)
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
      elements.set(id, node)
    })

    graph.edges.forEach(({ sourceNodeId, targetNodeId }) => {
      const source = elements.get(sourceNodeId)
      const target = elements.get(targetNodeId)
      if (!source || !target) {
        throw new Error(`Edge references a missing node: ${sourceNodeId} -> ${targetNodeId}`)
      }

      toolkit.connect({
        source,
        target,
        anchor: { type: 'Perimeter', options: { shape: 'Rectangle' } },
        endpoints: ['Blank', 'Blank'],
        overlays: [{ type: 'Arrow', options: { location: 1 } }],
      })
    })
  })
  .catch(console.error)
