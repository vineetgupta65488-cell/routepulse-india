import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';

const zipPath = process.argv[2] || process.env.DELHI_GTFS_ZIP;
if (!zipPath) throw new Error('Provide the official Delhi GTFS ZIP path as the first argument or DELHI_GTFS_ZIP.');

const required = ['agency.txt','routes.txt','stops.txt','trips.txt','stop_times.txt'];
const zip = new AdmZip(zipPath);
const names = new Set(zip.getEntries().map(e => path.basename(e.entryName)));
for (const file of required) if (!names.has(file)) throw new Error(`GTFS ZIP is missing ${file}`);

function readCsv(file) {
  const entry = zip.getEntries().find(e => path.basename(e.entryName) === file);
  return parse(entry.getData().toString('utf8').replace(/^\uFEFF/, ''), { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true });
}

const agencies = readCsv('agency.txt');
const routesRaw = readCsv('routes.txt');
const stopsRaw = readCsv('stops.txt');
const tripsRaw = readCsv('trips.txt');
const stopTimesRaw = readCsv('stop_times.txt');

const stopById = new Map(stopsRaw.map(s => [s.stop_id, { id: s.stop_id, name: s.stop_name, lat: s.stop_lat || null, lon: s.stop_lon || null }]));
const routeById = new Map(routesRaw.map(r => [r.route_id, r]));
const tripById = new Map(tripsRaw.map(t => [t.trip_id, t]));
const grouped = new Map();
for (const st of stopTimesRaw) {
  const trip = tripById.get(st.trip_id);
  if (!trip) continue;
  const key = st.trip_id;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(st);
}

const journeys = [];
for (const [tripId, rows] of grouped) {
  rows.sort((a,b) => Number(a.stop_sequence || 0) - Number(b.stop_sequence || 0));
  const trip = tripById.get(tripId);
  const route = routeById.get(trip.route_id);
  if (!route) continue;
  const stops = rows.map(st => stopById.get(st.stop_id)).filter(Boolean);
  if (stops.length < 2) continue;
  journeys.push({
    trip_id: tripId,
    route_id: route.route_id,
    route_number: route.route_short_name || null,
    route_name: route.route_long_name || null,
    agency_id: route.agency_id || agencies[0]?.agency_id || null,
    direction_id: trip.direction_id ?? null,
    stops,
    stop_times: rows.map(st => ({ stop_id: st.stop_id, arrival: st.arrival_time || null, departure: st.departure_time || null, sequence: Number(st.stop_sequence || 0) }))
  });
}

const out = {
  source: 'Delhi Open Transit Data',
  source_url: 'https://otd.delhi.gov.in/data/static/',
  imported_at: new Date().toISOString(),
  counts: { agencies: agencies.length, routes: routesRaw.length, stops: stopsRaw.length, trips: tripsRaw.length, stop_times: stopTimesRaw.length, journeys: journeys.length },
  agencies,
  stops: [...stopById.values()],
  journeys
};
await fs.mkdir('data', { recursive: true });
await fs.writeFile('data/delhi-gtfs.json', JSON.stringify(out));
console.log(JSON.stringify(out.counts, null, 2));
