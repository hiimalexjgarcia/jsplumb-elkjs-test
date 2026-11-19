import type { GraphPosition } from '../graph/graph'

interface PointerPosition {
  x: number
  y: number
}

interface PinchStart {
  distance: number
  zoom: number
  contentPoint: GraphPosition
}

const minimumZoom = 0.25
const maximumZoom = 2.5

export class GraphViewportController {
  private readonly pointers = new Map<number, PointerPosition>()
  private zoom = 1
  private contentWidth = 0
  private contentHeight = 0
  private panPointerId?: number
  private panStart?: { point: PointerPosition; scroll: GraphPosition }
  private pinchStart?: PinchStart
  private resizeObserver?: ResizeObserver
  private mounted = false
  private disposed = false

  private readonly pointerDownListener = (event: PointerEvent): void => this.handlePointerDown(event)
  private readonly pointerMoveListener = (event: PointerEvent): void => this.handlePointerMove(event)
  private readonly pointerEndListener = (event: PointerEvent): void => this.handlePointerEnd(event)
  private readonly wheelListener = (event: WheelEvent): void => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      this.zoomAt(this.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), event.clientX, event.clientY)
    }
  }
  private readonly resizeListener = (): void => this.updateSurfaceSize()

  constructor(
    private readonly viewport: HTMLDivElement,
    private readonly surface: HTMLDivElement,
    private readonly canvas: HTMLDivElement,
    private readonly onZoomChange: (zoom: number) => void,
  ) {}

  mount(): void {
    if (this.disposed) {
      throw new Error('Cannot mount a disposed graph viewport')
    }
    if (this.mounted) {
      return
    }
    this.mounted = true
    this.viewport.addEventListener('pointerdown', this.pointerDownListener)
    this.viewport.addEventListener('pointermove', this.pointerMoveListener)
    this.viewport.addEventListener('pointerup', this.pointerEndListener)
    this.viewport.addEventListener('pointercancel', this.pointerEndListener)
    this.viewport.addEventListener('lostpointercapture', this.pointerEndListener)
    this.viewport.addEventListener('wheel', this.wheelListener, { passive: false })
    this.resizeObserver = new ResizeObserver(this.resizeListener)
    this.resizeObserver.observe(this.viewport)
    this.updateSurfaceSize()
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.resizeObserver?.disconnect()
    this.resizeObserver = undefined
    this.viewport.removeEventListener('pointerdown', this.pointerDownListener)
    this.viewport.removeEventListener('pointermove', this.pointerMoveListener)
    this.viewport.removeEventListener('pointerup', this.pointerEndListener)
    this.viewport.removeEventListener('pointercancel', this.pointerEndListener)
    this.viewport.removeEventListener('lostpointercapture', this.pointerEndListener)
    this.viewport.removeEventListener('wheel', this.wheelListener)
    this.pointers.forEach((_, pointerId) => {
      if (this.viewport.hasPointerCapture(pointerId)) {
        this.viewport.releasePointerCapture(pointerId)
      }
    })
    this.pointers.clear()
    this.panPointerId = undefined
    this.panStart = undefined
    this.pinchStart = undefined
  }

  setContentSize(width: number, height: number): void {
    this.contentWidth = width
    this.contentHeight = height
    this.updateSurfaceSize()
  }

  canvasPointFromClient(clientX: number, clientY: number): GraphPosition | undefined {
    const bounds = this.viewport.getBoundingClientRect()
    if (
      clientX < bounds.left
      || clientX > bounds.right
      || clientY < bounds.top
      || clientY > bounds.bottom
    ) {
      return undefined
    }

    return {
      x: (clientX - bounds.left - this.viewport.clientLeft + this.viewport.scrollLeft) / this.zoom,
      y: (clientY - bounds.top - this.viewport.clientTop + this.viewport.scrollTop) / this.zoom,
    }
  }

  zoomIn(): void {
    this.zoomAt(this.zoom * 1.2, this.viewportCenterX(), this.viewportCenterY())
  }

  zoomOut(): void {
    this.zoomAt(this.zoom / 1.2, this.viewportCenterX(), this.viewportCenterY())
  }

  fitToScreen(): void {
    if (this.contentWidth === 0 || this.contentHeight === 0) {
      return
    }

    const scale = Math.min(
      (this.viewport.clientWidth - 24) / this.contentWidth,
      (this.viewport.clientHeight - 24) / this.contentHeight,
      1,
    )
    this.zoomAt(scale, this.viewportCenterX(), this.viewportCenterY())
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') {
      return
    }

    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.pointers.size === 1 && this.isEmptyCanvasPoint(event.clientX, event.clientY)) {
      this.panPointerId = event.pointerId
      this.panStart = {
        point: { x: event.clientX, y: event.clientY },
        scroll: { x: this.viewport.scrollLeft, y: this.viewport.scrollTop },
      }
    } else if (this.pointers.size === 2) {
      this.startPinch()
      this.pointers.forEach((_, pointerId) => this.viewport.setPointerCapture(pointerId))
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) {
      return
    }

    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (this.pinchStart && this.pointers.size >= 2) {
      const [first, second] = Array.from(this.pointers.values())
      const distance = Math.hypot(second.x - first.x, second.y - first.y)
      if (distance > 0) {
        const bounds = this.viewport.getBoundingClientRect()
        const centerX = (first.x + second.x) / 2 - bounds.left - this.viewport.clientLeft
        const centerY = (first.y + second.y) / 2 - bounds.top - this.viewport.clientTop
        const zoom = this.pinchStart.zoom * distance / this.pinchStart.distance
        this.setZoom(zoom, centerX, centerY, this.pinchStart.contentPoint)
      }
    } else if (event.pointerId === this.panPointerId && this.panStart) {
      if (Math.hypot(
        event.clientX - this.panStart.point.x,
        event.clientY - this.panStart.point.y,
      ) > 8 && !this.viewport.hasPointerCapture(event.pointerId)) {
        this.viewport.setPointerCapture(event.pointerId)
      }
      this.viewport.scrollLeft = this.panStart.scroll.x - (event.clientX - this.panStart.point.x)
      this.viewport.scrollTop = this.panStart.scroll.y - (event.clientY - this.panStart.point.y)
    }
  }

  private handlePointerEnd(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) {
      return
    }

    this.pointers.delete(event.pointerId)
    this.panPointerId = undefined
    this.panStart = undefined
    if (this.pointers.size < 2) {
      this.pinchStart = undefined
    }
  }

  private startPinch(): void {
    const [first, second] = Array.from(this.pointers.values())
    const distance = Math.hypot(second.x - first.x, second.y - first.y)
    if (distance === 0) {
      return
    }

    const bounds = this.viewport.getBoundingClientRect()
    const centerX = (first.x + second.x) / 2 - bounds.left - this.viewport.clientLeft
    const centerY = (first.y + second.y) / 2 - bounds.top - this.viewport.clientTop
    this.pinchStart = {
      distance,
      zoom: this.zoom,
      contentPoint: {
        x: (this.viewport.scrollLeft + centerX) / this.zoom,
        y: (this.viewport.scrollTop + centerY) / this.zoom,
      },
    }
    this.panPointerId = undefined
    this.panStart = undefined
  }

  private zoomAt(zoom: number, clientX: number, clientY: number): void {
    const bounds = this.viewport.getBoundingClientRect()
    const centerX = clientX - bounds.left - this.viewport.clientLeft
    const centerY = clientY - bounds.top - this.viewport.clientTop
    const contentPoint = {
      x: (this.viewport.scrollLeft + centerX) / this.zoom,
      y: (this.viewport.scrollTop + centerY) / this.zoom,
    }
    this.setZoom(zoom, centerX, centerY, contentPoint)
  }

  private setZoom(
    zoom: number,
    centerX: number,
    centerY: number,
    contentPoint: GraphPosition,
  ): void {
    this.zoom = Math.max(minimumZoom, Math.min(maximumZoom, zoom))
    this.updateSurfaceSize()
    this.onZoomChange(this.zoom)
    this.viewport.scrollLeft = contentPoint.x * this.zoom - centerX
    this.viewport.scrollTop = contentPoint.y * this.zoom - centerY
  }

  private updateSurfaceSize(): void {
    const width = Math.max(this.contentWidth, this.viewport.clientWidth / this.zoom)
    const height = Math.max(this.contentHeight, this.viewport.clientHeight / this.zoom)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.canvas.style.transform = `scale(${this.zoom})`
    this.surface.style.width = `${width * this.zoom}px`
    this.surface.style.height = `${height * this.zoom}px`
  }

  private isEmptyCanvasPoint(clientX: number, clientY: number): boolean {
    const target = document.elementFromPoint(clientX, clientY)
    return target !== null
      && !target.closest('graph-node, .graph-endpoint, .graph-edges path[data-edge-id]')
  }

  private viewportCenterX(): number {
    return this.viewport.getBoundingClientRect().left + this.viewport.clientLeft + this.viewport.clientWidth / 2
  }

  private viewportCenterY(): number {
    return this.viewport.getBoundingClientRect().top + this.viewport.clientTop + this.viewport.clientHeight / 2
  }
}
