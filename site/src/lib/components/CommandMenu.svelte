<script lang="ts">
  import { tick } from 'svelte'
  import { getExamples } from '../../data/examples'
  import { getDocSections } from '../../data/docs-loader'
  import { CHEATSHEET_MODULES, cheatsheetSearchText } from '../../data/cheatsheet'
  import { AI_TASKS } from '../../data/ai-guidance'
  import { latestApiVersion, loadApiSearch, searchApi } from '$lib/api-reference'
  import type { ApiSearchRow } from '../../../scripts/api-reference'
  let { isOpen = false, onClose = () => {} }: { isOpen?: boolean; onClose?: () => void } = $props()
  let dialog: HTMLDialogElement
  let input: HTMLInputElement
  let query = $state('')
  const links = [
    { title: 'Overview', detail: 'About Automata', url: '/' },
    { title: 'Examples', detail: 'One-file examples that run beside their code', url: '/examples' },
    { title: 'API reference', detail: 'Selected current APIs', url: '/cheatsheet' },
    { title: 'Showcase', detail: 'Starter and reference projects', url: '/showcase' },
    { title: 'AI guidance', detail: 'Rules and plain-text docs', url: '/ai' },
    ...AI_TASKS.map(task => ({ title: task.title, detail: task.description + ' ' + task.prompt, url: '/ai#prompt-' + task.id })),
    ...getDocSections().map(d => ({ title: d.title, detail: d.description + ' ' + d.content, url: '/docs/' + d.slug })),
    ...getExamples().map(e => ({ title: e.id + ': ' + e.title, detail: e.shows, url: '/examples/' + e.id })),
    ...CHEATSHEET_MODULES.flatMap(m => m.entries.map(e => ({ title: e.name, detail: cheatsheetSearchText(m, e), url: '/cheatsheet#' + e.name }))),
  ]
  let results = $derived(links.filter(l => query.trim().toLowerCase().split(/\s+/).every(q => (l.title + ' ' + l.detail).toLowerCase().includes(q))))
  // The complete generated reference loads the first time the menu opens, so a page that never searches does not carry it.
  const apiVersion = latestApiVersion()
  let apiRows = $state<ApiSearchRow[]>([])
  let apiLoaded = false
  const apiResults = $derived(searchApi(apiRows, query, 20).filter(row => !links.some(l => l.url === '/cheatsheet#' + row.name)).map(row => ({ title: row.name, detail: row.kind + ' in ' + row.package, url: '/api/' + apiVersion + '/' + row.package + '#' + row.name })))
  $effect(() => {
    if (!dialog) return
    if (isOpen) {
      const previous = document.activeElement as HTMLElement | null
      query = ''
      dialog.showModal()
      if (!apiLoaded) { apiLoaded = true; void loadApiSearch(apiVersion).then(rows => { apiRows = rows }) }
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
  <input bind:this={input} id="site-search" type="search" bind:value={query} placeholder="Try createSim or snapshot" />
  <div class="search-results">
    {#each results as item}<a href={item.url} onclick={onClose}>{item.title}</a>{/each}
    {#each apiResults as item}<a href={item.url} onclick={onClose}>{item.title} <span class="small">{item.detail}</span></a>{/each}
    {#if !results.length && !apiResults.length}<p role="status">No matches. Try a function name or topic.</p>{/if}
  </div>
  <p class="small">Use arrow keys to move, Enter to open, Escape to close.</p>
</dialog>
