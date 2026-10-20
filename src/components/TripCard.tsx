import { catchableBuses, LOAD_LABEL, minutesUntil, msUntil, TYPE_LABEL, type Arrival } from '../lib/arrivals'
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
  now: number
}

const mins = (m: number) => `${Math.round(m)} min`
const clockTime = (a: Arrival) => new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** mm:ss, or h:mm:ss from an hour up. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${String(m).padStart(2, '0')}:${s}`
}

type BusInfo = { arrivals: Arrival[]; walkMin: number; now: number }

function Countdown({ arrivals, walkMin, now, service, stopName }: BusInfo & { service: string; stopName: string }) {
  const { bus, following, missed } = catchableBuses(arrivals, walkMin, now)
  if (!bus) {
    return <p className="countdown-none">None of the listed {service} buses can be reached in time. Check back shortly.</p>
  }
  const untilBus = msUntil(bus, now)
  const untilLeave = untilBus - walkMin * 60_000
  return (
    <div className="countdown" role="timer" aria-label={`Bus ${service} leaves ${stopName} in ${formatCountdown(untilBus)}`}>
      <small>
        Bus {service} leaves {stopName} at {clockTime(bus)}
      </small>
      <div className="countdown-clock" aria-hidden="true">
        {formatCountdown(untilBus)}
      </div>
      <p className={`countdown-walk ${untilLeave < 60_000 ? 'urgent' : ''}`}>
        {untilLeave < 60_000 ? 'Start walking now' : `Start walking in ${formatCountdown(untilLeave)}`}
      </p>
      {missed > 0 && (
        <small>
          {missed === 1 ? 'The bus before it leaves' : `${missed} earlier buses leave`} before you can reach the stop.
        </small>
      )}
      <p className="countdown-next">
        {following ? (
          <>
            Next bus after that: <strong>{clockTime(following)}</strong> (in {mins(minutesUntil(following, now))})
          </>
        ) : (
          'No later bus listed yet'
        )}
      </p>
    </div>
  )
}

function ArrivalList({ arrivals, walkMin, now }: BusInfo) {
  const { bus } = catchableBuses(arrivals, walkMin, now)
  return (
    <ul className="arrivals">
      {arrivals.map((a) => {
        const m = Math.round(minutesUntil(a, now))
        const state = a === bus ? 'catch' : msUntil(a, now) < walkMin * 60_000 ? 'missed' : ''
        return (
          <li key={a.time} className={`load-${a.load} ${state}`}>
            <strong>{m === 0 ? 'Arr' : `${m} min`}</strong>
            <small>
              {clockTime(a)}
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

function LiveBuses({ arrivals, error, ...info }: Omit<BusInfo, 'arrivals'> & { arrivals: Arrival[] | undefined; error: string | undefined; service: string; stopName: string }) {
  if (error) return <p className="arrivals muted">Live times unavailable ({error})</p>
  if (!arrivals) return <p className="arrivals muted">Loading live times…</p>
  if (arrivals.length === 0) return <p className="arrivals muted">No buses currently scheduled</p>
  return (
    <>
      <Countdown arrivals={arrivals} {...info} />
      <ArrivalList arrivals={arrivals} walkMin={info.walkMin} now={info.now} />
    </>
  )
}

export function TripCard({ trip, from, selected, onSelect, arrivals, arrivalsError, now }: Props) {
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
            <div className="step-grow">
              <LiveBuses
                arrivals={arrivals}
                error={arrivalsError}
                walkMin={trip.walkToBoardMin}
                now={now}
                service={first.service}
                stopName={first.board.name}
              />
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
