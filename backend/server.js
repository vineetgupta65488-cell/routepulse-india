import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';

const app = express();
const PORT = process.env.PORT || 10000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'delhi-gtfs.json');
const OTD_STATIC_URL = process.env.DELHI_GTFS_URL || 'https://otd.delhi.gov.in/data/static/';
const OTD_DOWNLOAD_URL = process.env.DELHI_GTFS_DOWNLOAD_URL || '';
const DOWNLOAD_TIMEOUT_MS = Number(process.env.GTFS_DOWNLOAD_TIMEOUT_MS || 30000);

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

let feed = null;
let loadError = null;

const norm = value => String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
const same = (a, b) => norm(a) === norm(b);
const contains = (a, q) => norm(a).includes(norm(q));

function readCsv(zip, name) {
  const entry = zip.getEntry(name);
  if (!entry) throw new Error(`GTFS file missing: ${name}`);
  return parse(entry.getData().toString('utf8').replace(/^\uFEFF/, ''), { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true });
}

function buildFeed(zip) {
  const agencies = readCsv(zip, 'agency.txt');
  const routes = readCsv(zip, 'routes.txt');
  const stops = readCsv(zip, 'stops.txt');
  const trips = readCsv(zip, 'trips.txt');
  const stopTimes = readCsv(zip, 'stop_times.txt');

  const stopMap = new Map(stops.map(s => [s.stop_id, { id: s.stop_id, name: s.stop_name, lat: s.stop_lat || null, lon: s.stop_lon || null }]));
  const routeMap = new Map(routes.map(r => [r.route_id, { route_id: r.route_id, route_number: r.route_short_name || null, route_name: r.route_long_name || null } ]));
  const agencyMap = new Map(agencies.map(a => [a.agency_id || '__default__', a.agency_name || null]));
  const timesByTrip = new Map();
  for (const st of stopTimes) {
    if (!timesByTrip.has(st.trip_id)) timesByTrip.set(st.trip_id, []);
    timesByTrip.get(st.trip_id).push(st);
  }

  const journeys = [];
  for (const t of trips) {
    const sts = (timesByTrip.get(t.trip_id) || []).sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    if (sts.length < 2) continue;
    const route = routeMap.get(t.route_id) || {};
    const stopsForTrip = sts.map(st => stopMap.get(st.stop_id)).filter(Boolean);
    if (stopsForTrip.length < 2) continue;
    journeys.push({
      trip_id: t.trip_id,
      route_id: t.route_id,
      route_number: route.route_number,
      route_name: route.route_name,
      agency_id: t.agency_id || '__default__',
      agency_name: agencyMap.get(t.agency_id || '__default__') || null,
      direction_id: t.direction_id || null,
      stops: stopsForTrip,
      stop_times: sts.slice(0, stopsForTrip.length).map(st => ({ arrival: st.arrival_time || null, departure: st.departure_time || null }))
    });
  }

  return {
    source: 'Delhi Open Transit Data GTFS',
    source_url: OTD_STATIC_URL,
    imported_at: new Date().toISOString(),
    counts: { agencies: agencies.length, routes: routes.length, stops: stops.length, trips: trips.length, stop_times: stopTimes.length, journeys: journeys.length },
    stops: [...stopMap.values()],
    journeys
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, redirect: 'follow', signal: controller.signal });
  } finally { clearTimeout(timer); }
}

async function downloadOfficialZip() {
  // The OTD site currently serves the static data through its Download Data flow.
  // If OTD exposes the direct ZIP URL as an environment variable, use it.
  // Otherwise fail closed rather than scraping a guessed/private endpoint.
  if (!OTD_DOWNLOAD_URL) {
    throw new Error('DELHI_GTFS_DOWNLOAD_URL is not configured. OTD requires access to its static-data download flow; no direct ZIP URL is assumed.');
  }
  const response = await fetchWithTimeout(OTD_DOWNLOAD_URL, {
    headers: { 'Accept': 'application/zip, application/octet-stream', 'User-Agent': 'RoutePulseIndia/1.0' }
  });
  if (!response.ok) throw new Error(`Official GTFS download returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('Official GTFS download was empty');
  return bytes;
}

async function loadGtfsAtStartup() {
  try {
    const zipBytes = await downloadOfficialZip();
    const nextFeed = buildFeed(new AdmZip(zipBytes));
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(nextFeed));
    feed = nextFeed;
    loadError = null;
    console.log(`Loaded official Delhi GTFS: ${nextFeed.counts.routes} routes, ${nextFeed.counts.stops} stops, ${nextFeed.counts.trips} trips.`);
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
    try {
      if (fs.existsSync(DATA_FILE)) {
        feed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        console.warn(`Official GTFS download failed; using cached dataset from ${feed.imported_at || 'unknown time'}: ${loadError}`);
      } else {
        feed = null;
        console.error(`Delhi GTFS unavailable: ${loadError}`);
      }
    } catch (cacheError) {
      feed = null;
      loadError = `${loadError}; cache read failed: ${cacheError.message}`;
      console.error(`Delhi GTFS unavailable: ${loadError}`);
    }
  }
}

app.get('/health', (_req, res) => {
  res.status(feed ? 200 : 503).json({ ok: Boolean(feed), service: 'routepulse-india-api', dataSource: feed?.source || 'Delhi Open Transit Data', importedAt: feed?.imported_at || null, counts: feed?.counts || null, refreshError: feed ? loadError : loadError });
});

app.get('/api/v1/health', (_req, res) => {
  res.status(feed ? 200 : 503).json({ ok: Boolean(feed), service: 'routepulse-india-api', dataSource: feed?.source || 'Delhi Open Transit Data', importedAt: feed?.imported_at || null, counts: feed?.counts || null, refreshError: feed ? loadError : loadError });
});

app.get('/api/v1/stops/search', (req, res) => {
  if (!feed) return res.status(503).json({ error: 'DELHI_GTFS_UNAVAILABLE', message: 'Delhi official GTFS dataset is unavailable. Try again after the backend data source is configured.' });
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const stops = feed.stops.filter(s => contains(s.name, q)).slice(0, limit);
  res.json({ status: 'ok', state: 'Delhi', query: q, stops });
});

app.get('/api/v1/journeys', (req, res) => {
  if (!feed) return res.status(503).json({ error: 'DELHI_GTFS_UNAVAILABLE', message: 'Delhi official GTFS dataset is unavailable. Try again after the backend data source is configured.' });
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  const journeys = feed.journeys.filter(j => {
    const a = j.stops.findIndex(s => same(s.name, from));
    const b = j.stops.findIndex(s => same(s.name, to));
    return a >= 0 && b > a;
  }).map(j => {
    const a = j.stops.findIndex(s => same(s.name, from));
    const b = j.stops.findIndex(s => same(s.name, to));
    return { type: 'direct', trip_id: j.trip_id, route_id: j.route_id, route_number: j.route_number, route_name: j.route_name, agency_id: j.agency_id, agency_name: j.agency_name, direction_id: j.direction_id, stops: j.stops.slice(a, b + 1), stop_times: j.stop_times.slice(a, b + 1) };
  });
  res.json({ status: journeys.length ? 'ok' : 'no_verified_journey', source: feed.source, from, to, journeys: journeys.slice(0, 50) });
});

await loadGtfsAtStartup();
app.listen(PORT, '0.0.0.0', () => console.log(`RoutePulse API listening on ${PORT}`));
