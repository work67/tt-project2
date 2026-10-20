export type LatLng = { lat: number; lng: number }

const EARTH_RADIUS_M = 6_371_000
/** Walking speed busrouter.sg uses for its walk estimates. */
export const WALK_SPEED_MPS = 1.4

export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function walkMinutes(meters: number): number {
  return meters / WALK_SPEED_MPS / 60
}

export function googleWalkingLink(from: LatLng, to: LatLng): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: 'walking',
  })
  return `https://www.google.com/maps/dir/?${params}`
}
