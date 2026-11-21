<script lang="ts">
  import type { Dataset } from '../lib/data';
  import type { Filters } from '../lib/filters';
  import DateRange from './DateRange.svelte';
  import Dropdown from './Dropdown.svelte';
  import MultiSelect from './MultiSelect.svelte';

  interface Props {
    data: Dataset;
    filters: Filters;
    onChange: (f: Filters) => void;
  }
  let { data, filters, onChange }: Props = $props();

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });

  function counts(key: 'site' | 'glider', n: number): number[] {
    const c = new Array(n).fill(0);
    for (const f of data.flights) c[f[key]]++;
    return c;
  }
  // Only options that have flights (tandem / hang glider flights are dropped on load).
  const siteOptions = $derived.by(() => {
    const c = counts('site', data.sites.length);
    return data.sites
      .map((s, i) => ({ value: s.name, count: c[i] }))
      .filter((o) => o.count > 0);
  });
  const gliderOptions = $derived.by(() => {
    const c = counts('glider', data.gliders.length);
    return data.gliders.map((g, i) => ({ value: g, count: c[i] })).filter((o) => o.count > 0);
  });
  const present = (levels: string[], key: 'en' | 'type') => {
    const used = new Set(data.flights.map((f) => f[key]));
    return levels.filter((_, i) => used.has(i));
  };
  const enOptions = $derived(present(data.en, 'en'));
  const typeOptions = $derived(present(data.types, 'type'));
</script>

<div class="filters">
  <DateRange minDay={data.minDay} maxDay={data.maxDay} from={filters.from} to={filters.to}
    onChange={(from, to) => onChange({ ...filters, from, to })} />

  <div class="range">
    <label for="min-dist">Minimum distance <strong>{filters.minDist} km</strong></label>
    <input id="min-dist" type="range" min="0" max="250" step="5" value={filters.minDist}
      oninput={(e) => set('minDist', Number(e.currentTarget.value))} />
  </div>

  <MultiSelect label="Takeoff site" placeholder="Search sites…" options={siteOptions} selected={filters.sites} onChange={(v) => set('sites', v)} />
  <Dropdown label="Wind" options={data.sectors} selected={filters.wind} onChange={(v) => set('wind', v)} />
  <MultiSelect label="Wing" placeholder="Search wings…" options={gliderOptions} selected={filters.gliders} onChange={(v) => set('gliders', v)} />
  <Dropdown label="EN rating" options={enOptions} selected={filters.en} onChange={(v) => set('en', v)} />
  <Dropdown label="Flight type" options={typeOptions} selected={filters.types} onChange={(v) => set('types', v)} />
</div>

<style>
  .filters { display: flex; flex-direction: column; gap: 18px; }
  .range label { display: flex; align-items: baseline; margin-bottom: 6px; font-weight: 700; color: var(--fg-strong); font-size: 0.9rem; }
  .range label strong { margin-left: auto; color: var(--primary-text); font-variant-numeric: tabular-nums; }
  .range input { width: 100%; accent-color: var(--primary); }
</style>
