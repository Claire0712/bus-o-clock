import { requireValue } from './validation.js';

export function normaliseQuery(value) { return String(value ?? '').normalize('NFKC').trim().toUpperCase().replace(/\s+/g, ' '); }
export function isRouteQuery(value) { return /^(?=.*\d)[A-Z0-9]{1,12}$/.test(normaliseQuery(value)); }

export function searchStopCatalogue(stops, query, { associations = [], routes = [], limit = 40 } = {}) {
  const q = normaliseQuery(query);
  requireValue(q.length > 0 && q.length <= 100 && Number.isInteger(limit) && limit > 0 && limit <= 10000, 'Invalid stop search.');
  const byRoute = isRouteQuery(q);
  const boardable = new Map(), services = [];
  if (byRoute) {
    const rows = associations.filter(r => r.route === q);
    const key = r => `${r.bound}:${r.service_type}`;
    const last = new Map();
    for (const r of rows) last.set(key(r), Math.max(last.get(key(r)) ?? 0, Number(r.seq)));
    const stopById = new Map(stops.map(s => [s.id, s]));
    for (const serviceKey of last.keys()) {
      const serviceRows = rows.filter(r => key(r) === serviceKey).sort((a,b) => Number(a.seq)-Number(b.seq));
      const first = serviceRows[0];
      const metadata = routes.find(r => r.route === q && key(r) === serviceKey);
      const name = prefix => Object.fromEntries(['en','tc','sc'].map(lang => [lang,metadata?.[`${prefix}_${lang}`] ?? '']));
      const ordered = serviceRows.filter(r => Number(r.seq) < last.get(serviceKey) && stopById.has(r.stop))
        .map(r => ({...stopById.get(r.stop),stopSequence:Number(r.seq)}));
      if (ordered.length) services.push({key:serviceKey,route:q,direction:first.bound,serviceType:String(first.service_type),origin:name('orig'),destination:name('dest'),stops:ordered});
    }
    services.sort((a,b) => a.direction.localeCompare(b.direction) || a.serviceType.localeCompare(b.serviceType,'en',{numeric:true}));
    for (const r of rows) if (Number(r.seq) < last.get(key(r))) boardable.set(r.stop, Math.min(boardable.get(r.stop) ?? Infinity, Number(r.seq)));
  }
  const matches = stops.filter(s => byRoute ? boardable.has(s.id) : Object.values(s.name).some(n => normaliseQuery(n).includes(q)))
    .sort((a,b) => byRoute ? boardable.get(a.id)-boardable.get(b.id) || a.id.localeCompare(b.id)
      : Number(!Object.values(a.name).some(n => normaliseQuery(n) === q))-Number(!Object.values(b.name).some(n => normaliseQuery(n) === q)) || a.name.en.localeCompare(b.name.en));
  return { services, stops: matches.slice(0,limit), total:matches.length, routeFilter:byRoute ? q : null, query:q };
}
