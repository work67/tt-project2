import { distanceMeters, type LatLng } from './geo'

export type Stop = LatLng & { code: string; name: string; road: string }

/** One direction (or loop) of a service: the ordered stops it calls at. */
export type Pattern = {
  service: string
  /** Terminal stop code, used to tell the two directions apart in arrival data. */
  destination: string
  stops: string[]
}

export type BusData = {
  stops: Map<string, Stop>
  patterns: Pattern[]
}

// Shapes of the busrouter.sg files snapshotted by scripts/fetch-data.mjs.
type RawStops = Record<string, [lng: number, lat: number, name: string, road: string]>
type RawServices = Record<string, { name: string; routes: string[][] }>

export function parseBusData(rawStops: RawStops, rawServices: RawServices): BusData {
  const stops = new Map<string, Stop>()
  for (const [code, [lng, lat, name, road]] of Object.entries(rawStops)) {
    stops.set(code, { code, lat, lng, name, road })
  }
  const patterns: Pattern[] = []
  for (const [service, { routes }] of Object.entries(rawServices)) {
    for (const route of routes) {
      const known = route.filter((code) => stops.has(code))
      if (known.length < 2) continue
      patterns.push({ service, destination: known[known.length - 1], stops: known })
    }
  }
  return { stops, patterns }
}

export async function loadBusData(): Promise<BusData> {
  const [rawStops, rawServices] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/stops.min.json`).then((r) => r.json() as Promise<RawStops>),
    fetch(`${import.meta.env.BASE_URL}data/services.min.json`).then((r) => r.json() as Promise<RawServices>),
  ])
  return parseBusData(rawStops, rawServices)
}

export type NearbyStop = { stop: Stop; meters: number }

/** Stops within `radius` metres, nearest first. Falls back to the closest `fallback` stops if none are in range. */
export function stopsNear(data: BusData, point: LatLng, radius: number, fallback = 3): NearbyStop[] {
  const all = [...data.stops.values()]
    .map((stop) => ({ stop, meters: distanceMeters(point, stop) }))
    .sort((a, b) => a.meters - b.meters)
  const inRange = all.filter((s) => s.meters <= radius)
  return inRange.length > 0 ? inRange : all.slice(0, fallback)
}
