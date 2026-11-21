import type { Filters } from './filters';

// Filters <-> query string. Only values that differ from the defaults are written, so the plain
// URL shows the default view. "from=" (empty) means "no start date", which differs from the default.
//   ?from=2024-01-01&to=2024-12-31&min=50&site=Long%20Mynd&site=Bradwell&wing=Ozone%20Rush%206
//    &en=EN%20B&type=FAI%20triangle&wind=W&wind=NW

const LISTS = [
  ['sites', 'site'],
  ['gliders', 'wing'],
  ['en', 'en'],
  ['types', 'type'],
  ['wind', 'wind'],
] as const;

export function filtersToQuery(f: Filters, defaults: Filters): string {
  const p = new URLSearchParams();
  if (f.from !== defaults.from) p.set('from', f.from);
  if (f.to !== defaults.to) p.set('to', f.to);
  if (f.minDist !== defaults.minDist) p.set('min', String(f.minDist));
  for (const [key, param] of LISTS) for (const v of f[key]) p.append(param, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function filtersFromQuery(search: string, defaults: Filters): Filters {
  const p = new URLSearchParams(search);
  const date = (k: string, d: string) => {
    if (!p.has(k)) return d;
    const v = p.get(k) ?? '';
    return v === '' || ISO.test(v) ? v : d;
  };
  const min = Number(p.get('min'));
  const f: Filters = {
    ...defaults,
    from: date('from', defaults.from),
    to: date('to', defaults.to),
    minDist: p.has('min') && Number.isFinite(min) && min >= 0 ? min : defaults.minDist,
  };
  for (const [key, param] of LISTS) f[key] = p.getAll(param).filter(Boolean);
  return f;
}
