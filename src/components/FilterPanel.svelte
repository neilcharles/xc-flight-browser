<script lang="ts">
  import type { Dataset } from '../lib/data';
  import { type Facet, type Filters, facetCounts } from '../lib/filters';
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

  // Cascading options: each list only offers values that have flights under the other filters.
  // Values already selected stay listed (even at zero) so they can still be removed.
  const counts = $derived(facetCounts(data, filters));
  const available = (k: Facet, levels: string[]) =>
    levels.map((value, i) => ({ value, count: counts[k][i] })).filter((o) => o.count > 0 || filters[k].includes(o.value));

  const siteOptions = $derived(available('sites', data.sites.map((s) => s.name)));
  const gliderOptions = $derived(available('gliders', data.gliders));
  const windOptions = $derived(available('wind', data.sectors).map((o) => o.value));
  const enOptions = $derived(available('en', data.en).map((o) => o.value));
  const typeOptions = $derived(available('types', data.types).map((o) => o.value));
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
  <Dropdown label="Wind" options={windOptions} selected={filters.wind} onChange={(v) => set('wind', v)} />
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
