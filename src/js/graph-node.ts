class GraphNode extends HTMLElement {
  constructor() {
    super()

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          position: absolute;
        }

        .node {
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          border: 1px solid black;
          background-color: rgb(240, 240, 240);
          box-shadow: rgba(0, 0, 0, .25) 3px 3px 3px;
        }
      </style>
      <div class="node"><slot></slot></div>
    `
  }
}

customElements.define('graph-node', GraphNode)
