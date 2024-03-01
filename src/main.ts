import './style.css'
import { newInstance } from '@jsplumb/browser-ui'
import ELK from 'elkjs/lib/elk.bundled.js'

const graph = {
  id: "root",
  layoutOptions: { 'elk.algorithm': 'layered' },
  children: [
    { id: "n1", width: 100, height: 50 },
    { id: "n2", width: 100, height: 50 },
    { id: "n3", width: 100, height: 50 },
    { id: "n4", width: 100, height: 50 }
  ],
  edges: [
    { id: "e1", sources: [ "n1" ], targets: [ "n2" ] },
    { id: "e2", sources: [ "n1" ], targets: [ "n3" ] },
    { id: "e3", sources: [ "n2" ], targets: [ "n4" ] },
    { id: "e4", sources: [ "n3" ], targets: [ "n4" ] }
  ]
}

const instance = newInstance({
  container: document.querySelector<HTMLDivElement>('#app')!,
});

const elk = new ELK()

elk.layout(graph)
  .then((r) => {
    console.log(r)
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
