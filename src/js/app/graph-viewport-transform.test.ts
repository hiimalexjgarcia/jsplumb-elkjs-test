import { describe, expect, it } from 'vitest'
import { getPanForZoomAnchor, viewportPointToCanvasPoint } from './graph-viewport-transform'

describe('graph viewport transform', () => {
  it('converts viewport positions into canvas coordinates after panning and zooming', () => {
    expect(viewportPointToCanvasPoint(
      { x: 120, y: 90 },
      2,
      { x: 20, y: 10 },
    )).toEqual({ x: 50, y: 40 })
  })

  it('keeps the selected canvas point fixed during zoom', () => {
    const viewportPoint = { x: 140, y: 100 }
    const canvasPoint = { x: 60, y: 40 }
    const pan = getPanForZoomAnchor(viewportPoint, canvasPoint, 1.5)

    expect(viewportPointToCanvasPoint(viewportPoint, 1.5, pan)).toEqual(canvasPoint)
  })
})
