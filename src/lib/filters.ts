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

/** The list filters, each paired with the flight field it matches. */
export const FACETS = { sites: 'site', gliders: 'glider', en: 'en', types: 'type', wind: 'wdir' } as const;
export type Facet = keyof typeof FACETS;

/**
 * Flight counts per option for each list filter, counting the flights that pass every *other*
 * filter. Options with a zero count can't add any flights given the rest of the selection, so the
 * panel hides them; that makes the filters cascade. One pass over the flights.
 */
export function facetCounts(data: Dataset, f: Filters): Record<Facet, number[]> {
  const from = f.from ? isoToDay(f.from) : -Infinity;
  const to = f.to ? isoToDay(f.to) : Infinity;
  const levels: Record<Facet, string[]> = {
    sites: data.sites.map((s) => s.name),
    gliders: data.gliders,
    en: data.en,
    types: data.types,
    wind: data.sectors,
  };
  const keys = Object.keys(FACETS) as Facet[];
  const sets = keys.map((k) => indexSet(f[k], levels[k]));
  const counts = Object.fromEntries(keys.map((k) => [k, new Array(levels[k].length).fill(0)])) as Record<Facet, number[]>;
  for (const x of data.flights) {
    if (x.day < from || x.day > to || x.dist < f.minDist) continue;
    let failed = -1;
    let nFailed = 0;
    for (let k = 0; k < keys.length; k++) {
      const s = sets[k];
      if (s && !s.has(x[FACETS[keys[k]]]) && ++nFailed === 1) failed = k;
      if (nFailed > 1) break;
    }
    if (nFailed > 1) continue;
    for (let k = 0; k < keys.length; k++) {
      if (nFailed === 1 && k !== failed) continue;
      const v = x[FACETS[keys[k]]];
      if (v >= 0) counts[keys[k]][v]++;
    }
  }
  return counts;
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
