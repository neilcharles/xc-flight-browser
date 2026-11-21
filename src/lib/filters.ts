import { type Dataset, type Flight, isoToDay } from './data';

/** Every filter is held by name (not index) so URLs stay valid when the data is rebuilt. */
export interface Filters {
  /** YYYY-MM-DD, '' = no limit */
  from: string;
  to: string;
  /** km */
  minDist: number;
  sites: string[];
  gliders: string[];
  en: string[];
  types: string[];
  /** wind sectors, e.g. "NW" */
  wind: string[];
}

/** Same default as the Shiny app: 1 January last year to the latest flight. */
export function defaultFilters(data: Pick<Dataset, 'maxDay'>): Filters {
  const lastYear = new Date(data.maxDay * 86400000).getUTCFullYear() - 1;
  return {
    from: `${lastYear}-01-01`,
    to: '',
    minDist: 0,
    sites: [],
    gliders: [],
    en: [],
    types: [],
    wind: [],
  };
}

export function emptyFilters(): Filters {
  return { from: '', to: '', minDist: 0, sites: [], gliders: [], en: [], types: [], wind: [] };
}

/** Number of filters that differ from `base` (dates count as one). */
export function changedCount(f: Filters, base: Filters): number {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v));
  return (
    (f.from !== base.from || f.to !== base.to ? 1 : 0) +
    (f.minDist !== base.minDist ? 1 : 0) +
    (['sites', 'gliders', 'en', 'types', 'wind'] as const).filter((k) => !same(f[k], base[k])).length
  );
}

function indexSet(names: string[], levels: string[]): Set<number> | null {
  if (!names.length) return null;
  const s = new Set<number>();
  for (const n of names) {
    const i = levels.indexOf(n);
    if (i >= 0) s.add(i);
  }
  return s;
}

/** Matching flights, longest first. */
export function applyFilters(data: Dataset, f: Filters): Flight[] {
  const from = f.from ? isoToDay(f.from) : -Infinity;
  const to = f.to ? isoToDay(f.to) : Infinity;
  const sites = indexSet(f.sites, data.sites.map((s) => s.name));
  const gliders = indexSet(f.gliders, data.gliders);
  const en = indexSet(f.en, data.en);
  const types = indexSet(f.types, data.types);
  const wind = indexSet(f.wind, data.sectors);
  const out = data.flights.filter(
    (x) =>
      x.day >= from &&
      x.day <= to &&
      x.dist >= f.minDist &&
      (!sites || sites.has(x.site)) &&
      (!gliders || gliders.has(x.glider)) &&
      (!en || en.has(x.en)) &&
      (!types || types.has(x.type)) &&
      (!wind || wind.has(x.wdir)),
  );
  return out.sort((a, b) => b.dist - a.dist);
}
