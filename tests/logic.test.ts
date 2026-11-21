import { describe, expect, it } from 'vitest';
import { type RawData, decode, decodePath, isoToDay, soloParagliders } from '../src/lib/data';
import { applyFilters, changedCount, defaultFilters, emptyFilters } from '../src/lib/filters';
import { filtersFromQuery, filtersToQuery } from '../src/lib/urlState';
import { distColour, popupHtml, sitePopupHtml, xcLeagueUrl } from '../src/lib/format';

const day = (iso: string) => isoToDay(iso);

// Four flights, encoded as scripts/export_data.R writes them.
const raw: RawData = {
  version: 1,
  generated: '2025-11-01',
  sectors: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  sites: [
    { n: 'Long Mynd', s: 1, lat: 52.52, lon: -2.88, g: 'https://example.org/guide', w: 'W,NW' },
    { n: 'Somewhere <odd>', s: 0 },
  ],
  gliders: ['Ozone Rush 6', 'Ozone Zeno 2'],
  en: ['EN B', 'EN D/Comp', 'Unknown'],
  types: ['Turnpoint', 'FAI triangle'],
  crafts: ['Paraglider', 'Tandem', 'Hang glider'],
  landings: ['', 'Church Stretton'],
  flights: {
    id: [101, 102, 103, 104],
    date: [day('2023-05-10'), day('2024-04-20'), day('2024-07-01'), day('2025-06-15')],
    start: [750, 690, -1, 600],
    dur: [125, 300, -1, 45],
    dist: [2550, 12010, 6000, 1000],
    site: [0, 0, 1, 0],
    landing: [1, 0, 0, 1],
    glider: [0, 1, 0, 0],
    en: [0, 1, 0, 2],
    type: [0, 1, 0, 0],
    craft: [0, 0, 1, 0],
    mods: [0, 1, 2, 0],
    wdir: [6, 7, -1, 6],
    wspd: [20, 15, -1, 30],
    path: [
      [525200, -28800, 1000, 2000, 0, -500],
      [525200, -28800, 5000, 5000],
      [550000, -30000, 10, 10],
      [525200, -28800, 100, 100],
    ],
  },
};
const data = decode(raw);

describe('decode', () => {
  it('builds one object per flight with dates and km', () => {
    expect(data.flights).toHaveLength(4);
    expect(data.flights[1]).toMatchObject({ id: 102, year: 2024, month: 4, dist: 120.1 });
    expect(data.maxDay).toBe(day('2025-06-15'));
    expect(data.minDay).toBe(day('2023-05-10'));
    expect(data.sites[0]).toMatchObject({ name: 'Long Mynd', listed: true, winds: 'W,NW' });
  });
  it('undoes the delta encoding of paths', () => {
    expect(decodePath(raw.flights.path[0])).toEqual([
      [52.52, -2.88],
      [52.62, -2.68],
      [52.62, -2.73],
    ]);
  });
});

