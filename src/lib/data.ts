// Loads public/data/flights.json (written by scripts/export_data.R) and turns its columns into
// one object per flight. Paths stay delta-encoded until the map draws them.

export interface SiteInfo {
  name: string;
  /** in the uk_pg_sites list */
  listed: boolean;
  lat?: number;
  lon?: number;
  guide: string;
  /** flyable wind directions from uk_pg_sites, e.g. "SW,W,NW" */
  winds: string;
}

export interface Flight {
  /** XC League flight id */
  id: number;
  /** days since 1970-01-01 */
  day: number;
  year: number;
  /** 1-12 */
  month: number;
  /** minutes after midnight, or -1 */
  start: number;
  /** minutes, or -1 */
  dur: number;
  /** km */
  dist: number;
  site: number;
  landing: number;
  glider: number;
  en: number;
  type: number;
  craft: number;
  mods: number;
  /** 0 = N .. 7 = NW, -1 unknown */
  wdir: number;
  /** km/h, -1 unknown */
  wspd: number;
  /** [lat0, lon0, dlat1, dlon1, ...] in 1e-4 degrees */
  path: number[];
}

export interface Dataset {
  generated: string;
  sectors: string[];
  sites: SiteInfo[];
  gliders: string[];
  en: string[];
  types: string[];
  crafts: string[];
  landings: string[];
  flights: Flight[];
  /** latest flight day */
  maxDay: number;
  minDay: number;
}

interface RawSite { n: string; s: number; lat?: number; lon?: number; g?: string; w?: string }
export interface RawData {
  version: number;
  generated: string;
  sectors: string[];
  sites: RawSite[];
  gliders: string[];
  en: string[];
  types: string[];
  crafts: string[];
  landings: string[];
  flights: Record<
    'id' | 'date' | 'start' | 'dur' | 'dist' | 'site' | 'landing' | 'glider' | 'en' | 'type' | 'craft' | 'mods' | 'wdir' | 'wspd',
    number[]
  > & { path: number[][] };
}

export const MODS = { declared: 1, coastal: 2, tow: 4, ridge: 8 } as const;

export function dayToDate(day: number): Date {
  return new Date(day * 86400000);
}
export function dayToIso(day: number): string {
  return dayToDate(day).toISOString().slice(0, 10);
}
export function isoToDay(iso: string): number {
  return Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000);
}

export function decode(raw: RawData): Dataset {
  const c = raw.flights;
  const n = c.id.length;
  const flights: Flight[] = new Array(n);
  let maxDay = -Infinity;
  let minDay = Infinity;
  for (let i = 0; i < n; i++) {
    const day = c.date[i];
    const d = dayToDate(day);
    if (day > maxDay) maxDay = day;
    if (day < minDay) minDay = day;
    flights[i] = {
      id: c.id[i],
      day,
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      start: c.start[i],
      dur: c.dur[i],
      dist: c.dist[i] / 100,
      site: c.site[i],
      landing: c.landing[i],
      glider: c.glider[i],
      en: c.en[i],
      type: c.type[i],
      craft: c.craft[i],
      mods: c.mods[i],
      wdir: c.wdir[i],
      wspd: c.wspd[i],
      path: c.path[i],
    };
  }
  return {
    generated: raw.generated,
    sectors: raw.sectors,
    sites: raw.sites.map((s) => ({ name: s.n, listed: s.s === 1, lat: s.lat, lon: s.lon, guide: s.g ?? '', winds: s.w ?? '' })),
    gliders: raw.gliders,
    en: raw.en,
    types: raw.types,
    crafts: raw.crafts,
    landings: raw.landings,
    flights,
    maxDay,
    minDay,
  };
}

/** Delta-encoded path -> [lat, lon] pairs in degrees. */
export function decodePath(p: number[]): [number, number][] {
  const out: [number, number][] = [];
  let lat = 0;
  let lon = 0;
  for (let i = 0; i + 1 < p.length; i += 2) {
    lat += p[i];
    lon += p[i + 1];
    out.push([lat / 1e4, lon / 1e4]);
  }
  return out;
}

/** Solo paraglider flights only: drops hang gliders and tandems (by flight type or wing class). */
export function soloParagliders(data: Dataset): Dataset {
  const pg = data.crafts.indexOf('Paraglider');
  const tandemEn = data.en.indexOf('Tandem');
  const flights = data.flights.filter((f) => f.craft === pg && f.en !== tandemEn);
  let maxDay = -Infinity;
  let minDay = Infinity;
  for (const f of flights) {
    if (f.day > maxDay) maxDay = f.day;
    if (f.day < minDay) minDay = f.day;
  }
  return { ...data, flights, maxDay, minDay };
}

export async function loadData(url = './data/flights.json'): Promise<Dataset> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load flight data (${res.status})`);
  return soloParagliders(decode((await res.json()) as RawData));
}
