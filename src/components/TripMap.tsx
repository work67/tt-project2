import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng } from '../lib/geo'
import type { Trip } from '../lib/planner'

const SINGAPORE: [number, number] = [1.3521, 103.8198]
const LEG_COLORS = ['#2563eb', '#db2777']

type Props = { from: LatLng | null; to: LatLng | null; trip: Trip | undefined }

const pt = (p: LatLng): [number, number] => [p.lat, p.lng]

function FitToContent({ points }: { points: LatLng[] }) {
  const map = useMap()
  const key = points.map((p) => `${p.lat},${p.lng}`).join('|')
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) map.setView(pt(points[0]), 16)
    else map.fitBounds(latLngBounds(points.map(pt)), { padding: [32, 32] })
    // Refit only when the set of points changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

export function TripMap({ from, to, trip }: Props) {
  const points = [from, to, ...(trip?.legs.flatMap((l) => l.path) ?? [])].filter((p): p is LatLng => p !== null)
  const first = trip?.legs[0]
  const last = trip?.legs[trip.legs.length - 1]

  return (
    <MapContainer center={SINGAPORE} zoom={12} className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToContent points={points} />

      {from && first && <Polyline positions={[pt(from), pt(first.board)]} pathOptions={{ color: '#555', dashArray: '6 8', weight: 3 }} />}
      {to && last && <Polyline positions={[pt(last.alight), pt(to)]} pathOptions={{ color: '#555', dashArray: '6 8', weight: 3 }} />}

      {trip?.legs.map((leg, i) => (
        <Polyline key={i} positions={leg.path.map(pt)} pathOptions={{ color: LEG_COLORS[i % LEG_COLORS.length], weight: 5 }} />
      ))}
      {trip?.legs.map((leg, i) => (
        <CircleMarker key={`board-${i}`} center={pt(leg.board)} radius={7} pathOptions={{ color: LEG_COLORS[i % LEG_COLORS.length], fillOpacity: 1, fillColor: '#fff', weight: 3 }}>
          <Tooltip direction="top" permanent={i === 0}>
            {i === 0 ? 'Board' : 'Change to'} {leg.service} · {leg.board.name}
          </Tooltip>
        </CircleMarker>
      ))}
      {last && (
        <CircleMarker center={pt(last.alight)} radius={7} pathOptions={{ color: LEG_COLORS[(trip!.legs.length - 1) % LEG_COLORS.length], fillOpacity: 1, fillColor: '#fff', weight: 3 }}>
          <Tooltip direction="top">Alight · {last.alight.name}</Tooltip>
        </CircleMarker>
      )}

      {from && (
        <CircleMarker center={pt(from)} radius={8} pathOptions={{ color: '#fff', fillColor: '#16a34a', fillOpacity: 1, weight: 2 }}>
          <Tooltip>Start</Tooltip>
        </CircleMarker>
      )}
      {to && (
        <CircleMarker center={pt(to)} radius={8} pathOptions={{ color: '#fff', fillColor: '#dc2626', fillOpacity: 1, weight: 2 }}>
          <Tooltip>Destination</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  )
}
