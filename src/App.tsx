import { useEffect, useState } from 'react'
import { PlaceSearch } from './components/PlaceSearch'
import { TripCard } from './components/TripCard'
import { TripMap } from './components/TripMap'
import { fetchArrivals, MIN_POLL_MS, minutesUntil, upcomingBuses, type ServiceArrivals } from './lib/arrivals'
import { loadBusData, type BusData } from './lib/busData'
import type { Place } from './lib/geocode'
import { applyLiveWaits, planTrips, walkingOnlyMinutes, type Trip } from './lib/planner'
import './App.css'

const POLL_MS = Math.max(MIN_POLL_MS, 30_000)

type StopArrivals = { services?: ServiceArrivals[]; error?: string }

const tripKey = (trip: Trip) => trip.legs.map((l) => `${l.service}@${l.board.code}`).join('>')

function App() {
  const [data, setData] = useState<BusData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [from, setFrom] = useState<Place | null>(null)
  const [to, setTo] = useState<Place | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [arrivals, setArrivals] = useState<Record<string, StopArrivals>>({})

  useEffect(() => {
    loadBusData()
      .then(setData)
      .catch((err: unknown) => setLoadError((err as Error).message))
  }, [])

  const planned = data && from && to ? planTrips(data, from, to) : []
  const boardStops = [...new Set(planned.map((t) => t.legs[0].board.code))]
  const boardStopsKey = boardStops.join(',')

  useEffect(() => {
    if (!boardStopsKey) return
    const controller = new AbortController()
    const refresh = () => {
      for (const code of boardStopsKey.split(',')) {
        fetchArrivals(code, controller.signal)
          .then((services) => setArrivals((prev) => ({ ...prev, [code]: { services } })))
          .catch((err: unknown) => {
            if (!controller.signal.aborted) setArrivals((prev) => ({ ...prev, [code]: { error: (err as Error).message } }))
          })
      }
    }
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [boardStopsKey])

  const busesFor = (trip: Trip) => {
    const leg = trip.legs[0]
    const services = arrivals[leg.board.code]?.services
    return services && upcomingBuses(services, leg.service, leg.pattern.destination)
  }

  const trips = applyLiveWaits(planned, (_stop, leg) => {
    const services = arrivals[leg.board.code]?.services
    if (!services) return undefined
    const [next] = upcomingBuses(services, leg.service, leg.pattern.destination)
    // No upcoming bus listed means the service is not running now; push it down the list.
    return next ? minutesUntil(next) : 999
  })
  const selected = trips.find((t) => tripKey(t) === selectedKey) ?? trips[0]
  const walkMin = from && to ? walkingOnlyMinutes(from, to) : Infinity

  return (
    <div className="app">
      <aside className="panel">
        <header>
          <h1>Bus There</h1>
          <p className="tagline">Fastest Singapore bus from A to B, with live arrivals.</p>
        </header>

        <PlaceSearch label="From" placeholder="Address, postal code or place" value={from} onChange={setFrom} allowGps />
        <PlaceSearch label="To" placeholder="Where to?" value={to} onChange={setTo} />

        {loadError && <p className="error">Could not load bus data: {loadError}</p>}
        {!data && !loadError && <p className="muted">Loading bus network…</p>}

        {data && from && to && (
          <section className="results">
            {walkMin < 15 && <p className="hint">It's only about {Math.round(walkMin)} min on foot.</p>}
            {trips.length === 0 ? (
              <p className="muted">No bus route found with at most one transfer. Try a nearby landmark.</p>
            ) : (
              <ul className="trip-list">
                {trips.map((trip) => (
                  <TripCard
                    key={tripKey(trip)}
                    trip={trip}
                    from={from}
                    selected={trip === selected}
                    onSelect={() => setSelectedKey(tripKey(trip))}
                    arrivals={busesFor(trip)}
                    arrivalsError={arrivals[trip.legs[0].board.code]?.error}
                  />
                ))}
              </ul>
            )}
          </section>
        )}

        <footer>
          Data © LTA · Static data & arrivals via{' '}
          <a href="https://busrouter.sg" target="_blank" rel="noreferrer">
            busrouter.sg
          </a>{' '}
          · Search © OneMap / Photon · Map © OpenStreetMap contributors. Times are estimates.
        </footer>
      </aside>

      <main className="map-wrap">
        <TripMap from={from} to={to} trip={selected} />
      </main>
    </div>
  )
}

export default App
