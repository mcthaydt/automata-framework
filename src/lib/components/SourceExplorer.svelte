<script lang="ts">
  import CodeBlock from './CodeBlock.svelte'
  import type { ProjectSource, SourceFile } from '../../data/projects'

  type Guide = { label: string; path: string; description: string }
  type Node = { name: string; file?: SourceFile; children: Node[] }
  let { project, initialFile, guides = [] }: { project: ProjectSource; initialFile?: string; guides?: Guide[] } = $props()
  let choice = $state<{ slug: string; path: string } | undefined>()
  const selected = $derived(project.files.find(file => file.path === (choice?.slug === project.slug ? choice.path : initialFile ?? project.root + '/main.ts')) ?? project.files[0])
  const guide = $derived(guides.find(item => item.path === selected?.path))
  const sourceUrl = $derived('https://github.com/mcthaydt/automata-framework/blob/main/' + selected?.path.split('/').map(encodeURIComponent).join('/'))
  const tree = $derived.by(() => {
    const nodes: Node[] = []
    for (const file of project.files) {
      // Keep each project's own files at the top level; shared projects and root configuration
      // retain their actual repository paths under the Workspace folder.
      const displayPath = file.path.startsWith(project.root + '/') ? file.path.slice(project.root.length + 1) : 'Workspace/' + file.path
      const parts = displayPath.split('/')
      let siblings = nodes
      parts.forEach((name, index) => {
        let node = siblings.find(node => node.name === name)
        if (!node) { node = { name, children: [] }; siblings.push(node) }
        if (index === parts.length - 1) node.file = file
        siblings = node.children
      })
    }
    const sort = (nodes: Node[]) => {
      nodes.sort((a, b) => Number(Boolean(a.file)) - Number(Boolean(b.file)) || a.name.localeCompare(b.name))
      nodes.forEach(node => sort(node.children))
    }
    sort(nodes)
    return nodes
  })
  function contains(nodes: Node[], path: string): boolean { return nodes.some(node => node.file?.path === path || contains(node.children, path)) }
  function select(path: string) { choice = { slug: project.slug, path } }
</script>

{#snippet branches(nodes: Node[])}
  <ul>
    {#each nodes as node (node.name)}
      <li>
        {#if node.file}
          <button type="button" aria-label={'Open ' + node.file.path} aria-current={selected?.path === node.file.path ? 'true' : undefined} onclick={() => select(node.file!.path)}><code>{node.name}</code></button>
        {:else}
          <details open={node.name === 'src' || contains(node.children, selected?.path ?? '')}><summary><code>{node.name}</code></summary>{@render branches(node.children)}</details>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<section class="source-explorer" aria-label={'Source for ' + project.name} data-ui>
  <div class="source-project"><div><strong><code>{project.root}</code></strong><span>{project.files.length} files</span></div><a href={'https://github.com/mcthaydt/automata-framework/tree/main/' + project.root}>Open project on GitHub</a></div>
  {#if guides.length}
    <div class="source-guides" role="group" aria-label="Explore how Emberwick works">
      {#each guides as item}<button type="button" aria-pressed={selected?.path === item.path} onclick={() => select(item.path)}>{item.label}</button>{/each}
    </div>
    <p class="source-explanation" aria-live="polite">{guide?.description ?? 'Explore the project files to follow its imports, configuration and shared code.'}</p>
  {/if}
  <div class="source-mobile-picker"><label>Choose a file<select value={selected?.path} onchange={event => select(event.currentTarget.value)}>{#each project.files as file}<option value={file.path}>{file.path.startsWith(project.root + '/') ? file.path.slice(project.root.length + 1) : file.path}</option>{/each}</select></label></div>
  <div class="source-workspace">
    <nav class="source-tree" aria-label="Project files">{@render branches(tree)}</nav>
    <!-- The framework's files as they are (data-framework-copy: site-checks leaves their words to the framework). -->
    <div class="source-viewer" data-framework-copy>
      {#if selected}
        {#key selected.path}
          {#if selected.content !== undefined}<CodeBlock code={selected.content} lang={selected.language} filename={selected.path} />
          {:else}<div class="source-asset"><strong><code>{selected.path}</code></strong><p>This binary asset is part of the project. View or download it from the repository.</p></div>{/if}
          <div class="source-file-footer"><a href={sourceUrl}>View file on GitHub</a></div>
        {/key}
      {:else}<p>This project has no published files.</p>{/if}
    </div>
  </div>
  <details class="source-run"><summary>Run this example</summary><p>From the root of a configured framework checkout:</p><pre><code>{project.command}</code></pre><p>These are workspace projects. Install the repository dependencies first; the files shown here use framework packages and shared examples from that checkout. Unit tests are included; browser/e2e fixtures and generated output are omitted. <a href="/docs/quick-start">Setup and access requirements</a>.</p></details>
</section>
