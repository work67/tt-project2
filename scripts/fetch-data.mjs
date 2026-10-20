// Snapshots the static bus data from busrouter.sg (built from github.com/cheeaun/sgbusdata)
// into public/data so the app does not depend on that host at runtime.
// Run with: npm run fetch-data
import { mkdir, writeFile } from 'node:fs/promises'

const BASE = 'https://data.busrouter.sg/v1/'
const FILES = ['stops.min.json', 'services.min.json']
const OUT_DIR = new URL('../public/data/', import.meta.url)

await mkdir(OUT_DIR, { recursive: true })
for (const file of FILES) {
  const res = await fetch(BASE + file)
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)
  const body = await res.text()
  JSON.parse(body) // fail loudly on a truncated download
  await writeFile(new URL(file, OUT_DIR), body)
  console.log(`saved ${file} (${Math.round(body.length / 1024)} KB)`)
}
