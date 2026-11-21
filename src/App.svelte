<script lang="ts">
  import { type Dataset, loadData } from './lib/data';
  import { type Filters, applyFilters, changedCount, defaultFilters, emptyFilters } from './lib/filters';
  import { filtersFromQuery, filtersToQuery } from './lib/urlState';
  import { MAP_LIMIT, fmtInt } from './lib/format';
  import FlightMap from './components/FlightMap.svelte';
  import FilterPanel from './components/FilterPanel.svelte';

  let data = $state.raw<Dataset | null>(null);
  let error = $state('');
  let defaults = $state.raw<Filters>(emptyFilters());
  let filters = $state.raw<Filters>(emptyFilters());
  let sheetOpen = $state(false);
  let showSites = $state(false);

  loadData()
    .then((d) => {
      defaults = defaultFilters(d);
      filters = filtersFromQuery(location.search, defaults);
      data = d;
    })
    .catch((e) => (error = e instanceof Error ? e.message : String(e)));

  const flights = $derived(data ? applyFilters(data, filters) : []);
  const fitKey = $derived(filters.sites.join('|'));
  const nActive = $derived(changedCount(filters, defaults));

  // Filters live in the URL, so any view can be bookmarked or shared.
  $effect(() => {
    if (!data) return;
    history.replaceState(null, '', location.pathname + filtersToQuery(filters, defaults));
  });
</script>

<div class="app">
  <div class="map-wrap">
    {#if data}
      <FlightMap {data} {flights} {fitKey} {showSites} />
    {/if}
    {#if data && flights.length > MAP_LIMIT}
      <div class="notice">Showing the longest {fmtInt(MAP_LIMIT)} of {fmtInt(flights.length)} flights</div>
    {:else if data && flights.length === 0}
      <div class="notice">No flights match these filters</div>
    {/if}
    <button class="sheet-btn" onclick={() => (sheetOpen = true)}>
      Filters{#if nActive}<span class="badge">{nActive}</span>{/if}
      <span class="sub">{fmtInt(flights.length)} flights</span>
    </button>
  </div>

  {#if sheetOpen}
    <button class="scrim" aria-label="Close filters" onclick={() => (sheetOpen = false)}></button>
  {/if}
  <aside class:open={sheetOpen}>
    <header>
      <div class="title">
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--primary)"/><path d="M5 17c4-7 18-7 22 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M8 25l6-5 4 3 6-6" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <h1>UK XC Browser</h1>
        {#if nActive}<button class="reset" onclick={() => (filters = defaults)}>Reset</button>{/if}
        <button class="close" aria-label="Close" onclick={() => (sheetOpen = false)}>×</button>
      </div>
    </header>

    {#if error}
      <p class="error">{error}</p>
    {:else if !data}
      <p class="status"><span class="spinner"></span> Loading flights…</p>
    {:else}
      <div class="row">
        <p class="count"><strong>{fmtInt(flights.length)}</strong> flights</p>
        <label class="check"><input type="checkbox" bind:checked={showSites} /> Show sites</label>
      </div>
      <FilterPanel {data} {filters} onChange={(f) => (filters = f)} />
    {/if}
  </aside>
</div>

<style>
  .app { position: fixed; inset: 0; display: grid; grid-template-columns: 1fr 380px; }
  .map-wrap { position: relative; min-width: 0; }
  aside { overflow-y: auto; background: var(--bg); border-left: 1px solid var(--border); padding: 16px 16px 24px; display: flex; flex-direction: column; gap: 20px; }
  header { display: flex; flex-direction: column; gap: 10px; }
  .title { display: flex; align-items: center; gap: 10px; }
  h1 { margin: 0; font-size: 1.25rem; color: var(--fg-strong); flex: 1; }
  .close { display: none; width: 40px; height: 40px; border: 0; background: none; color: var(--fg-strong); font-size: 1.6rem; }
  .reset { border: 0; background: none; color: var(--primary-text); font: inherit; font-size: 0.9rem; text-decoration: underline; padding: 4px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: -8px; }
  .count { margin: 0; color: var(--muted); }
  .check { display: flex; align-items: center; gap: 8px; color: var(--fg-strong); font-size: 0.9rem; font-weight: 700; cursor: pointer; }
  .check input { width: 16px; height: 16px; margin: 0; accent-color: var(--primary); }
  .count strong { color: var(--fg-strong); font-size: 1.1rem; }
  .notice { position: absolute; z-index: 500; top: 10px; left: 50%; transform: translateX(-50%); padding: 6px 12px; border-radius: 999px; background: var(--surface); color: var(--fg-strong); font-size: 0.85rem; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); white-space: nowrap; }
  .sheet-btn { display: none; }
  .scrim { display: none; }
  .status { display: flex; align-items: center; gap: 8px; color: var(--muted); }
  .spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error { color: var(--danger); }

  /* Phone: full-screen map, filters and stats in a bottom sheet */
  @media (max-width: 750px) {
    .app { grid-template-columns: 1fr; }
    .notice { top: calc(env(safe-area-inset-top) + 10px); font-size: 0.8rem; }
    .sheet-btn { display: flex; align-items: center; gap: 8px; position: absolute; z-index: 500; left: 50%; transform: translateX(-50%);
      bottom: calc(env(safe-area-inset-bottom) + 18px); min-height: 48px; padding: 0 18px; border: 0; border-radius: 999px;
      background: var(--primary); color: var(--on-primary); font: inherit; font-weight: 700; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3); white-space: nowrap; }
    .sub { font-weight: 400; opacity: 0.85; font-size: 0.88rem; }
    .badge { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; background: var(--accent); font-size: 0.75rem; }
    .scrim { display: block; position: fixed; inset: 0; z-index: 900; border: 0; background: rgba(0, 0, 0, 0.35); }
    aside { position: fixed; z-index: 1000; left: 0; right: 0; bottom: 0; max-height: 88dvh; border-left: 0; border-radius: 16px 16px 0 0;
      box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.25); transform: translateY(105%); transition: transform 0.22s ease;
      padding-bottom: calc(env(safe-area-inset-bottom) + 24px); }
    aside.open { transform: none; }
    .close { display: block; }
  }
</style>
