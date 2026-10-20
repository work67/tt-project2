import type { LatLng } from './geo'

export type Place = LatLng & { label: string; detail: string }

// OneMap is best for Singapore postal codes and blocks; Photon (OSM) is the fallback
// in case OneMap starts enforcing its API token.
async function searchOneMap(query: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ searchVal: query, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: '1' })
  const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?${params}`, { signal })
  if (!res.ok) throw new Error(`OneMap HTTP ${res.status}`)
  const body = (await res.json()) as {
    results?: { SEARCHVAL: string; ADDRESS: string; LATITUDE: string; LONGITUDE: string }[]
  }
  return (body.results ?? []).map((r) => ({
    label: r.SEARCHVAL,
    detail: r.ADDRESS,
    lat: Number(r.LATITUDE),
    lng: Number(r.LONGITUDE),
  }))
}

async function searchPhoton(query: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, limit: '8', bbox: '103.6,1.15,104.1,1.48' })
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal })
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`)
  const body = (await res.json()) as {
    features: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[]
  }
  return body.features.map(({ geometry, properties: p }) => ({
    label: p.name ?? [p.housenumber, p.street].filter(Boolean).join(' '),
    detail: [p.street, p.district, p.postcode].filter(Boolean).join(', '),
    lat: geometry.coordinates[1],
    lng: geometry.coordinates[0],
  }))
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  try {
    const results = await searchOneMap(query, signal)
    if (results.length > 0) return results.slice(0, 8)
  } catch (err) {
    if (signal?.aborted) throw err
  }
  return searchPhoton(query, signal)
}
