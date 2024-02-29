import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = ``

import { newInstance } from "@jsplumb/browser-ui"

const instance = newInstance({
  container: document.querySelector<HTMLDivElement>('#app')!,
});

const a = document.createElement("div")
a.className = "node"
a.innerHTML = "a";
document.querySelector<HTMLDivElement>('#app')?.appendChild(a)

const b = document.createElement("div")
b.className = "node"
b.innerHTML = "b";
document.querySelector<HTMLDivElement>('#app')?.appendChild(b)

const c = document.createElement("div")
c.className = "node"
c.innerHTML = "c";
document.querySelector<HTMLDivElement>('#app')?.appendChild(c)

instance.connect({
  source: a,
  target: b,
  anchor: { type: "Perimeter", options: { shape: "Rectangle" } },
  endpoints: ["Blank", "Blank"],
  overlays: [
    { type: "Arrow", options: { location: 1 } },
  ]
})

instance.connect({
  source: b,
  target: c,
  anchor: { type: "Perimeter", options: { shape: "Rectangle" } },
  endpoints: ["Blank", "Blank"],
  overlays: [
    { type: "Arrow", options: { location: 1 } },
  ]
})
