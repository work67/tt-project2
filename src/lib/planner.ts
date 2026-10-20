import { stopsNear, type BusData, type Pattern, type Stop } from './busData'
import { distanceMeters, walkMinutes, type LatLng } from './geo'

/** Average bus speed including dwell time at stops; the data has no scheduled travel times. */
export const BUS_SPEED_KMH = 18
export const ACCESS_RADIUS_M = 400
export const TRANSFER_PENALTY_MIN = 5
/** Assumed wait before live arrival times are known (half a typical 10-min headway). */
export const DEFAULT_WAIT_MIN = 5

export type Leg = {
  service: string
  pattern: Pattern
  board: Stop
  alight: Stop
  /** Stops from board to alight inclusive, for drawing on the map. */
  path: Stop[]
  rideMin: number
}

export type Trip = {
  legs: Leg[]
  walkToBoardMin: number
  walkFromAlightMin: number
  /** Wait for the first bus; DEFAULT_WAIT_MIN until live arrivals replace it. */
  waitMin: number
  waitIsLive: boolean
  totalMin: number
}

/** Look up how many minutes until `service` reaches `stop`, or undefined if unknown. */
export type WaitLookup = (stopCode: string, leg: Leg) => number | undefined

type Access = Map<string, number> // stop code -> walk minutes

function accessStops(data: BusData, point: LatLng): Access {
  return new Map(stopsNear(data, point, ACCESS_RADIUS_M).map((n) => [n.stop.code, walkMinutes(n.meters)]))
}

function makeLeg(data: BusData, pattern: Pattern, from: number, to: number): Leg {
  const path = pattern.stops.slice(from, to + 1).map((code) => data.stops.get(code)!)
  let meters = 0
  for (let i = 1; i < path.length; i++) meters += distanceMeters(path[i - 1], path[i])
  return {
    service: pattern.service,
    pattern,
    board: path[0],
    alight: path[path.length - 1],
    path,
    rideMin: (meters / 1000 / BUS_SPEED_KMH) * 60,
  }
}

export function withWait(trip: Omit<Trip, 'waitMin' | 'waitIsLive' | 'totalMin'>, wait?: number): Trip {
  const waitMin = wait ?? DEFAULT_WAIT_MIN
  const transfers = trip.legs.length - 1
  const totalMin =
    trip.walkToBoardMin +
    waitMin +
    trip.legs.reduce((sum, leg) => sum + leg.rideMin, 0) +
    transfers * TRANSFER_PENALTY_MIN +
    trip.walkFromAlightMin
  return { ...trip, waitMin, waitIsLive: wait !== undefined, totalMin }
}

/** Keep the faster of two trips under the same key. */
function keepBest(best: Map<string, Trip>, key: string, trip: Trip) {
  const current = best.get(key)
  if (!current || trip.totalMin < current.totalMin) best.set(key, trip)
}

/**
 * Plan bus trips from `from` to `to`, minimising estimated total time
 * (walk + wait + ride + transfer penalty + walk). Considers direct services and
 * trips with one transfer at the same stop. Returns at most `limit` trips, fastest first,
 * with at most one trip per service combination.
 */
export function planTrips(data: BusData, from: LatLng, to: LatLng, limit = 6): Trip[] {
  const origins = accessStops(data, from)
  const destinations = accessStops(data, to)
  const best = new Map<string, Trip>()

  // Earliest arrival at each potential transfer stop via a first bus, keyed by stop code.
  type Reach = { minutes: number; pattern: Pattern; from: number; to: number }
  const reached = new Map<string, Reach[]>()

  for (const pattern of data.patterns) {
    const { stops } = pattern
    for (let i = 0; i < stops.length - 1; i++) {
      const walkIn = origins.get(stops[i])
      if (walkIn === undefined) continue
      let rideSoFar = 0
      for (let j = i + 1; j < stops.length; j++) {
        rideSoFar += distanceMeters(data.stops.get(stops[j - 1])!, data.stops.get(stops[j])!)
        const walkOut = destinations.get(stops[j])
        if (walkOut !== undefined) {
          const leg = makeLeg(data, pattern, i, j)
          keepBest(best, pattern.service, withWait({ legs: [leg], walkToBoardMin: walkIn, walkFromAlightMin: walkOut }))
        }
        const minutes = walkIn + (rideSoFar / 1000 / BUS_SPEED_KMH) * 60
        const list = reached.get(stops[j]) ?? []
        // Only the best way to reach a stop on each service matters.
        const same = list.findIndex((r) => r.pattern.service === pattern.service)
        if (same === -1) list.push({ minutes, pattern, from: i, to: j })
        else if (minutes < list[same].minutes) list[same] = { minutes, pattern, from: i, to: j }
        reached.set(stops[j], list)
      }
    }
  }

  for (const pattern of data.patterns) {
    const { stops } = pattern
    for (let k = 0; k < stops.length - 1; k++) {
      const firstLegs = reached.get(stops[k])
      if (!firstLegs) continue
      for (let j = k + 1; j < stops.length; j++) {
        const walkOut = destinations.get(stops[j])
        if (walkOut === undefined) continue
        for (const first of firstLegs) {
          if (first.pattern.service === pattern.service) continue
          const legA = makeLeg(data, first.pattern, first.from, first.to)
          const legB = makeLeg(data, pattern, k, j)
          const walkIn = origins.get(legA.board.code)!
          keepBest(
            best,
            `${legA.service}>${legB.service}`,
            withWait({ legs: [legA, legB], walkToBoardMin: walkIn, walkFromAlightMin: walkOut }),
          )
        }
      }
    }
  }

  const trips = [...best.values()].sort((a, b) => a.totalMin - b.totalMin)
  // A transfer trip is only worth showing if it beats every direct option.
  const fastestDirect = trips.find((t) => t.legs.length === 1)?.totalMin ?? Infinity
  return trips.filter((t) => t.legs.length === 1 || t.totalMin < fastestDirect).slice(0, limit)
}

/** Re-score trips with live waits for the first bus, then re-sort. */
export function applyLiveWaits(trips: Trip[], lookup: WaitLookup): Trip[] {
  return trips
    .map((trip) => withWait(trip, lookup(trip.legs[0].board.code, trip.legs[0])))
    .sort((a, b) => a.totalMin - b.totalMin)
}

export function walkingOnlyMinutes(from: LatLng, to: LatLng): number {
  return walkMinutes(distanceMeters(from, to))
}
