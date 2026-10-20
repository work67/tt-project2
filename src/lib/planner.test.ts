import { describe, expect, it } from 'vitest'
import { parseBusData } from './busData'
import { applyLiveWaits, DEFAULT_WAIT_MIN, planTrips } from './planner'

// A tiny network along one latitude; 0.001° lng ≈ 111 m.
// Service A: S1 → S2 → S3 → S4. Service B: S3 → S5 → S6. Service C: S1 → S6 directly but slowly (long detour).
const lat = 1.3
const at = (lng: number): [number, number, string, string] => [lng, lat, `Stop ${lng}`, 'Test Rd']
const rawStops = {
  S1: at(103.8),
  S2: at(103.81),
  S3: at(103.82),
  S4: at(103.83),
  S5: at(103.84),
  S6: at(103.85),
  FAR: [103.85, 1.4, 'Detour', 'Far Rd'] as [number, number, string, string],
}

describe('planTrips', () => {
  it('finds a direct trip and walks to the nearest stops', () => {
    const data = parseBusData(rawStops, { A: { name: 'A', routes: [['S1', 'S2', 'S3', 'S4']] } })
    const trips = planTrips(data, { lat, lng: 103.8 }, { lat, lng: 103.83 })
    expect(trips).toHaveLength(1)
    expect(trips[0].legs[0].board.code).toBe('S1')
    expect(trips[0].legs[0].alight.code).toBe('S4')
    expect(trips[0].waitMin).toBe(DEFAULT_WAIT_MIN)
  })

  it('never rides a service backwards', () => {
    const data = parseBusData(rawStops, { A: { name: 'A', routes: [['S1', 'S2', 'S3', 'S4']] } })
    expect(planTrips(data, { lat, lng: 103.83 }, { lat, lng: 103.8 })).toEqual([])
  })

  it('uses one transfer when it beats the direct detour', () => {
    const data = parseBusData(rawStops, {
      A: { name: 'A', routes: [['S1', 'S2', 'S3', 'S4']] },
      B: { name: 'B', routes: [['S3', 'S5', 'S6']] },
      C: { name: 'C', routes: [['S1', 'FAR', 'S6']] },
    })
    const [best] = planTrips(data, { lat, lng: 103.8 }, { lat, lng: 103.85 })
    expect(best.legs.map((l) => l.service)).toEqual(['A', 'B'])
    expect(best.legs[0].alight.code).toBe('S3')
  })

  it('re-ranks trips by live wait time', () => {
    const data = parseBusData(rawStops, {
      A: { name: 'A', routes: [['S1', 'S2', 'S3', 'S4']] },
      D: { name: 'D', routes: [['S1', 'S4']] },
    })
    const trips = planTrips(data, { lat, lng: 103.8 }, { lat, lng: 103.83 })
    const reranked = applyLiveWaits(trips, (_stop, leg) => (leg.service === 'A' ? 1 : 30))
    expect(reranked[0].legs[0].service).toBe('A')
    expect(reranked[0].waitIsLive).toBe(true)
  })

  it('handles loop services that revisit a stop', () => {
    const data = parseBusData(rawStops, { L: { name: 'L', routes: [['S1', 'S2', 'S3', 'S2', 'S1']] } })
    const trips = planTrips(data, { lat, lng: 103.82 }, { lat, lng: 103.8 })
    expect(trips[0].legs[0].path.map((s) => s.code)).toEqual(['S3', 'S2', 'S1'])
  })
})
