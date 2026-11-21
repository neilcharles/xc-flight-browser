import { type Dataset, type Flight, type SiteInfo, MODS, dayToDate } from './data';

export const MAP_LIMIT = 2000;

/** Distance bins as in the Shiny app: 0-50, 50-100, 100-200, 200+ km. */
export const DIST_BINS = [
  { min: 0, label: '< 50 km', colour: '#5a6a85' },
  { min: 50, label: '50–100', colour: '#d07000' },
  { min: 100, label: '100–200', colour: '#d4213f' },
  { min: 200, label: '200+ km', colour: '#2453c9' },
];

export function distColour(km: number): string {
  for (let i = DIST_BINS.length - 1; i >= 0; i--) if (km >= DIST_BINS[i].min) return DIST_BINS[i].colour;
  return DIST_BINS[0].colour;
}

export function xcLeagueUrl(id: number): string {
  return `https://www.xcleague.com/xc/flights/${id}.html`;
}

export function fmtKm(km: number): string {
  return km >= 100 ? km.toFixed(0) : km.toFixed(1);
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-GB');
}

export function fmtDate(day: number): string {
  return dayToDate(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? esc(u) : '');

export function typeLabel(data: Dataset, f: Flight): string {
  const mods = [
    f.mods & MODS.declared ? 'declared' : '',
    f.mods & MODS.coastal ? 'coastal' : '',
    f.mods & MODS.tow ? 'tow' : '',
    f.mods & MODS.ridge ? 'ridge-run' : '',
  ].filter(Boolean);
  return data.types[f.type] + (mods.length ? ` (${mods.join(', ')})` : '');
}

/** Takeoff site popup: name, flights matching the current filters, flyable winds, site guide. */
export function sitePopupHtml(site: SiteInfo, flights: number): string {
  const guide = safeUrl(site.guide);
  return `<div class="pop">
  <div class="pop-site">${esc(site.name)}</div>
  <dl>
    <dt>Flights</dt><dd>${fmtInt(flights)}</dd>
    ${site.winds ? `<dt>Winds</dt><dd>${esc(site.winds.replace(/,/g, ', '))}</dd>` : ''}
  </dl>
  ${guide ? `<a class="pop-link" href="${guide}" target="_blank" rel="noopener">Site guide ↗</a>` : ''}
</div>`;
}

/** Popup HTML. Contains no pilot name by design. */
export function popupHtml(data: Dataset, f: Flight): string {
  const site = data.sites[f.site];
  const craft = data.crafts[f.craft];
  const landing = data.landings[f.landing];
  const time = [f.start >= 0 ? hhmm(f.start) : '', f.dur > 0 ? duration(f.dur) : ''].filter(Boolean).join(' · ');
  const wind = f.wdir >= 0 ? `${data.sectors[f.wdir]}${f.wspd >= 0 ? ` ${f.wspd} km/h` : ''}` : 'unknown';
  const guide = safeUrl(site.guide);
  return `<div class="pop">
  <div class="pop-km" style="--c:${distColour(f.dist)}">${fmtKm(f.dist)} km</div>
  <div class="pop-type">${esc(typeLabel(data, f))}${craft !== 'Paraglider' ? ` · ${esc(craft)}` : ''}</div>
  <dl>
    <dt>Date</dt><dd>${fmtDate(f.day)}${time ? ` · ${time}` : ''}</dd>
    <dt>Takeoff</dt><dd>${esc(site.name)}${guide ? ` · <a href="${guide}" target="_blank" rel="noopener">site guide</a>` : ''}</dd>
    ${landing ? `<dt>Landed</dt><dd>${esc(landing)}</dd>` : ''}
    <dt>Wing</dt><dd>${esc(data.gliders[f.glider])}${data.en[f.en] !== 'Unknown' ? ` · ${esc(data.en[f.en])}` : ''}</dd>
    <dt>Wind</dt><dd title="ERA5 reanalysis wind at 100 m at the start hour">${wind}</dd>
  </dl>
  <a class="pop-link" href="${xcLeagueUrl(f.id)}" target="_blank" rel="noopener">View on XC League ↗</a>
</div>`;
}
