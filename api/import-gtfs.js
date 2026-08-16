import fs from 'node:fs/promises';
import JSZip from 'jszip';
import fetch from 'node-fetch';

const url = process.argv[2] || process.env.DELHI_GTFS_URL;
if (!url) throw new Error('Provide the official Delhi GTFS ZIP URL as the first argument or DELHI_GTFS_URL.');
function csv(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&q&&n==='"'){cell+='"';i++;continue}if(c==='"'){q=!q;continue}if(c===','&&!q){row.push(cell);cell='';continue}if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';continue}cell+=c}if(cell||row.length){row.push(cell);rows.push(row)}const h=rows.shift()||[];return rows.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??''])))}
const response=await fetch(url);if(!response.ok)throw new Error(`GTFS download failed: HTTP ${response.status}`);
const zip=await JSZip.loadAsync(await response.arrayBuffer());
const files=['agency.txt','routes.txt','trips.txt','stops.txt','stop_times.txt','calendar.txt','calendar_dates.txt','fare_attributes.txt','fare_rules.txt'];
const data={};
for(const file of files)if(zip.files[file])data[file.replace('.txt','')]=csv(await zip.files[file].async('text'));
data.imported_at=new Date().toISOString();
await fs.mkdir('api/data',{recursive:true});
await fs.writeFile('api/data/delhi-gtfs.json',JSON.stringify(data));
console.log(JSON.stringify({ok:true,imported_at:data.imported_at,routes:data.routes?.length||0,stops:data.stops?.length||0,trips:data.trips?.length||0,stop_times:data.stop_times?.length||0}));
