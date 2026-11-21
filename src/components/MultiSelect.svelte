<script lang="ts">
  // Type-ahead picker for long lists (sites, wings). Selected values show as removable chips.
  interface Option { value: string; count: number; note?: string }
  interface Props {
    label: string;
    placeholder: string;
    options: Option[];
    selected: string[];
    onChange: (v: string[]) => void;
  }
  let { label, placeholder, options, selected, onChange }: Props = $props();

  let query = $state('');
  let open = $state(false);
  let active = $state(0);
  const id = `ms-${Math.random().toString(36).slice(2, 8)}`;

  const matches = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const pool = options.filter((o) => !selected.includes(o.value));
    const hits = q ? pool.filter((o) => o.value.toLowerCase().includes(q)) : pool;
    // starts-with first, then by flight count
    return hits
      .sort((a, b) => (q ? Number(b.value.toLowerCase().startsWith(q)) - Number(a.value.toLowerCase().startsWith(q)) : 0) || b.count - a.count)
      .slice(0, 40);
  });

  function add(v: string) {
    onChange([...selected, v]);
    query = '';
    active = 0;
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, matches.length - 1); open = true; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); e.preventDefault(); }
    else if (e.key === 'Enter' && matches[active]) { add(matches[active].value); e.preventDefault(); }
    else if (e.key === 'Escape') open = false;
    else if (e.key === 'Backspace' && !query && selected.length) onChange(selected.slice(0, -1));
  }
</script>

<div class="ms">
  <label for={id}>{label}</label>
  {#if selected.length}
    <div class="sel">
      {#each selected as v (v)}
        <span class="tag">{v}<button aria-label={`Remove ${v}`} onclick={() => onChange(selected.filter((s) => s !== v))}>×</button></span>
      {/each}
    </div>
  {/if}
  <div class="box">
    <input
      {id}
      type="search"
      autocomplete="off"
      {placeholder}
      bind:value={query}
      onfocus={() => (open = true)}
      onblur={() => setTimeout(() => (open = false), 150)}
      oninput={() => { open = true; active = 0; }}
      onkeydown={key}
      role="combobox"
      aria-expanded={open}
      aria-controls={`${id}-list`}
    />
    {#if open && matches.length}
      <ul id={`${id}-list`} role="listbox">
        {#each matches as o, i (o.value)}
          <li role="option" aria-selected={i === active}>
            <button class:active={i === active} onmousedown={(e) => { e.preventDefault(); add(o.value); }}>
              <span class="name">{o.value}{#if o.note}<small> · {o.note}</small>{/if}</span>
              <span class="n">{o.count.toLocaleString('en-GB')}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .ms { display: flex; flex-direction: column; gap: 6px; }
  label { font-weight: 700; color: var(--fg-strong); font-size: 0.9rem; }
  .box { position: relative; }
  input { width: 100%; height: 40px; padding: 0 12px; font: inherit; font-size: 16px; color: var(--fg-strong); background: var(--control-bg); border: 1px solid var(--control-border); border-radius: 10px; box-shadow: var(--shadow-raised); }
  ul { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; right: 0; max-height: 260px; overflow-y: auto; margin: 0; padding: 4px; list-style: none; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); }
  li button { width: 100%; display: flex; justify-content: space-between; gap: 8px; padding: 7px 8px; border: 0; border-radius: 7px; background: none; color: var(--fg-strong); font: inherit; font-size: 0.92rem; text-align: left; }
  li button.active, li button:hover { background: var(--primary-soft); }
  .n { color: var(--muted); font-variant-numeric: tabular-nums; }
  small { color: var(--muted); }
  .sel { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { display: inline-flex; align-items: center; gap: 2px; padding: 3px 4px 3px 10px; border-radius: 999px; background: var(--primary); color: var(--on-primary); font-size: 0.85rem; font-weight: 700; }
  .tag button { width: 22px; height: 22px; border: 0; border-radius: 50%; background: none; color: inherit; font-size: 1rem; line-height: 1; }
</style>
