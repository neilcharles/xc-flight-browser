<script lang="ts">
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { untrack } from 'svelte';
  import { type Dataset, type Flight, decodePath } from '../lib/data';
  import { DIST_BINS, MAP_LIMIT, distColour, popupHtml, sitePopupHtml } from '../lib/format';

  interface Props {
    data: Dataset;
    /** filtered flights, longest first */
    flights: Flight[];
    /** changes when the map should zoom to the flights (e.g. the site filter changed) */
    fitKey: string;
    /** show takeoff markers for the sites in the uk_pg_sites list */
    showSites: boolean;
  }
  let { data, flights, fitKey, showSites }: Props = $props();

  let el: HTMLDivElement;
  let map: L.Map;
  let layer: L.FeatureGroup;
  let sitesLayer: L.LayerGroup | null = null;
  /** flights per site index under the current filters, read when a site popup opens */
  let siteCounts = new Map<number, number>();
  const lines = new Map<number, L.Polyline>();
  const ACCENT = '#ed5c35';

  function baseStyle(f: Flight): L.PathOptions {
    return { color: distColour(f.dist), weight: 2.5, opacity: 0.6 };
  }

  $effect(() => {
    map = L.map(el, { preferCanvas: true, zoomSnap: 0.5, minZoom: 5, maxZoom: 15 }).setView([54.3, -2.8], 6);
    map.attributionControl.setPrefix('');
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 13,
      attribution: 'Relief © Esri',
    }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      opacity: 0.5,
      maxNativeZoom: 16,
      attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors',
    }).addTo(map);
    map.createPane('labels');
    const labels = map.getPane('labels')!;
    labels.style.zIndex = '450';
    labels.style.pointerEvents = 'none';
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      pane: 'labels',
      maxNativeZoom: 16,
    }).addTo(map);
    layer = L.featureGroup().addTo(map);

    const legend = new L.Control({ position: 'bottomleft' });
    legend.onAdd = () => {
      const d = L.DomUtil.create('div', 'legend');
      d.innerHTML = DIST_BINS.map((b) => `<span><i style="background:${b.colour}"></i>${b.label}</span>`).join('');
      return d;
    };
    legend.addTo(map);
    return () => map.remove();
  });

  // Redraw when the filtered flights change. Shortest drawn first so the longest sit on top.
  $effect(() => {
    const shown = flights.slice(0, MAP_LIMIT);
    untrack(() => {
      layer.clearLayers();
      lines.clear();
      for (let i = shown.length - 1; i >= 0; i--) {
        const f = shown[i];
        const line = L.polyline(decodePath(f.path), baseStyle(f));
        line.on('mouseover', () => line.setStyle({ color: ACCENT, weight: 4, opacity: 1 }).bringToFront());
        line.on('mouseout', () => { if (!line.isPopupOpen()) line.setStyle(baseStyle(f)); });
        line.bindPopup(() => popupHtml(data, f), { maxWidth: 280, autoPanPadding: [24, 24] });
        line.on('popupopen', () => line.setStyle({ color: ACCENT, weight: 4, opacity: 1 }).bringToFront());
        line.on('popupclose', () => line.setStyle(baseStyle(f)));
        line.addTo(layer);
        lines.set(f.id, line);
      }
    });
  });

  $effect(() => {
    const c = new Map<number, number>();
    for (const f of flights) c.set(f.site, (c.get(f.site) ?? 0) + 1);
    siteCounts = c;
  });

  // Takeoff markers for listed sites that have at least one flight drawn on the map right now.
  // They sit in their own pane above the flight lines so they stay clickable.
  const siteMarkers = new Map<number, L.CircleMarker>();
  let sitesRenderer: L.Canvas | null = null;
  function siteMarker(i: number): L.CircleMarker | null {
    const s = data.sites[i];
    if (!s.listed || s.lat === undefined || s.lon === undefined) return null;
    let m = siteMarkers.get(i);
    if (!m) {
      if (!sitesRenderer) {
        map.createPane('sites').style.zIndex = '460';
        sitesRenderer = L.canvas({ pane: 'sites' });
      }
      m = L.circleMarker([s.lat, s.lon], { renderer: sitesRenderer, pane: 'sites', radius: 5, weight: 2, color: '#ffffff', fillColor: '#2b4364', fillOpacity: 1 })
        .bindTooltip(s.name, { direction: 'top', offset: [0, -6] })
        .bindPopup(() => sitePopupHtml(s, siteCounts.get(i) ?? 0), { maxWidth: 240 });
      siteMarkers.set(i, m);
    }
    return m;
  }
  $effect(() => {
    const show = showSites;
    const shown = flights.slice(0, MAP_LIMIT);
    untrack(() => {
      if (!sitesLayer) sitesLayer = L.layerGroup().addTo(map);
      sitesLayer.clearLayers();
      if (!show) return;
      for (const i of new Set(shown.map((f) => f.site))) siteMarker(i)?.addTo(sitesLayer);
    });
  });

  // Zoom to the flights only when asked (fitKey), so ordinary filter tweaks don't reset the view.
  let lastFit = '';
  $effect(() => {
    const key = fitKey;
    untrack(() => {
      if (key === lastFit) return;
      lastFit = key;
      if (key && layer.getLayers().length) map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 11 });
      else if (!key) map.setView([54.3, -2.8], 6);
    });
  });

  export function invalidate() {
    map?.invalidateSize();
  }
</script>

<div bind:this={el} class="map" role="region" aria-label="Map of flights"></div>

<style>
  .map { position: absolute; inset: 0; z-index: 0; background: #dfe3e6; }
</style>
