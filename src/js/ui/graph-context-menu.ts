export interface GraphContextMenuItem<TAction> {
  label: string
  action: TAction
}

export class GraphContextMenu<TAction> {
  private readonly element = document.createElement('div')
  private returnFocusTarget: HTMLElement | SVGPathElement | null = null
  private disposed = false

  private readonly outsidePointerdownListener = (event: PointerEvent): void => {
    this.handleOutsidePointerdown(event)
  }
  private readonly documentKeydownListener = (event: KeyboardEvent): void => {
    this.handleDocumentKeydown(event)
  }
  private readonly windowScrollListener = (): void => this.hide()

  constructor(private readonly onSelect: (action: TAction) => void) {
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
    document.addEventListener('pointerdown', this.outsidePointerdownListener)
    document.addEventListener('keydown', this.documentKeydownListener)
    window.addEventListener('scroll', this.windowScrollListener, true)
    document.body.appendChild(this.element)
  }

  show(items: GraphContextMenuItem<TAction>[], x: number, y: number, returnFocusTarget: HTMLElement | SVGPathElement): void {
    if (this.disposed) {
      throw new Error('Cannot show a disposed graph context menu')
    }

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

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    document.removeEventListener('pointerdown', this.outsidePointerdownListener)
    document.removeEventListener('keydown', this.documentKeydownListener)
    window.removeEventListener('scroll', this.windowScrollListener, true)
    this.element.remove()
    this.returnFocusTarget = null
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
