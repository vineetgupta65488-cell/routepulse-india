import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 10000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

// Data adapter: replace this in the next step with the official Delhi GTFS feed.
const routes = [];

app.get('/api/v1/health', (_req, res) => {
  res.json({ ok: true, service: 'routepulse-india-api', dataSource: 'pending-official-feed-import' });
});

app.get('/api/v1/journeys', (req, res) => {
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

  const matches = routes.filter(r => {
    const a = r.stops.findIndex(s => s.toLowerCase() === from.toLowerCase());
    const b = r.stops.findIndex(s => s.toLowerCase() === to.toLowerCase());
    return a >= 0 && b > a;
  });

  res.json({ from, to, journeys: matches });
});

app.listen(PORT, '0.0.0.0', () => console.log(`RoutePulse API listening on ${PORT}`));
