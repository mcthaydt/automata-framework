<script lang="ts">
  import { AI_CONTEXT_FILES, AI_PROJECT_PROMPT, AI_RULES, AI_TASKS, AI_REVIEW_CHECKS, AI_VERIFY_COMMANDS } from '../../data/ai-guidance'
  import AgentSetup from '$lib/components/AgentSetup.svelte'
  import PageMeta from '$lib/components/PageMeta.svelte'
  import CodeBlock from '$lib/components/CodeBlock.svelte'
</script>
<PageMeta title="Build with a coding agent" description="Give your coding agent Automata project context, architectural rules and verification steps. Use AI for code and tests while you direct the game and author its content." />
<div class="page-shell ai-page">
  <h1>Your agent.<br />Your game.</h1><p class="lead">Agents write code and tests. You direct the game.</p>
  <p>Build with Claude Code, Cursor, Codex, Windsurf, Antigravity, or another coding assistant. Give it the project context, ask for a focused change and tests, then inspect the result. Keep content and creative direction in your hands.</p>
  <div class="link-row"><a class="button" href="/start#worked-change">Try the double-jump remix</a><a href="/cheatsheet">Browse the API reference</a><a href="/llms.txt">View llms.txt</a><a href="/llms-full.txt">Read the full text</a></div>
  <nav class="link-row" aria-label="AI guide sections"><a href="#task-prompts">Task prompts</a><a href="#first-prompt">First prompt</a><a href="#context">Project context</a><a href="#boundaries">Boundaries</a><a href="#review">Review and verify</a></nav>
  <section id="task-prompts"><h2>Choose a task prompt.</h2><p>Use one prompt for one change. Give the agent the existing files and tests, then review its result before building on it.</p>{#each AI_TASKS as task}<details class="task-prompt" id={'prompt-' + task.id}><summary>{task.title}</summary><p>{task.description}</p><p><a href={task.apiHref}>{task.apiLabel}</a></p><CodeBlock code={task.prompt} lang="text" filename={task.title + ' prompt'} /></details>{/each}</section>
  <section id="first-prompt"><h2>A useful first prompt.</h2><p>This task matches the <a href="/start#worked-change">playable double-jump example</a>. Replace the task and acceptance criteria with your own once you understand the starting behavior.</p><CodeBlock code={AI_PROJECT_PROMPT} lang="text" filename="Project context" /></section>
  <details class="onboarding-depth"><summary>Set up your coding agent</summary><AgentSetup /></details>
  <section id="context"><h2>Start with the project.</h2><p>Give your agent a checkout and a concrete acceptance case: what the player should be able to do when the change is finished. Have it read these sources through its supported project-context mechanism.</p><dl class="rules-list">{#each AI_CONTEXT_FILES as file}<div><dt><code>{file.path}</code></dt><dd>{file.purpose}</dd></div>{/each}</dl><p>The API reference shows selected exports and usage. The checkout's current instructions and types take precedence if a version differs.</p></section>
  <section><h2>Step in when you need to.</h2><p>Work directly in the same files as your agent. Edit content, change a system, or review the files behind a working example. Keep changes small enough to understand and run the relevant checks before building on them.</p><a href="/examples">Explore the example projects</a></section>
  <section id="boundaries"><h2>Keep the boundaries.</h2><dl class="rules-list">{#each AI_RULES as rule}<div><dt>{rule.title}</dt><dd>{rule.detail}</dd></div>{/each}</dl></section>
  <section id="review"><h2>Review the result.</h2><ol>{#each AI_REVIEW_CHECKS as check}<li>{check}</li>{/each}</ol><p>For Emberwick, these workspace commands run the example's type, unit, and simulation-boundary checks, build it, and prepare its manifest.</p><CodeBlock code={AI_VERIFY_COMMANDS} lang="sh" filename="Starter checks" /><p>Other packages have their own scripts. Read their manifests before adapting these commands. Preparation creates a local artifact; browser, device, host, and publishing checks remain separate.</p><p>If a result fails, give the agent the exact error, failing test, or first divergent tick and ask it to trace the cause before making another edit. An instruction file or passing unit test cannot guarantee a correct game.</p></section>
</div>

<style>
  .task-prompt { margin-block: 1.5rem; padding: 1.25rem; background: var(--surface); }
  .task-prompt summary { padding: .5rem 0; font-size: var(--step-lead); min-height: 44px; overflow-wrap: anywhere; }
  .task-prompt[open] summary { margin-bottom: 1rem; }
</style>
