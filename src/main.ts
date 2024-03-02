import './style.css'
import { newInstance } from '@jsplumb/browser-ui'
import ELK from 'elkjs/lib/elk.bundled.js'

const graph = {
  id: "root",
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.layered.spacing.baseValue': 100
  },
  children: [
    { id: "n1", width: 100, height: 50 },
    { id: "n2", width: 100, height: 50 },
    { id: "n3", width: 100, height: 50 },
    { id: "n4", width: 100, height: 50 },
    { id: "n5", width: 100, height: 50 },
    { id: "n6", width: 100, height: 50 }
  ],
  edges: [
    { id: "e1", sources: [ "n1" ], targets: [ "n2" ] },
    { id: "e2", sources: [ "n1" ], targets: [ "n3" ] },
    { id: "e3", sources: [ "n1" ], targets: [ "n5" ] },
    { id: "e4", sources: [ "n2" ], targets: [ "n4" ] },
    { id: "e5", sources: [ "n3" ], targets: [ "n4" ] },
    { id: "e6", sources: [ "n4" ], targets: [ "n6" ] },
    { id: "e7", sources: [ "n5" ], targets: [ "n6" ] }
  ]
}

const instance = newInstance({
  container: document.querySelector<HTMLDivElement>('#app')!,
});

const elk = new ELK()

elk.layout(graph)
  .then((r) => {
    r.children?.forEach(c => {
      const node = document.createElement("div")
      node.id = c.id
      node.className = "node"
      node.innerHTML = c.id
      node.style.top = `${c.y}px`
      node.style.left = `${c.x}px`
      node.style.width = `${c.width}px`
      node.style.height = `${c.height}px`
      document.querySelector<HTMLDivElement>('#app')?.appendChild(node)
    })
    r.edges?.forEach(e => {
      instance.connect({
        source: document.getElementById(e.sources[0]) || undefined,
        target: document.getElementById(e.targets[0]) || undefined,
        anchor: { type: "Perimeter", options: { shape: "Rectangle" } },
        endpoints: ["Blank", "Blank"],
        overlays: [
          { type: "Arrow", options: { location: 1 } },
        ]
      })
    })
  })
  .catch(console.error)
