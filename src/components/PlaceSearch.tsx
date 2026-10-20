import { useEffect, useState } from 'react'
import { searchPlaces, type Place } from '../lib/geocode'

type Props = {
  label: string
  placeholder: string
  value: Place | null
  onChange: (place: Place | null) => void
  allowGps?: boolean
}

const MIN_QUERY = 3
const DEBOUNCE_MS = 350

export function PlaceSearch({ label, placeholder, value, onChange, allowGps }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (query.trim().length < MIN_QUERY) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlaces(query.trim(), controller.signal)
        .then((places) => {
          setResults(places)
          setStatus(places.length === 0 ? 'No matches' : null)
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setStatus(`Search failed: ${(err as Error).message}`)
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function pick(place: Place) {
    onChange(place)
    setQuery('')
    setResults([])
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus('Location is not available in this browser')
      return
    }
    setStatus('Finding you…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setStatus(null)
        pick({ label: 'My location', detail: `±${Math.round(coords.accuracy)} m`, lat: coords.latitude, lng: coords.longitude })
      },
      (err) => setStatus(`Could not get location: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const showResults = query.trim().length >= MIN_QUERY

  return (
    <div className="place-search">
      <label className="place-label">{label}</label>
      {value ? (
        <div className="place-chosen">
          <div>
            <strong>{value.label}</strong>
            <small>{value.detail}</small>
          </div>
          <button type="button" className="link-button" onClick={() => onChange(null)}>
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="place-input-row">
            <input
              type="search"
              value={query}
              placeholder={placeholder}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={label}
            />
            {allowGps && (
              <button type="button" className="gps-button" onClick={useMyLocation} title="Use my location">
                ◎
              </button>
            )}
          </div>
          {showResults && results.length > 0 && (
            <ul className="place-results">
              {results.map((place) => (
                <li key={`${place.lat},${place.lng},${place.label}`}>
                  <button type="button" onClick={() => pick(place)}>
                    <strong>{place.label}</strong>
                    <small>{place.detail}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {status && <p className="place-status">{status}</p>}
        </>
      )}
    </div>
  )
}
