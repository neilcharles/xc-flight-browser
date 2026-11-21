<script lang="ts">
  // Two-handle date slider (days since 1970). Handles at either end mean "no limit" (''),
  // so the URL stays clean. The label follows the drag; onChange fires when a handle is released.
  import { dayToIso, isoToDay } from '../lib/data';
  import { fmtDate } from '../lib/format';

  interface Props {
    minDay: number;
    maxDay: number;
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
  }
  let { minDay, maxDay, from, to, onChange }: Props = $props();

  const clamp = (d: number) => Math.min(maxDay, Math.max(minDay, d));
  let lo = $state(0);
  let hi = $state(0);
  $effect(() => {
    lo = from ? clamp(isoToDay(from)) : minDay;
    hi = to ? clamp(isoToDay(to)) : maxDay;
  });

  const pct = (d: number) => ((d - minDay) / (maxDay - minDay || 1)) * 100;

  function commit() {
    onChange(lo <= minDay ? '' : dayToIso(lo), hi >= maxDay ? '' : dayToIso(hi));
  }
</script>

<div class="range">
  <div class="head">
    <span class="label" id="dates-label">Dates</span>
    <strong>{fmtDate(lo)} – {fmtDate(hi)}</strong>
  </div>
  <div class="track" style:--lo={`${pct(lo)}%`} style:--hi={`${pct(hi)}%`}>
    <input class:top={lo > (minDay + maxDay) / 2} type="range" min={minDay} max={maxDay} step="1" bind:value={lo} aria-label="From date" aria-valuetext={fmtDate(lo)}
      oninput={() => { if (lo > hi) lo = hi; }} onchange={commit} />
    <input type="range" min={minDay} max={maxDay} step="1" bind:value={hi} aria-label="To date" aria-valuetext={fmtDate(hi)}
      oninput={() => { if (hi < lo) hi = lo; }} onchange={commit} />
  </div>
  <div class="ends"><span>{new Date(minDay * 86400000).getUTCFullYear()}</span><span>{new Date(maxDay * 86400000).getUTCFullYear()}</span></div>
</div>

<style>
  .head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
  .label { font-weight: 700; color: var(--fg-strong); font-size: 0.9rem; }
  strong { margin-left: auto; color: var(--primary-text); font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  /* two native range inputs stacked on one track; only their thumbs take pointer events */
  .track { position: relative; height: 22px; }
  .track::before, .track::after { content: ''; position: absolute; top: 9px; height: 4px; border-radius: 2px; }
  .track::before { left: 0; right: 0; background: var(--track); }
  .track::after { left: var(--lo); right: calc(100% - var(--hi)); background: var(--primary); }
  input { position: absolute; inset: 0; width: 100%; margin: 0; background: none; pointer-events: none; -webkit-appearance: none; appearance: none; z-index: 1; }
  input.top { z-index: 2; }
  input::-webkit-slider-runnable-track { background: none; }
  input::-moz-range-track { background: none; }
  input::-webkit-slider-thumb { -webkit-appearance: none; pointer-events: auto; width: 18px; height: 18px; border-radius: 50%; background: var(--control-bg); border: 2px solid var(--primary); box-shadow: var(--shadow-raised); cursor: pointer; }
  input::-moz-range-thumb { pointer-events: auto; width: 14px; height: 14px; border-radius: 50%; background: var(--control-bg); border: 2px solid var(--primary); cursor: pointer; }
  input:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--primary-text); outline-offset: 2px; }
  .ends { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
</style>
