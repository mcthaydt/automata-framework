<script lang="ts">
  import { flushSync } from 'svelte'
  import CopyButton from '$lib/components/CopyButton.svelte'
  import CodeBlock from '$lib/components/CodeBlock.svelte'
  import PageMeta from '$lib/components/PageMeta.svelte'
  import { isEditing } from '$lib/utils/keyboard'
  import { CHEATSHEET_MODULES, searchCheatsheet } from '../../data/cheatsheet'
  import { AI_TASKS } from '../../data/ai-guidance'
  let query = $state('')
  let selected = $state('all')
  let input: HTMLInputElement
  let matches = $derived(new Set(searchCheatsheet(query)))
  let modules = $derived(CHEATSHEET_MODULES.filter(m => selected === 'all' || m.name === selected).map(m => ({ ...m, entries: m.entries.filter(e => !query.trim() || matches.has(e)) })).filter(m => m.entries.length))
  function keydown(event: KeyboardEvent) { if (event.key === '/' && !isEditing(event)) { event.preventDefault(); input.focus() } }
  function showAll() { flushSync(() => { query = ''; selected = 'all' }) }
</script>
<svelte:window onkeydown={keydown} />
<PageMeta title="API reference" description="Automata API examples, parameters, return values, and lifecycle guidance for simulation, rendering, runtime, content, hosting, and shipping." />
<div class="page-shell api-page">
  <h1>API reference</h1><p class="lead">Find the API. See how it fits.</p><p>Each module starts with an example, followed by parameters, return values, and failure or cleanup notes. Signatures are abbreviated where needed; the linked TypeScript definitions own the full contract.</p>
  <div class="link-row"><a href="/ai">Build with a coding agent</a><a href="/examples">Browse working projects</a><a href="/llms-full.txt">Plain-text reference</a></div>
  <h2 class="task-heading">What are you making?</h2><nav class="link-row" aria-label="Find an API by task">{#each AI_TASKS as task}<a href={task.apiHref} onclick={showAll}>{task.title}</a>{/each}</nav>
  <nav class="link-row" aria-label="API modules">{#each CHEATSHEET_MODULES as mod}<a href={'#' + mod.id} onclick={showAll}>{mod.title}</a>{/each}</nav>
  <label for="api-search">Search API names, parameters, and usage</label><input id="api-search" bind:this={input} type="search" bind:value={query} placeholder="Try snapshot, duplicate-seq, or pause menu" />
  <label for="api-package">Package</label><select id="api-package" bind:value={selected}><option value="all">All packages</option>{#each CHEATSHEET_MODULES as mod}<option value={mod.name}>{mod.title}</option>{/each}</select>
  {#each modules as mod}<section class="api-module" id={mod.id}><h2>{mod.title}</h2><p>{mod.description}</p><p><code>{mod.name}</code></p>
    <a href={'https://github.com/mcthaydt/automata-framework/blob/main/' + mod.sourcePath}>{mod.title} source</a>
    <CodeBlock code={mod.example} filename={mod.title + ' example'} />
    {#each mod.entries as entry}<article class="api-entry" id={entry.name}>
      <h3>{entry.name}</h3><p>{entry.description}</p>
      {#if entry.receiver}<p class="small">Instance method on <code>{entry.receiver}</code></p>{/if}
      <!-- Keyboard access to long signatures on narrow screens. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="api-signature" tabindex="0" role="region" aria-label={entry.name + ' signature'}><pre><code>{entry.signature}</code></pre></div>
      <CopyButton text={entry.signature} label={'Copy ' + entry.name + ' signature'} />
      {#if entry.parameters?.length}
        <!-- Keyboard access for parameter tables that overflow on phones. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="table-scroll" tabindex="0" role="region" aria-label={entry.name + ' parameter table'}><table aria-label={entry.name + ' parameters'}><thead><tr><th scope="col">Parameter</th><th scope="col">Type</th><th scope="col">Usage</th></tr></thead><tbody>{#each entry.parameters as parameter}<tr><th scope="row"><code>{parameter.name}</code></th><td><code>{parameter.type}</code></td><td>{parameter.desc}</td></tr>{/each}</tbody></table></div>
      {/if}
      <p class="api-return">Returns <code>{entry.returnType}</code></p>
      {#if entry.notes?.length}<ul>{#each entry.notes as note}<li>{note}</li>{/each}</ul>{/if}
      <a class="small" href={'#' + entry.name}>Link to {entry.name}</a>
    </article>{/each}
  </section>{/each}
  {#if !modules.length}<p role="status">No API entries match. Try another name or package.</p>{/if}
</div>

<style>
  .api-module { min-width: 0; margin-top: 4rem; }
  .task-heading { margin: 2.5rem 0 0; font-family: var(--font-mono); font-size: var(--step-micro); font-weight: 400; letter-spacing: .1em; word-spacing: normal; text-transform: uppercase; color: var(--muted); }
  .api-module > :global(.code-block) { margin-block: 1.5rem 2rem; }
  .api-entry { min-width: 0; }
  .api-signature { overflow-x: auto; margin-block: 1rem; }
  .api-return { margin-top: 1.25rem; }
  .table-scroll { margin-top: 1.5rem; }
  table { width: 100%; text-align: left; font-size: var(--step-small); }
  th, td { padding: .75rem .75rem .75rem 0; vertical-align: top; }
  td:last-child { min-width: 16rem; }
  .api-entry li { max-width: 75ch; }
</style>
