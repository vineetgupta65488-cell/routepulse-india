import fs from 'node:fs/promises';
import JSZip from 'jszip';
import fetch from 'node-fetch';

const url = process.argv[2] || process.env.DELHI_GTFS_URL;
if (!url) throw new Error('Provide the official Delhi GTFS ZIP URL as the first argument or DELHI_GTFS_URL.');

const response = await fetch(url);
if (!response.ok) throw new Error(`GTFS download failed: HTTP ${response.status}`);
const zip = await JSZip.loadAsync(await response.arrayBuffer());
const wanted = ['agency.txt','routes.txt','trips.txt','stops.txt','stop_times.txt','calendar.txt','calendar_dates.txt','fare_attributes.txt','fare_rules.txt'];
const data = {};
for (const file of wanted) if (zip.files[file]) data[file.replace('.txt','')] = await zip.files[file].async('text');
data.imported_at = new Date().toISOString();
await fs.mkdir('api/data', { recursive: true });
await fs.writeFile('api/data/delhi-gtfs-raw.json', JSON.stringify(data));
console.log('Imported official Delhi GTFS files:', Object.keys(data).filter(k => k !== 'imported_at').join(', '));
