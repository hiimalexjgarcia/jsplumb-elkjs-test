import type { GraphPosition } from '../graph/graph'

export type GraphContextAction =
  | { type: 'edit-node'; nodeId: string }
  | { type: 'delete-node'; nodeId: string }
  | { type: 'delete-edge'; edgeId: string }
  | { type: 'add-node'; position: GraphPosition }

interface GraphContextMenuItem {
  label: string
  action: GraphContextAction
}

export class GraphContextMenu {
  private readonly element = document.createElement('div')
  private returnFocusTarget: HTMLElement | SVGPathElement | null = null

  constructor(private readonly onSelect: (action: GraphContextAction) => void) {
    this.element.className = 'dropdown-menu'
    this.element.setAttribute('role', 'menu')
    this.element.hidden = true
    this.element.style.position = 'fixed'
    this.element.style.zIndex = '1080'
    this.element.addEventListener('keydown', (event) => this.handleMenuKeydown(event))
    this.element.addEventListener('focusout', (event) => {
      if (!(event.relatedTarget instanceof Node) || !this.element.contains(event.relatedTarget)) {
        this.hide(false)
      }
    })
    document.addEventListener('pointerdown', (event) => this.handleOutsidePointerdown(event))
    document.addEventListener('keydown', (event) => this.handleDocumentKeydown(event))
    window.addEventListener('scroll', () => this.hide(), true)
    document.body.appendChild(this.element)
  }

  show(items: GraphContextMenuItem[], x: number, y: number, returnFocusTarget: HTMLElement | SVGPathElement): void {
    this.returnFocusTarget = returnFocusTarget
    this.element.replaceChildren(
      ...items.map(({ label, action }) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'dropdown-item'
        button.setAttribute('role', 'menuitem')
        button.textContent = label
        button.addEventListener('click', () => {
          this.hide(false)
          this.onSelect(action)
        })
        return button
      }),
    )

    this.element.hidden = false
    this.element.classList.add('show')
    const bounds = this.element.getBoundingClientRect()
    const margin = 8
    this.element.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - bounds.width - margin))}px`
    this.element.style.top = `${Math.max(margin, Math.min(y, window.innerHeight - bounds.height - margin))}px`
    this.element.querySelector<HTMLButtonElement>('button')?.focus()
  }

  private hide(restoreFocus = true): void {
    if (this.element.hidden) {
      return
    }

    this.element.hidden = true
    this.element.classList.remove('show')
    if (restoreFocus && this.returnFocusTarget?.isConnected) {
      this.returnFocusTarget.focus()
    }
    this.returnFocusTarget = null
  }

  private handleOutsidePointerdown(event: PointerEvent): void {
    if (event.target instanceof Node && !this.element.contains(event.target)) {
      this.hide()
    }
  }

  private handleDocumentKeydown(event: KeyboardEvent): void {
    if (!this.element.hidden && event.key === 'Escape') {
      event.preventDefault()
      this.hide()
    }
  }

  private handleMenuKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return
    }

    const items = Array.from(this.element.querySelectorAll<HTMLButtonElement>('button'))
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex = (currentIndex + direction + items.length) % items.length
    event.preventDefault()
    items[nextIndex]?.focus()
  }
}
