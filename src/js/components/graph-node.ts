export {}

interface LabelChangeDetail {
  label: string
}

class GraphNodeElement extends HTMLElement {
  private editingInput?: HTMLInputElement

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

        input {
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          font: inherit;
        }
      </style>
      <div class="node"><slot></slot></div>
    `

    this.addEventListener('dblclick', () => this.startEditing())
  }

  editLabel(): void {
    this.startEditing()
  }

  private startEditing(): void {
    if (this.editingInput) {
      return
    }

    const nodeContent = this.shadowRoot?.querySelector('.node')
    if (!nodeContent) {
      return
    }

    const originalLabel = this.textContent ?? ''
    const input = document.createElement('input')
    input.type = 'text'
    input.value = originalLabel
    input.setAttribute('aria-label', `Edit label for node ${this.id}`)
    this.editingInput = input
    this.dispatchEvent(new Event('label-edit-start', { bubbles: true, composed: true }))
    nodeContent.replaceChildren(input)
    input.focus()
    input.select()

    const finishEditing = (save: boolean): void => {
      if (this.editingInput !== input) {
        return
      }

      this.editingInput = undefined
      const label = save ? input.value : originalLabel
      this.textContent = label
      nodeContent.replaceChildren(document.createElement('slot'))
      this.dispatchEvent(new Event('label-edit-end', { bubbles: true, composed: true }))

      if (save && label !== originalLabel) {
        this.dispatchEvent(new CustomEvent<LabelChangeDetail>('label-change', {
          bubbles: true,
          composed: true,
          detail: { label },
        }))
      }
    }

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        finishEditing(true)
      } else if (event.key === 'Escape') {
        finishEditing(false)
      }
    })
    input.addEventListener('blur', () => finishEditing(true))
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'graph-node': GraphNodeElement
  }

  interface HTMLElementEventMap {
    'label-change': CustomEvent<LabelChangeDetail>
    'label-edit-start': Event
    'label-edit-end': Event
  }
}

customElements.define('graph-node', GraphNodeElement)
