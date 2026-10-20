import { LOAD_LABEL, minutesUntil, TYPE_LABEL, type Arrival } from '../lib/arrivals'
import { googleWalkingLink, type LatLng } from '../lib/geo'
import type { Trip } from '../lib/planner'

type Props = {
  trip: Trip
  from: LatLng
  selected: boolean
  onSelect: () => void
  /** Upcoming buses for the first leg at the boarding stop, if fetched. */
  arrivals: Arrival[] | undefined
  arrivalsError: string | undefined
}

const mins = (m: number) => `${Math.round(m)} min`

function ArrivalList({ arrivals, error }: { arrivals: Arrival[] | undefined; error: string | undefined }) {
  if (error) return <p className="arrivals muted">Live times unavailable ({error})</p>
  if (!arrivals) return <p className="arrivals muted">Loading live times…</p>
  if (arrivals.length === 0) return <p className="arrivals muted">No buses currently scheduled</p>
  return (
    <ul className="arrivals">
      {arrivals.map((a) => {
        const m = Math.round(minutesUntil(a))
        return (
          <li key={a.time} className={`load-${a.load}`}>
            <strong>{m === 0 ? 'Arr' : `${m} min`}</strong>
            <small>
              {new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' · '}
              {LOAD_LABEL[a.load] ?? a.load}
              {' · '}
              {TYPE_LABEL[a.type] ?? a.type}
              {a.monitored ? '' : ' · scheduled'}
            </small>
          </li>
        )
      })}
    </ul>
  )
}

export function TripCard({ trip, from, selected, onSelect, arrivals, arrivalsError }: Props) {
  const [first] = trip.legs
  return (
    <li className={`trip ${selected ? 'selected' : ''}`}>
      <button type="button" className="trip-summary" onClick={onSelect} aria-expanded={selected}>
        <span className="trip-services">
          {trip.legs.map((leg, i) => (
            <span key={i}>
              {i > 0 && <span className="arrow">›</span>}
              <span className={`badge leg-${i}`}>{leg.service}</span>
            </span>
          ))}
        </span>
        <span className="trip-total">
          {mins(trip.totalMin)}
          {!trip.waitIsLive && <small title="Using an assumed wait until live times load">est.</small>}
        </span>
      </button>

      {selected && (
        <ol className="trip-steps">
          <li>
            <span className="step-icon">🚶</span>
            <div>
              Walk {mins(trip.walkToBoardMin)} to <strong>{first.board.name}</strong>
              <small>
                Stop {first.board.code} · {first.board.road}
              </small>
              <a href={googleWalkingLink(from, first.board)} target="_blank" rel="noreferrer">
                Walking directions ↗
              </a>
            </div>
          </li>
          <li>
            <span className="step-icon">⏱</span>
            <div>
              Bus <strong>{first.service}</strong> arrives
              <ArrivalList arrivals={arrivals} error={arrivalsError} />
            </div>
          </li>
          {trip.legs.map((leg, i) => (
            <li key={i}>
              <span className="step-icon">🚌</span>
              <div>
                {i > 0 && <>Change to bus </>}
                {i === 0 && <>Ride </>}
                <strong>{leg.service}</strong> for {leg.path.length - 1} stops (~{mins(leg.rideMin)})
                <small>
                  Alight at {leg.alight.name} ({leg.alight.code})
                </small>
              </div>
            </li>
          ))}
          <li>
            <span className="step-icon">🏁</span>
            <div>Walk {mins(trip.walkFromAlightMin)} to your destination</div>
          </li>
        </ol>
      )}
    </li>
  )
}
