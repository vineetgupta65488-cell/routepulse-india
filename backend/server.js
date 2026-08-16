import express from 'express';
import cors from 'cors';
import fs from 'node:fs';

const app = express();
const PORT = process.env.PORT || 10000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const DATA_FILE = new URL('./data/delhi-gtfs.json', import.meta.url);

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

let feed = null;
try {
  feed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch {
  feed = null;
}

const norm = value => String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
const same = (a,b) => norm(a) === norm(b);
const contains = (a,q) => norm(a).includes(norm(q));

app.get('/health', (_req, res) => {
  res.status(feed ? 200 : 503).json({
    ok: Boolean(feed),
    service: 'routepulse-india-api',
    dataSource: feed?.source || 'Delhi Open Transit Data',
    importedAt: feed?.imported_at || null,
    counts: feed?.counts || null
  });
});

app.get('/api/v1/health', (_req, res) => {
  res.status(feed ? 200 : 503).json({
    ok: Boolean(feed),
    service: 'routepulse-india-api',
    dataSource: feed?.source || 'Delhi Open Transit Data',
    importedAt: feed?.imported_at || null,
    counts: feed?.counts || null
  });
});

app.get('/api/v1/stops/search', (req, res) => {
  if (!feed) return res.status(503).json({ error: 'Delhi GTFS dataset is not imported' });
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const stops = feed.stops.filter(s => contains(s.name, q)).slice(0, limit);
  res.json({ status: 'ok', state: 'Delhi', query: q, stops });
});

app.get('/api/v1/journeys', (req, res) => {
  if (!feed) return res.status(503).json({ error: 'Delhi GTFS dataset is not imported' });
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
    return {
      type: 'direct',
      trip_id: j.trip_id,
      route_id: j.route_id,
      route_number: j.route_number,
      route_name: j.route_name,
      agency_id: j.agency_id,
      direction_id: j.direction_id,
      stops: j.stops.slice(a, b + 1),
      stop_times: j.stop_times.slice(a, b + 1)
    };
  });

  res.json({ status: journeys.length ? 'ok' : 'no_verified_journey', source: feed.source, from, to, journeys: journeys.slice(0, 50) });
});

app.listen(PORT, '0.0.0.0', () => console.log(`RoutePulse API listening on ${PORT}`));
