import { describe, expect, it } from 'vitest'
import { interpolateEdgeRoutes } from './svg-edge-renderer'
import type { EdgeRoute } from '../layout/elk-layout'

describe('interpolateEdgeRoutes', () => {
  it('moves route points between layouts while retaining target edge IDs', () => {
    const fromRoutes: EdgeRoute[] = [
      { id: 'existing', sections: [[{ x: 0, y: 0 }, { x: 0, y: 100 }]] },
      { id: 'removed', sections: [[{ x: 10, y: 10 }, { x: 10, y: 20 }]] },
    ]
    const toRoutes: EdgeRoute[] = [
      { id: 'existing', sections: [[{ x: 100, y: 0 }, { x: 100, y: 100 }]] },
      { id: 'added', sections: [[{ x: 200, y: 0 }, { x: 200, y: 100 }]] },
    ]

    const routes = interpolateEdgeRoutes(fromRoutes, toRoutes, 0.5)

    expect(routes.map(({ id }) => id)).toEqual(['existing', 'added'])
    expect(routes[0].sections[0][0]).toEqual({ x: 50, y: 0 })
    expect(routes[0].sections[0][routes[0].sections[0].length - 1]).toEqual({ x: 50, y: 100 })
    expect(routes[1]).toEqual(toRoutes[1])
  })

})
