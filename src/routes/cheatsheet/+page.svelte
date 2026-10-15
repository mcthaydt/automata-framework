<script lang="ts">
  import CopyButton from '$lib/components/CopyButton.svelte'
  import PageMeta from '$lib/components/PageMeta.svelte'
  import { isEditing } from '$lib/utils/keyboard'
  import { CHEATSHEET_MODULES } from '../../data/cheatsheet'
  let query = $state('')
  let selected = $state('all')
  let input: HTMLInputElement
  let modules = $derived(CHEATSHEET_MODULES.filter(m => selected === 'all' || m.name === selected).map(m => ({ ...m, entries: m.entries.filter(e => (e.name + ' ' + e.description + ' ' + e.signature).toLowerCase().includes(query.trim().toLowerCase())) })).filter(m => m.entries.length))
  function keydown(event: KeyboardEvent) { if (event.key === '/' && !isEditing(event)) { event.preventDefault(); input.focus() } }
</script>
<svelte:window onkeydown={keydown} />
<PageMeta title="API reference" description="A searchable selection of current Automata exports and instance methods, grouped by package." />
<div class="page-shell api-page">
  <h1>API reference</h1><p class="lead">A working reference, kept close to the source.</p><p>Selected exports and instance methods. Generic signatures are abbreviated; the framework's TypeScript definitions are authoritative.</p>
  <label for="api-search">Search API names and signatures</label><input id="api-search" bind:this={input} type="search" bind:value={query} placeholder="Search API…" />
  <label for="api-package">Package</label><select id="api-package" bind:value={selected}><option value="all">All packages</option>{#each CHEATSHEET_MODULES as mod}<option value={mod.name}>{mod.title}</option>{/each}</select>
  {#each modules as mod}<section class="api-module"><h2>{mod.title}</h2><p>{mod.description}</p><p><code>{mod.name}</code></p>
    {#each mod.entries as entry}<article class="api-entry" id={entry.name}><h3>{entry.name}</h3><p>{entry.description}</p><pre><code>{entry.signature}</code></pre><CopyButton text={entry.signature} label={'Copy ' + entry.name + ' signature'} />{#if entry.example}<pre><code>{entry.example}</code></pre>{/if}</article>{/each}
  </section>{/each}
  {#if !modules.length}<p role="status">No API entries match. Try another name or package.</p>{/if}
</div>
