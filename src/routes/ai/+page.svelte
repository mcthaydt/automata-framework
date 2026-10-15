<script lang="ts">
  import PageMeta from '$lib/components/PageMeta.svelte'
  import CodeBlock from '$lib/components/CodeBlock.svelte'
  const rules = [
    ['Simulation owns state', 'Keep gameplay changes inside simulation systems. Send commands from input and UI.'],
    ['Effect outside the sim', 'Use Effect for loading, networking, timers and resource lifetimes. Keep simulation steps synchronous.'],
    ['No dynamic evaluation', 'Avoid eval and new Function. Import the renderer’s no-eval entry before initializing PixiJS. Verify against the host CSP.'],
    ['Interpolate presentation', 'Read previous and current simulation values when drawing between ticks.'],
    ['Views observe gameplay', 'Render deltas describe what changed. Presentation and UI must not mutate entities directly.'],
  ]
  const prompt = `Read the project's AGENTS.md and current package types first.
Use the existing 2D starter as the reference.
Keep gameplay changes inside simulation systems.
Use Effect for resource lifetimes outside the simulation.
Avoid dynamic evaluation and use the no-eval renderer entry.
Run the relevant type, unit and runtime checks.
Report what passed and what remains unverified.`
</script>
<PageMeta title="AI coding guidance" description="Project context and architectural rules for coding agents, with plain-text documentation and verification guidance." />
<div class="page-shell ai-page">
  <h1>Context for your agent.</h1><p class="lead">Give it the rules. Check its work.</p>
  <p>Use these references with Claude Code, Cursor, Windsurf, Antigravity, or another coding assistant. Instructions provide context; type checks, tests, and runtime checks verify the result.</p>
  <div class="link-row"><a class="button" href="/llms.txt">View llms.txt</a><a href="/llms-full.txt">Read the full text</a><a href="/docs/ai-rules">Read the rules guide</a></div>
  <section><h2>Start with the project.</h2><p>Give your agent the repository's AGENTS.md, the package definitions, and the source of the closest runnable example. Use your agent's supported project-context mechanism. There is no verified public Automata agent installer listed here.</p></section>
  <section><h2>Keep the boundaries.</h2><dl class="rules-list">{#each rules as [title, detail]}<div><dt>{title}</dt><dd>{detail}</dd></div>{/each}</dl></section>
  <section><h2>A useful first prompt.</h2><CodeBlock code={prompt} lang="text" filename="Project context" /></section>
</div>
