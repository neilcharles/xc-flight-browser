<script lang="ts">
  // Multi-select dropdown for short lists: a field showing the selection, opening a checkbox list.
  interface Props {
    label: string;
    options: string[];
    selected: string[];
    onChange: (v: string[]) => void;
  }
  let { label, options, selected, onChange }: Props = $props();

  let open = $state(false);
  let root: HTMLDivElement;
  const id = `dd-${Math.random().toString(36).slice(2, 8)}`;
  const summary = $derived(selected.length ? options.filter((o) => selected.includes(o)).join(', ') : 'Any');

  function toggle(o: string) {
    onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);
  }
  function outside(e: PointerEvent) {
    if (open && !root.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window onpointerdown={outside} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="dd" bind:this={root}>
  <span class="label" id={`${id}-label`}>{label}</span>
  <button class="field" class:any={!selected.length} aria-haspopup="listbox" aria-expanded={open}
    aria-labelledby={`${id}-label`} onclick={() => (open = !open)}>
    <span class="text">{summary}</span>
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  {#if open}
    <ul role="listbox" aria-multiselectable="true">
      {#each options as o (o)}
        <li>
          <label>
            <input type="checkbox" checked={selected.includes(o)} onchange={() => toggle(o)} />
            {o}
          </label>
        </li>
      {/each}
      {#if selected.length}
        <li class="clear"><button onclick={() => onChange([])}>Clear</button></li>
      {/if}
    </ul>
  {/if}
</div>

<style>
  .dd { position: relative; display: flex; flex-direction: column; gap: 6px; }
  .label { font-weight: 700; color: var(--fg-strong); font-size: 0.9rem; }
  .field { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; font: inherit; font-size: 15px; text-align: left;
    color: var(--fg-strong); background: var(--control-bg); border: 1px solid var(--control-border); border-radius: 10px; box-shadow: var(--shadow-raised); }
  .field.any { color: var(--muted); }
  .text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  svg { flex: none; color: var(--muted); }
  ul { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; right: 0; max-height: 300px; overflow-y: auto; margin: 0; padding: 4px;
    list-style: none; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); }
  li label { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 7px; color: var(--fg-strong); font-size: 0.92rem; cursor: pointer; }
  li label:hover { background: var(--primary-soft); }
  input { width: 16px; height: 16px; margin: 0; accent-color: var(--primary); }
  .clear { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 4px; }
  .clear button { width: 100%; padding: 7px 8px; border: 0; border-radius: 7px; background: none; color: var(--primary-text); font: inherit; font-size: 0.88rem; text-align: left; }
  .clear button:hover { background: var(--primary-soft); }
</style>
