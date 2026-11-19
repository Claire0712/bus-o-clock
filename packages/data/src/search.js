import { requireValue } from './validation.js';

export function normaliseQuery(value) { return String(value ?? '').normalize('NFKC').trim().toUpperCase().replace(/\s+/g, ' '); }
export function isRouteQuery(value) { return /^(?=.*\d)[A-Z0-9]{1,12}$/.test(normaliseQuery(value)); }

export function searchStopCatalogue(stops, query, { associations = [], limit = 40 } = {}) {
  const q = normaliseQuery(query);
  requireValue(q.length > 0 && q.length <= 100 && Number.isInteger(limit) && limit > 0 && limit <= 100, 'Invalid stop search.');
  const byRoute = isRouteQuery(q);
  const boardable = new Map();
  if (byRoute) {
    const rows = associations.filter(r => r.route === q);
    const key = r => `${r.bound}:${r.service_type}`;
    const last = new Map();
    for (const r of rows) last.set(key(r), Math.max(last.get(key(r)) ?? 0, Number(r.seq)));
    for (const r of rows) if (Number(r.seq) < last.get(key(r))) boardable.set(r.stop, Math.min(boardable.get(r.stop) ?? Infinity, Number(r.seq)));
  }
  const matches = stops.filter(s => byRoute ? boardable.has(s.id) : Object.values(s.name).some(n => normaliseQuery(n).includes(q)))
    .sort((a,b) => byRoute ? boardable.get(a.id)-boardable.get(b.id) || a.id.localeCompare(b.id)
      : Number(!Object.values(a.name).some(n => normaliseQuery(n) === q))-Number(!Object.values(b.name).some(n => normaliseQuery(n) === q)) || a.name.en.localeCompare(b.name.en));
  return { stops: matches.slice(0,limit), total:matches.length, routeFilter:byRoute ? q : null, query:q };
}
