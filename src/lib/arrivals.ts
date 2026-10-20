// Live arrivals via arrivelah (github.com/cheeaun/arrivelah), the CORS-enabled proxy over
// LTA DataMall BusArrival that busrouter.sg uses. Swap this module for your own proxy if needed.
const ARRIVALS_URL = 'https://arrivelah2.busrouter.sg/'
/** arrivelah caches for 15 s, so polling faster gains nothing. */
export const MIN_POLL_MS = 15_000

export type Load = 'SEA' | 'SDA' | 'LSD'
export type BusType = 'SD' | 'DD' | 'BD'

export type Arrival = {
  time: string
  duration_ms: number
  load: Load
  type: BusType
  feature: string
  destination_code: string
  monitored: 0 | 1
}

export type ServiceArrivals = {
  no: string
  next: Arrival | null
  subsequent: Arrival | null
  next2?: Arrival | null
  next3: Arrival | null
}

export async function fetchArrivals(stopCode: string, signal?: AbortSignal): Promise<ServiceArrivals[]> {
  const res = await fetch(`${ARRIVALS_URL}?id=${encodeURIComponent(stopCode)}`, { signal })
  if (!res.ok) throw new Error(`Arrivals unavailable (HTTP ${res.status})`)
  const body = (await res.json()) as { services: ServiceArrivals[] }
  return body.services ?? []
}

/** Next three buses of `service` heading to `destination`, soonest first. */
export function upcomingBuses(all: ServiceArrivals[], service: string, destination: string): Arrival[] {
  const entries = all.filter((s) => s.no === service)
  // The same service number can appear once per direction; prefer the one heading our way.
  const entry = entries.find((s) => s.next?.destination_code === destination) ?? entries[0]
  if (!entry) return []
  return [entry.next, entry.subsequent, entry.next3].filter((a): a is Arrival => a != null)
}

/** Milliseconds from `now` until the bus arrives (negative once it has arrived). */
export function msUntil(arrival: Arrival, now: number): number {
  return Date.parse(arrival.time) - now
}

export function minutesUntil(arrival: Arrival, now: number): number {
  return Math.max(0, msUntil(arrival, now) / 60_000)
}

/**
 * The first bus you can still reach after walking `walkMin` to the stop, plus the one after it.
 * `missed` counts earlier buses that leave before you could get there.
 */
export function catchableBuses(arrivals: Arrival[], walkMin: number, now: number) {
  const index = arrivals.findIndex((a) => msUntil(a, now) >= walkMin * 60_000)
  if (index === -1) return { bus: undefined, following: undefined, missed: arrivals.length }
  return { bus: arrivals[index], following: arrivals[index + 1], missed: index }
}

export const LOAD_LABEL: Record<Load, string> = {
  SEA: 'Seats available',
  SDA: 'Standing available',
  LSD: 'Limited standing',
}

export const TYPE_LABEL: Record<BusType, string> = {
  SD: 'Single deck',
  DD: 'Double deck',
  BD: 'Bendy',
}