describe('filters', () => {
  const ids = (f: ReturnType<typeof emptyFilters>) => applyFilters(data, f).map((x) => x.id);

  it('defaults to 1 Jan last year onwards, like the Shiny app', () => {
    expect(defaultFilters(data).from).toBe('2024-01-01');
    expect(ids(defaultFilters(data))).toEqual([102, 103, 104]);
  });
  it('returns everything longest first with no filters', () => {
    expect(ids(emptyFilters())).toEqual([102, 103, 101, 104]);
  });
  it('filters by date range (inclusive)', () => {
    expect(ids({ ...emptyFilters(), from: '2024-04-20', to: '2024-07-01' })).toEqual([102, 103]);
  });
  it('filters by minimum distance', () => {
    expect(ids({ ...emptyFilters(), minDist: 25.5 })).toEqual([102, 103, 101]);
  });
  it('filters by site, wing, EN and type names', () => {
    expect(ids({ ...emptyFilters(), sites: ['Somewhere <odd>'] })).toEqual([103]);
    expect(ids({ ...emptyFilters(), gliders: ['Ozone Zeno 2'] })).toEqual([102]);
    expect(ids({ ...emptyFilters(), en: ['EN B', 'Unknown'] })).toEqual([103, 101, 104]);
    expect(ids({ ...emptyFilters(), types: ['FAI triangle'] })).toEqual([102]);
  });
  it('filters by wind sector, excluding flights with unknown wind', () => {
    expect(ids({ ...emptyFilters(), wind: ['W'] })).toEqual([101, 104]);
    expect(ids({ ...emptyFilters(), wind: ['W', 'NW'] })).toEqual([102, 101, 104]);
  });
  it('treats an unknown name as matching nothing', () => {
    expect(ids({ ...emptyFilters(), sites: ['Nowhere'] })).toEqual([]);
  });
  it('combines filters with AND', () => {
    expect(ids({ ...emptyFilters(), sites: ['Long Mynd'], wind: ['W'], minDist: 20 })).toEqual([101]);
  });
  it('counts filters changed from the defaults', () => {
    const d = defaultFilters(data);
    expect(changedCount(d, d)).toBe(0);
    expect(changedCount({ ...d, to: '2025-02-01', wind: ['N'], minDist: 5 }, d)).toBe(3);
    expect(changedCount({ ...d, wind: ['W', 'N'] }, { ...d, wind: ['N', 'W'] })).toBe(0);
  });
});

describe('url state', () => {
  const defaults = defaultFilters(data);
  it('writes nothing for the defaults', () => {
    expect(filtersToQuery(defaults, defaults)).toBe('');
  });
  it('round-trips every filter', () => {
    const f = {
      from: '', to: '2025-01-31', minDist: 50, sites: ['Long Mynd', 'A, B & C'], gliders: ['Ozone Rush 6'],
      en: ['EN B'], types: ['FAI triangle'], wind: ['W', 'NW'],
    };
    const q = filtersToQuery(f, defaults);
    expect(q).toContain('from=&');
    expect(filtersFromQuery(q, defaults)).toEqual(f);
  });
  it('ignores malformed values', () => {
    const f = filtersFromQuery('?from=yesterday&min=-3', defaults);
    expect(f.from).toBe(defaults.from);
    expect(f.minDist).toBe(0);
  });
});

describe('solo paragliders', () => {
  it('drops hang glider and tandem flights, and tandem-class wings', () => {
    const solo = soloParagliders(decode({ ...raw, en: ['EN B', 'Tandem', 'Unknown'] }));
    // 103 is flown on a Tandem; 102's wing class is (here) Tandem
    expect(solo.flights.map((f) => f.id)).toEqual([101, 104]);
    expect(solo.minDay).toBe(day('2023-05-10'));
    expect(solo.maxDay).toBe(day('2025-06-15'));
  });
});

describe('popup', () => {
  it('links to the XC League, escapes text and has no pilot field', () => {
    const html = popupHtml(data, data.flights[2]);
    expect(html).toContain(xcLeagueUrl(103));
    expect(html).toContain('Somewhere &#60;odd&#62;');
    expect(html).not.toMatch(/pilot/i);
    expect(html).toContain('Tandem');
    expect(html).toContain('coastal');
  });
  it('shows the site guide link and wind', () => {
    const html = popupHtml(data, data.flights[0]);
    expect(html).toContain('href="https://example.org/guide"');
    expect(html).toContain('W 20 km/h');
    expect(html).toContain('12:30 · 2h 05m');
  });
  it('site popup shows flights, winds and guide link', () => {
    const html = sitePopupHtml(data.sites[0], 1234);
    expect(html).toContain('Long Mynd');
    expect(html).toContain('1,234');
    expect(html).toContain('W, NW');
    expect(html).toContain('href="https://example.org/guide"');
    expect(sitePopupHtml(data.sites[1], 0)).not.toContain('Site guide');
  });
  it('colours by distance bin', () => {
    expect(distColour(10)).not.toBe(distColour(60));
    expect(distColour(150)).not.toBe(distColour(250));
  });
});
