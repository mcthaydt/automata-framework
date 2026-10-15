<script lang="ts">
  import { tick } from 'svelte'
  import { getDemosCatalog } from '../../data/demos'
  import { getDocSections } from '../../data/docs-loader'
  import { CHEATSHEET_MODULES } from '../../data/cheatsheet'
  let { isOpen = false, onClose = () => {} }: { isOpen?: boolean; onClose?: () => void } = $props()
  let dialog: HTMLDialogElement
  let input: HTMLInputElement
  let query = $state('')
  const links = [
    { title: 'Overview', detail: 'About Automata', url: '/' },
    { title: 'Examples', detail: 'Playable demos and source', url: '/examples' },
    { title: 'API reference', detail: 'Selected current APIs', url: '/cheatsheet' },
    { title: 'Showcase', detail: 'Starter and reference projects', url: '/showcase' },
    { title: 'AI guidance', detail: 'Rules and plain-text docs', url: '/ai' },
    ...getDocSections().map(d => ({ title: d.title, detail: d.description + ' ' + d.content, url: '/docs/' + d.slug })),
    ...getDemosCatalog().map(d => ({ title: d.title, detail: d.shows, url: '/examples?demo=' + d.slug })),
    ...CHEATSHEET_MODULES.flatMap(m => m.entries.map(e => ({ title: e.name, detail: e.description + ' ' + e.signature, url: '/cheatsheet#' + e.name }))),
  ]
  let results = $derived(links.filter(l => query.trim().toLowerCase().split(/\s+/).every(q => (l.title + ' ' + l.detail).toLowerCase().includes(q))))
  $effect(() => {
    if (!dialog) return
    if (isOpen) {
      const previous = document.activeElement as HTMLElement | null
      query = ''
      dialog.showModal()
      void tick().then(() => input?.focus())
      return () => { dialog.close(); previous?.focus() }
    }
  })
  function keys(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(dialog.querySelectorAll<HTMLAnchorElement>('.search-results a'))
    if (!items.length) return
    const index = items.indexOf(document.activeElement as HTMLAnchorElement)
    const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next].focus()
  }
</script>
<dialog bind:this={dialog} class="search-dialog" aria-labelledby="search-title" oncancel={(e) => { e.preventDefault(); onClose() }} onkeydown={keys}>
  <div class="dialog-heading"><h2 id="search-title">Find your way</h2><button type="button" onclick={onClose}>Close</button></div>
  <label for="site-search">Search pages, docs, API and demos</label>
  <input bind:this={input} id="site-search" type="search" bind:value={query} placeholder="Try createSim or physics" />
  <div class="search-results">
    {#each results as item}<a href={item.url} onclick={onClose}>{item.title}</a>{/each}
    {#if !results.length}<p role="status">No matches. Try a function name or topic.</p>{/if}
  </div>
  <p class="small">Use arrow keys to move, Enter to open, Escape to close.</p>
</dialog>
