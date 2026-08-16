import express from 'express';
import cors from 'cors';
import JSZip from 'jszip';
import fetch from 'node-fetch';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || 'https://vineetgupta65488-cell.github.io').split(',').map(x => x.trim());
app.use(cors({ origin: (origin, cb) => (!origin || FRONTEND_ORIGIN.includes('*') || FRONTEND_ORIGIN.includes(origin)) ? cb(null, true) : cb(new Error('CORS origin not allowed')) }));
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(__dirname, 'data', 'delhi-gtfs.json');
const GTFS_URL = process.env.DELHI_GTFS_URL;
const db = { delhi: null };

function csv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && quoted && n === '"') { cell += '"'; i++; continue; }
    if (c === '"') { quoted = !quoted; continue; }
    if (c === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && n === '\n') i++;
      row.push(cell); if (row.some(v => v !== '')) rows.push(row);
      row = []; cell = ''; continue;
    }
    cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const header = rows.shift() || [];
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

async function parseZip(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const names = ['agency.txt','routes.txt','trips.txt','stops.txt','stop_times.txt','calendar.txt','calendar_dates.txt','fare_attributes.txt','fare_rules.txt'];
  const out = {};
  for (const name of names) if (zip.files[name]) out[name.replace('.txt','')] = csv(await zip.files[name].async('text'));
  return out;
}

function indexFeed(raw) {
  const feed = {
    ...raw,
    routes: raw.routes || [], stops: raw.stops || [], trips: raw.trips || [],
    stop_times: raw.stop_times || [], fare_attributes: raw.fare_attributes || [], fare_rules: raw.fare_rules || [],
  };
  feed.stopMap = Object.fromEntries(feed.stops.map(s => [s.stop_id, s]));
  feed.routeMap = Object.fromEntries(feed.routes.map(r => [r.route_id, r]));
  feed.tripMap = Object.fromEntries(feed.trips.map(t => [t.trip_id, t]));
  feed.fareById = Object.fromEntries(feed.fare_attributes.map(f => [f.fare_id, f]));
  feed.stopTimesByTrip = {};
  for (const st of feed.stop_times) (feed.stopTimesByTrip[st.trip_id] ||= []).push(st);
  for (const list of Object.values(feed.stopTimesByTrip)) list.sort((a,b) => Number(a.stop_sequence)-Number(b.stop_sequence));
  return feed;
}

async function loadCache() {
  try { return indexFeed(JSON.parse(await fs.readFile(CACHE, 'utf8'))); } catch { return null; }
}

async function ingestFromUrl() {
  if (!GTFS_URL) return null;
  const response = await fetch(GTFS_URL);
  if (!response.ok) throw new Error(`Delhi GTFS download failed: HTTP ${response.status}`);
  const feed = await parseZip(await response.arrayBuffer());
  feed.imported_at = new Date().toISOString();
  await fs.mkdir(path.dirname(CACHE), { recursive: true });
  await fs.writeFile(CACHE, JSON.stringify(feed));
  return indexFeed(feed);
}

async function ensureFeed() {
  if (db.delhi) return db.delhi;
  db.delhi = await loadCache();
  if (!db.delhi && GTFS_URL) db.delhi = await ingestFromUrl();
  return db.delhi;
}

function stopMatches(feed, query) {
  const q = query.toLowerCase().trim();
  return feed.stops.filter(s => (s.stop_name || '').toLowerCase().includes(q)).slice(0, 20);
}
function fareFor(feed, routeId) {
  const rule = feed.fare_rules.find(x => x.route_id === routeId);
  const fare = rule && feed.fareById[rule.fare_id];
  return fare?.price || null;
}
function durationMinutes(a, b) {
  if (!a || !b) return null;
  const mins = t => { const p = t.split(':').map(Number); return p[0]*60 + p[1] + (p[2]||0)/60; };
  let d = mins(b) - mins(a); if (d < 0) d += 24*60; return Math.round(d);
}

function directJourneys(feed, from, to) {
  const fromIds = new Set(stopMatches(feed, from).map(s => s.stop_id));
  const toIds = new Set(stopMatches(feed, to).map(s => s.stop_id));
  if (!fromIds.size || !toIds.size) return [];
  const results = [];
  for (const [tripId, times] of Object.entries(feed.stopTimesByTrip)) {
    let a = -1, b = -1;
    for (let i = 0; i < times.length; i++) {
      if (a < 0 && fromIds.has(times[i].stop_id)) a = i;
      if (a >= 0 && toIds.has(times[i].stop_id)) { b = i; break; }
    }
    if (a < 0 || b <= a) continue;
    const trip = feed.tripMap[tripId], route = trip && feed.routeMap[trip.route_id];
    if (!route) continue;
    const slice = times.slice(a, b + 1);
    results.push({
      type: 'direct',
      route_id: route.route_id,
      route_number: route.route_short_name || null,
      route_name: route.route_long_name || null,
      operator: route.agency_id || null,
      fare_rupees: fareFor(feed, route.route_id),
      estimated_minutes: durationMinutes(slice[0]?.departure_time, slice[slice.length-1]?.arrival_time),
      stops: slice.map(st => ({ id: st.stop_id, name: feed.stopMap[st.stop_id]?.stop_name || st.stop_id, arrival: st.arrival_time || null, departure: st.departure_time || null }))
    });
    if (results.length >= 20) break;
  }
  return results;
}

app.get('/health', async (_req, res) => {
  const feed = await ensureFeed().catch(() => null);
  res.json({ ok: true, state: 'Delhi', feedLoaded: !!feed, routes: feed?.routes.length || 0, stops: feed?.stops.length || 0, importedAt: feed?.imported_at || null });
});

app.get('/api/v1/stops/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });
  const feed = await ensureFeed().catch(e => ({ error: e.message }));
  if (!feed || feed.error) return res.status(503).json({ status: 'feed_unavailable', message: feed?.error || 'Delhi GTFS feed is not loaded', stops: [] });
  res.json({ status: 'ok', stops: stopMatches(feed, q).map(s => ({ id: s.stop_id, name: s.stop_name, lat: s.stop_lat, lon: s.stop_lon })) });
});

app.get('/api/v1/journeys', async (req, res) => {
  const from = String(req.query.from || '').trim(), to = String(req.query.to || '').trim();
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  const feed = await ensureFeed().catch(e => ({ error: e.message }));
  if (!feed || feed.error) return res.status(503).json({ status: 'feed_unavailable', message: feed?.error || 'Delhi GTFS feed is not loaded', journeys: [] });
  const journeys = directJourneys(feed, from, to);
  res.json({ status: journeys.length ? 'ok' : 'no_verified_journey', source: 'Delhi Open Transit Data GTFS', from, to, journeys });
});

app.post('/admin/feeds/delhi/refresh', async (_req, res) => {
  try {
    if (!GTFS_URL) return res.status(400).json({ error: 'DELHI_GTFS_URL is not configured' });
    db.delhi = await ingestFromUrl();
    res.json({ ok: true, routes: db.delhi.routes.length, stops: db.delhi.stops.length, trips: db.delhi.trips.length, stop_times: db.delhi.stop_times.length, importedAt: db.delhi.imported_at });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`RoutePulse Delhi API listening on ${PORT}`));
