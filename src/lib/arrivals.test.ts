import { describe, expect, it } from 'vitest'
import { catchableBuses, minutesUntil, type Arrival } from './arrivals'

const NOW = Date.parse('2026-10-20T14:00:00+08:00')
const bus = (minutesFromNow: number): Arrival => ({
  time: new Date(NOW + minutesFromNow * 60_000).toISOString(),
  duration_ms: minutesFromNow * 60_000,
  load: 'SEA',
  type: 'SD',
  feature: 'WAB',
  destination_code: '00000',
  monitored: 1,
})

describe('catchableBuses', () => {
  it('skips buses that leave before you can walk to the stop', () => {
    const arrivals = [bus(2), bus(9), bus(20)]
    const { bus: next, following, missed } = catchableBuses(arrivals, 5, NOW)
    expect(next).toBe(arrivals[1])
    expect(following).toBe(arrivals[2])
    expect(missed).toBe(1)
  })

  it('returns no bus when none can be caught', () => {
    expect(catchableBuses([bus(1)], 5, NOW)).toEqual({ bus: undefined, following: undefined, missed: 1 })
  })

  it('counts down from the absolute arrival time', () => {
    expect(minutesUntil(bus(10), NOW + 4 * 60_000)).toBe(6)
    expect(minutesUntil(bus(1), NOW + 4 * 60_000)).toBe(0)
  })
})
