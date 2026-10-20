# Bus There

Pick a start (or use GPS) and a destination in Singapore; the app finds the fastest bus trip
(direct, or with one transfer at the same stop), shows the walk to the boarding stop, and the
live arrival times of the bus you need.

```sh
npm install
npm run dev         # http://localhost:5173
npm test            # planner unit tests
npm run fetch-data  # refresh the bus network snapshot in public/data
```

## How it works

- **Bus network** — `public/data/*.min.json` is a snapshot of [busrouter.sg](https://busrouter.sg)'s
  static data (from [sgbusdata](https://github.com/cheeaun/sgbusdata)).
- **Routing** (`src/lib/planner.ts`) — considers every stop within 400 m of start and end and ranks trips by
  estimated total time: walk (1.4 m/s) + wait + ride (stop-to-stop distance at 18 km/h) + 5 min per transfer + walk.
  The wait starts as an assumed 5 min and is replaced by the live arrival once fetched.
- **Live arrivals** (`src/lib/arrivals.ts`) — [arrivelah](https://github.com/cheeaun/arrivelah), the CORS-enabled
  LTA DataMall proxy busrouter.sg uses. It is a free hobby service; swap in your own proxy with a DataMall key if needed.
- **Place search** (`src/lib/geocode.ts`) — OneMap, falling back to Photon (OpenStreetMap).

Data © LTA · OneMap · © OpenStreetMap contributors. Non-commercial learning project.
