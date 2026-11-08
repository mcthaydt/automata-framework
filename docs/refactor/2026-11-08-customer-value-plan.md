# Customer Value for AI Game Makers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents in this project). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person with a coding agent gets from the site to a shared game without a trap: their agent has Automata's
skills and knows how code meets what the editors make, the published editor starts anywhere, what they see is what
touches, and nothing they placed is cut off.

**Architecture:** The agent package's public mirror becomes its own plugin marketplace, and every new game names it in
`.claude/settings.json` beside an `AGENTS.md`. A sixth skill, `automata-content`, writes the content contract down, and
the API reference grows to every package a template imports. Small, separate fixes go to the editor command (V4), the
templates (V6, V12, V17), the content compiler's event list (V10), the letterbox (V8) and the site's copy (V1, V7, V9,
V13). Sharing (V11) follows the Owner's decision D1 = A: Publish puts the game on itch.io.

**Tech Stack:** TypeScript, Node 24, Vitest, Playwright, Svelte 5, SvelteKit (site), PixiJS 8, Zod 4, Claude Code
2.1.319 plugins.

**Spec:** [`2026-11-08-customer-value-spec.md`](2026-11-08-customer-value-spec.md). Audit:
[`2026-11-08-customer-value-audit.md`](2026-11-08-customer-value-audit.md) (PR #530).

**Base.** Tools, templates, skills and core tasks (1 to 6, 8, 9, 11, 12, 13, 14, 17) branch from the newest stack head
holding PR #522 (`5cf0825b` when this was written). Site and try-it tasks (7, 10, 15) branch from the newest head holding
PR #521 (`5fd3933c`). Once the merge thread joins the two stacks (V16), everything branches from there. Task 15 waits for
the free web editor work (V5); Task 16 waits for the DUEL licence answer.

## Global Constraints

- `AGENTS.md` holds: test first, feature folders, tests in `tests/` importing `#src/…`, kebab-case files with role
  suffixes, at most 600 lines a file, comments say why and never name this plan or a finding id.
- Copy passes the drunk grandma test: could a drunk grandma tell what is happening and what to press? No file key,
  package name, flag or the word "build" in text a person reads in an editor or on the site's pages, except a command
  they are told to paste.
- Touch targets 44 px, primary actions 48 px; phone first.
- Never tell an agent to stop because a skill is missing (spec §3).
- The skills mirror carries no 3D text until Pixi 3D is public (skills decision D2).
- AF stores no itch.io key and hosts nothing (spec §11).
- No sim hash in `games/`, `examples/` or core moves. The templates' own tests change with Task 6 (new games); Task 12
  moves landscape visual baselines only, each looked at and explained in the commit.
- Published packages touched get a `patch` changeset: `@automata/tools` (Tasks 2, 5, 6, 8, 9, 13, 14), `@automata/content`
  (Tasks 9, 11), `@automata/framework` (Task 12), and `@automata/feel`, `@automata/puzzle`, `@automata/audio-synth` if Task
  11 touches their manifests. Private packages (`-editor`, `-editors`, the story extensions, the site) get none. After a
  published package's exports or doc comments change: `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`,
  `pnpm agent-skills --write`, `pnpm cheatsheet`, and commit what they write. `plugin.json`'s version follows the API's
  (`pnpm api-index` checks it); never bump it by hand.
- `pnpm format` and `pnpm check` before every commit; Conventional Commits; update `docs/refactor/progress.md` and this
  plan's log in the same session as each task.

## Review Focus

1. **A game folder inside a person's own pnpm monorepo, two levels down**, whose root `package.json` has some other name.
   `automata editor` opens the packed page. Test in Task 5.
2. **An agent that is not Claude Code** (Codex, Cursor) opening a new game. It reads `AGENTS.md`, which works without the
   plugin and says how to get the skills; nothing in it is Claude-only except the one marked line. Test in Task 2.
3. **A person who resizes the player in Characters** (say to 12 × 12). The box the sim collides with follows on the next
   compile, with no code change. Test in Task 6.
4. **`create-game` on a machine with git but no `user.name`.** The game is made, the folder is a repository, and the
   last line says how to make the first commit. Test in Task 8.
5. **A wide phone held sideways (932 × 430) with the touch controls on.** The whole level shows, and no control covers
   it. Test in Task 12.

---

## Phase 1: the agent experience (V1, V3, V4, V6)

### Task 1: The skills mirror is a marketplace

**Files:**
- Create: `agents/automata/.claude-plugin/marketplace.json`
- Modify: `tooling/agent-skills/src/layout.ts` (read the plugin's own marketplace)
- Test: `tooling/agent-skills/tests/unit/layout.test.ts`

**Interfaces:**
- Produces: marketplace `automata`, plugin `automata`, source `./`; `readAgentPackage(...)` reports a problem when the
  plugin's own marketplace is missing or names another plugin.

- [ ] **Step 1: Write the failing test** in `layout.test.ts`, under "AF's own agent package":

```ts
it('is a marketplace of its own, for the public mirror', () => {
  const own = JSON.parse(readFileSync(join(REPO, 'agents/automata/.claude-plugin/marketplace.json'), 'utf8'))
  expect(own.name).toBe('automata')
  expect(own.plugins).toEqual([{ name: 'automata', source: './' }])
})
```

Plus a fixture case: a package whose `.claude-plugin/marketplace.json` lists `other` gives the problem
`the mirror's marketplace must list this plugin as ./`.

- [ ] **Step 2: Run** `pnpm --filter @automata/agent-skills test layout` (the package name is in
  `tooling/agent-skills/package.json`). Expected: FAIL, file missing.
- [ ] **Step 3: Create the file** (`description`: "Automata Framework's skills and check hooks for coding agents.",
  owner `mcthaydt`) and the layout check, reusing the `Marketplace` schema (its `source` rule allows `./`).
- [ ] **Step 4: Run** the test and `pnpm plugin:validate`. Expected: PASS both. Then in a scratch folder:
  `claude plugin marketplace add <repo>/agents/automata --scope project` and `claude plugin install automata@automata
  --scope project`. Expected: both "Successfully". Note the output in the log.
- [ ] **Step 5: Commit** `feat(agents): make the skills mirror a plugin marketplace of its own`.

### Task 2: `create-game` writes `AGENTS.md`, `CLAUDE.md` and `.claude/settings.json`

**Files:**
- Create: `packages/tools/src/shared/create-game/template-agent.ts`
- Modify: `template.ts` (add `AGENT_FILES` to `TEMPLATE_FILES`), `template-3d.ts` (add to `TEMPLATE_3D_FILES`),
  `create-game-targets.ts` (`targetGitignore` gains `.claude/settings.local.json`)
- Test: `packages/tools/tests/unit/shared/create-game/template-agent.test.ts`

**Interfaces:**
- Produces: `AUTOMATA_SKILLS_REPO = 'mcthaydt/automata-skills'`, `AUTOMATA_MARKETPLACE = 'automata'`,
  `AGENT_FILES: readonly TemplateFile[]` (paths `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`),
  `agentsMd(options: TemplateOptions): string`. Task 7 uses the two constants' values (the site cannot import tools; its
  test reads this file's marketplace instead).

- [ ] **Step 1: Write the failing tests:**

```ts
it.each(['2d', 'story', '3d'] as const)('a %s game has the three agent files', (kind) => {
  const paths = templateFilesOf(optionsFor(kind)).map((f) => f.path)
  expect(paths).toEqual(expect.arrayContaining(['AGENTS.md', 'CLAUDE.md', '.claude/settings.json']))
})
it('settings name the mirror and turn the plugin on, exactly', () => {
  expect(JSON.parse(contentOf('.claude/settings.json'))).toEqual({
    extraKnownMarketplaces: { automata: { source: { source: 'github', repo: 'mcthaydt/automata-skills' } } },
    enabledPlugins: { 'automata@automata': true },
  })
})
it('CLAUDE.md is one line', () => expect(contentOf('CLAUDE.md')).toBe('@AGENTS.md\n'))
it('AGENTS.md works without the plugin and never says stop', () => {
  const text = contentOf('AGENTS.md')
  for (const words of ['pnpm check', 'automata-content', 'npx skills add https://github.com/mcthaydt/automata-skills',
    '/plugin install automata@automata', 'content/tuning.toml', 'Math.random'])
    expect(text).toContain(words)
  expect(text).not.toMatch(/\bstop\b/i)
  expect(text.split('\n').length).toBeLessThanOrEqual(80)
})
it("a 3D game's AGENTS.md has the 3D rows; a 2D game's has none", () => { /* af-sector.json, figure*: in 3d only */ })
it('.gitignore keeps a person’s own Claude settings out', () =>
  expect(contentOf('.gitignore')).toContain('.claude/settings.local.json'))
```

- [ ] **Step 2: Run** `pnpm --filter @automata/tools test template-agent`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement `template-agent.ts`.** `agentsMd` builds the page from sections: what the game is, the laws
  that bite (spec §3), where things go (the kind's folder table), the content contract (five lines and the skill's name),
  verify (`pnpm check`), and getting the skills (spec §2's three lines; the Claude Code line marked "In Claude Code:").
  The 3D variant adds the two 3D rows from spec §4.
- [ ] **Step 4: Run** the test, then `create-game.integration.test.ts` and `template.test.ts` (their file counts move by
  three). Expected: PASS. Then make a game with `--link-workspace` and run its `pnpm check`. Expected: green (Biome reads
  `.claude/settings.json` as JSON and accepts it).
- [ ] **Step 5: Changeset** (`@automata/tools`, patch) **and commit** `feat(tools): give a new game its agent files`.

### Task 3: The `automata-content` skill, and the editor skill for every editor

**Files:**
- Create: `agents/automata/skills/automata-content/SKILL.md`, `agents/automata/skills/automata-content/example/coin.md`
- Modify: `agents/automata/skills/automata/SKILL.md` ("Where a change goes": content bullet points at the new skill),
  `agents/automata/skills/automata-editor/SKILL.md` (rewritten: every editor `content/editors.toml` lists, Play and
  Publish; the 2D-only text goes)
- Test: `tooling/agent-skills/tests/unit/skill-content.test.ts`, `layout.test.ts` ("carries the … skills": six)

**Interfaces:**
- Consumes: the template sources under `packages/tools/src/shared/create-game/` (read as text by the test), the API
  reference from Task 4.
- Produces: skill `automata-content`, description: "How code meets what a person makes in the editors: placed characters,
  tunables, events, words, scenes and characters that think. Use when adding anything a person should be able to change
  in an editor, or when a feature passes its tests but does nothing in play."

- [ ] **Step 1: Write the failing tests** in `skill-content.test.ts`:

```ts
describe('automata-content', () => {
  const skill = read('agents/automata/skills/automata-content/SKILL.md')
  it.each(['Levels', 'Characters', 'Tuner', 'Feel', 'Audio', 'Writer', 'Sequence', 'Schematic'])('has a row for %s', (e) =>
    expect(skill).toMatch(new RegExp(`^\\| ${e}\\b`, 'm')))
  it('names only exports the API reference lists', () => {
    for (const name of backtickedCalls(skill)) // `entitiesOf(`, `levelScene(`, `pictureView(` …
      expect(read('agents/automata/skills/automata-api/reference/api.md')).toContain(`#### \`${name}\``)
  })
  it('names only content paths a template writes', () => {
    for (const glob of contentGlobs(skill)) expect(templateGlobs()).toContain(glob) // from every editors.toml
  })
  it('has no 3D text (the mirror is public before 3D is)', () => expect(skill).not.toMatch(/3D|af-sector|figure/))
  it('places the coin in the level file in its example test', () =>
    expect(read('agents/automata/skills/automata-content/example/coin.md')).toContain('content/levels/start.af2d.json'))
})
describe('automata-editor', () => {
  it('no longer says the editor is 2D levels only', () =>
    expect(read('agents/automata/skills/automata-editor/SKILL.md')).not.toContain('2D level editor'))
})
```

`templateGlobs()` reads every `editors.toml` under `template-content/`, `template-story-content/` (the 3D one is left out).
Also update `skills-text.test.ts`'s "open the 2D editor…" case to the new words.

- [ ] **Step 2: Run** `pnpm --filter @automata/agent-skills test`. Expected: FAIL, skill missing.
- [ ] **Step 3: Write the skill** from spec §4's table, each row checked against the 2D and story templates
  (`template-level.ts`, `template-story.ts`, `template-feel-audio.ts`, `template-story-content/editors-story.toml`). Write
  `example/coin.md`: the `coin` definition, a placed coin in `start.af2d.json`, `coin.component.ts`, `pick-up.system.ts`
  (spawning from `entitiesOf`), `coin.collected` in `coin-collected.event.ts`, `live: ['player-start', 'area', 'coin']`, and
  a test that compiles the level file, spawns the player at the start and walks it into the coin. Rewrite the editor skill.
- [ ] **Step 4: Run** the tests and `pnpm plugin:validate`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(agents): write down how code meets the editors (automata-content)`.

### Task 4: The API reference lists every package a template imports

**Files:**
- Modify: `tooling/api-index/src/entry-points.ts` (beta entry points), `tooling/api-index/src/render.ts` (a "Beta"
  heading and the 3D line), `tooling/api-index/src/run.ts` (beta rows take no doc-comment findings),
  `agents/automata/skills/automata-api/SKILL.md` (what Beta means)
- Test: `tooling/api-index/tests/unit/entry-points.test.ts`, `render.test.ts`

**Interfaces:**
- Produces: `templateImports(root: string): ReadonlySet<string>` (every `@automata/<name>` a 2D or story template
  file under `packages/tools/src/shared/create-game/` imports, by `from '@automata/<name>…'`; the `template-3d*.ts` files
  are not read, so no 3D-only package reaches the public mirror); `EntryPoint.beta: boolean`;
  `HELD_UNTIL_3D_PUBLIC = ['@automata/3d', '@automata/sectors'] as const`; `entryPoints(root)` returns published entries
  and, after them, the private packages in `templateImports` minus `HELD_UNTIL_3D_PUBLIC`, with `beta: true`.

- [ ] **Step 1: Write the failing tests:**

```ts
it('lists every package the 2D and story templates import', () => {
  const listed = new Set(entryPoints(REPO).map((e) => e.package))
  for (const name of templateImports(REPO)) if (!HELD_UNTIL_3D_PUBLIC.includes(name)) expect(listed).toContain(name)
})
it('marks the private ones beta and holds the 3D ones back', () => {
  const byName = new Map(entryPoints(REPO).map((e) => [e.package, e]))
  expect(byName.get('@automata/narrative')?.beta).toBe(true)
  expect(byName.get('@automata/sim')?.beta).toBe(false)
  expect(byName.has('@automata/3d')).toBe(false)
})
it('renders beta packages under their own heading, with the 3D line', () => {
  const md = render(/* fixture with one beta entry */)
  expect(md).toContain('## Beta: works in a game made inside the AutomataFramework repository; not published yet')
  expect(md).toContain('The 3D packages are listed here when 3D is public.')
})
```

- [ ] **Step 2: Run** `pnpm --filter @automata/api-index test`. Expected: FAIL.
- [ ] **Step 3: Implement** as in Interfaces. The private packages' `.d.ts` come from `pnpm build` like the rest; a
  missing one is the same `MissingTypesError`.
- [ ] **Step 4: Run** the tests, then `pnpm build && pnpm api-index --write && pnpm agent-skills --write && pnpm cheatsheet`.
  Expected: `api.md` gains the Beta section with narrative, cutscenes, systems, nav, places and level-2d; no `@automata/3d`.
  Check `grep -c '3d' agents/automata/skills/automata-api/reference/api.md` finds no 3D package heading.
- [ ] **Step 5: Commit** `feat(api-index): list every package a new game imports, beta ones marked`.

### Task 5: The published editor starts under any `pnpm-workspace.yaml`

**Files:**
- Modify: `packages/tools/src/features/editor/editor-command.ts` (`repositoryRoot`, `isRepository`, `builtApp`)
- Modify: `tooling/consumer-smoke/tests/e2e/stranger.test.ts` (a step after "install it")
- Test: `packages/tools/tests/unit/editor/editor-command.test.ts`

**Interfaces:**
- Produces: `findRepositoryRoot(start: string, readName: (dir: string) => string | undefined): string | undefined`, the
  nearest folder at or above `start` whose `package.json` `name` is `'automata-framework'`. `isRepository()` is
  `findRepositoryRoot(here, …) !== undefined`. `builtApp('suite-2d')` returns `packedPage()` whenever it exists, before
  any repository lookup.

- [ ] **Step 1: Write the failing tests:**

```ts
it('is not fooled by a pnpm-workspace.yaml or another monorepo', () => {
  const names = { '/home/me/mono': 'my-mono', '/home/me/mono/games/g': 'g' }
  expect(findRepositoryRoot('/home/me/mono/games/g/node_modules/@automata/tools/dist', (d) => names[d])).toBeUndefined()
})
it('finds this repository by its name', () => {
  expect(findRepositoryRoot('/r/packages/tools/src/features/editor', (d) => (d === '/r' ? 'automata-framework' : undefined))).toBe('/r')
})
```

In `stranger.test.ts`, after "install it" (the game folder holds the overrides `pnpm-workspace.yaml`):

```ts
await step('open it in the editor', async () => {
  expect(await fetchEditorPage(join(gameDir, 'node_modules/.bin/automata'), gameDir)).toContain('<html')
})
```

- [ ] **Step 2: Run** `pnpm --filter @automata/tools test editor-command`. Expected: FAIL, `findRepositoryRoot` missing.
- [ ] **Step 3: Implement** as in Interfaces; `repositoryRoot()` uses `findRepositoryRoot` and falls back to today's
  `resolve(here, '../../../..')` only for the error message's path.
- [ ] **Step 4: Run** the unit tests (PASS), then the stranger journey (`pnpm --filter @automata/consumer-smoke test:e2e
  stranger`, or its script name in that package). Expected: the new step passes; record its time.
- [ ] **Step 5: Changeset** (`@automata/tools`) **and commit** `fix(tools): open the packed editor wherever the game is`.

### Task 6: The player collides with the box it is drawn in

**Files:**
- Create (template): `src/features/level/player-box.ts` in `template-level.ts`'s file list
- Modify: `template-game.ts` (`move.system.ts`, `square.view.ts`, `constants.ts` loses `SQUARE_SIZE`, the spawn in
  `src/app/game.ts`, the template's tests), `template-level.ts` (`PlayContent.player`, `walls.ts`),
  `template-story-game.ts` (the same three files, and its `game.ts`)
- Test: `packages/tools/tests/unit/shared/create-game/template-controls.test.ts` (or a new
  `template-player-box.test.ts` that writes a game and runs its tests), plus the new game's own `tests/unit/square/`

**Interfaces:**
- Produces (in the new game): `interface Box { readonly w: number; readonly h: number }`;
  `playerBoxOf(project: ProjectContent): Box` (the `player-start` definition's `size`, which throws a sentence naming
  the definition when it is missing); `PlayContent.player: Box`; `hitsWall(level: Level, x: number, y: number, box: Box):
  boolean` where `(x, y)` is the feet (pivot: the middle of the bottom edge), covering `x - w/2 … x + w/2`, `y - h … y`.
  The square spawns at `LEVEL.start` with no offset; `pictureView(project, 'player-start', images)` takes no offset.

- [ ] **Step 1: Write the failing tests** (template text, run inside a written game by the integration helper):

```ts
it('takes the box from the player start, 16 by 24 in the starter', () =>
  expect(playerBoxOf(project)).toEqual({ w: 16, h: 24 }))
it('touches a wall exactly where the picture does', () => {
  // a wall cell whose left edge is at x = 32: the feet at x = 24 touch it (24 + 16/2 = 32), at 23 they do not
  expect(hitsWall(level, 24.5, 40, { w: 16, h: 24 })).toBe(true)
  expect(hitsWall(level, 23.5, 40, { w: 16, h: 24 })).toBe(false)
})
it('follows a resized player start with no code change', () =>
  expect(playerBoxOf(withPlayerSize(project, 12, 12))).toEqual({ w: 12, h: 12 }))
it('the starter level is still walkable from the start', () => { /* hold each direction for 60 ticks: it moves */ })
```

- [ ] **Step 2: Run** the template test. Expected: FAIL, `playerBoxOf` missing.
- [ ] **Step 3: Implement** in both the 2D and story templates. `src/app/game.ts` passes `{ level, tuning, player:
  playerBoxOf(project) }` as the sim's content (so the content hash covers it). The story's `level2dPlaces` keeps
  `position: { component: Square, x: 'x', y: 'y' }`, now the feet, like the guard's.
- [ ] **Step 4: Run** `create-game.integration.test.ts` (writes a game, installs from the workspace, runs its tests) for
  2D and story. Expected: PASS. The new game's own golden values change with the box; say so in the commit.
- [ ] **Step 5: Changeset and commit** `fix(tools): the starter's player collides with the box it is drawn in`.

### Task 7: The site sends the agent for Automata's skills first

**Files:**
- Modify: `site/src/shared/content/agent-prompt.ts` (`SKILL_PREFLIGHT`, `AGENT_PROMPT`),
  `site/src/features/start/agent-setup.ts` (`AGENT_INSTALL_OPTIONS`), `site/src/features/start/AgentSetup.svelte`,
  `site/src/features/docs/llms.ts`
- Test: `site/tests/unit/` (the existing agent-prompt, agent-setup and llms-txt tests)

**Interfaces:**
- Consumes: Task 1's marketplace (the test reads `agents/automata/.claude-plugin/marketplace.json` for its name).
- Produces: `AUTOMATA_PLUGIN_INSTALL = { claudeCode: ['/plugin marketplace add mcthaydt/automata-skills',
  '/plugin install automata@automata'], other: 'npx skills add https://github.com/mcthaydt/automata-skills' }`.

- [ ] **Step 1: Write the failing tests:**

```ts
it('asks for the Automata skills first and never says stop', () => {
  expect(AGENT_PROMPT.indexOf('automata-skills')).toBeLessThan(AGENT_PROMPT.indexOf('Superpowers'))
  expect(AGENT_PROMPT).not.toMatch(/\bstop\b/i)
})
it('installs the plugin the mirror says it has', () => {
  const { name, plugins } = JSON.parse(read('agents/automata/.claude-plugin/marketplace.json'))
  expect(AUTOMATA_PLUGIN_INSTALL.claudeCode[1]).toBe(`/plugin install ${plugins[0].name}@${name}`)
})
it('Start lists Automata first, then "Also useful"', () => { /* DOM: first heading "Automata's skills", then "Also useful" */ })
it('llms.txt names the plugin', () => expect(llmsTxt()).toContain('/plugin install automata@automata'))
```

- [ ] **Step 2: Run** `pnpm --filter site test`. Expected: FAIL.
- [ ] **Step 3: Implement.** The prompt's preflight: "Install Automata's skills (Claude Code: … ; another agent: …), then
  read this game's AGENTS.md. Superpowers and the PixiJS skills are also useful." Start's setup: Automata first (one
  command block per agent), then "Also useful" with today's Superpowers and PixiJS rows.
- [ ] **Step 4: Run** the site tests and `pnpm --filter site build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(site): send the agent for Automata's own skills first`.

## Phase 2: the first minute (V9, V12, V17)

### Task 8: `create-game` makes a git repository

**Files:**
- Modify: `packages/tools/src/app/cli.ts` (`createGameCommand`, inject `git`), `packages/tools/src/app/help.ts`
  (`--no-git`)
- Test: `packages/tools/tests/unit/app/commands.test.ts`

**Interfaces:**
- Produces: `CliDeps.git: (cwd: string, args: readonly string[]) => Promise<{ code: number } | 'missing'>`; flag `--no-git`.
  Order: `git init`, `git add -A`, `git commit -m "Start <title>"`.

- [ ] **Step 1: Write the failing tests:**

```ts
it('makes a repository with a first commit', async () => {
  const calls = await runCreateGame(['my-game'], { git: ok })
  expect(calls).toEqual([['init'], ['add', '-A'], ['commit', '-m', 'Start My Game']])
})
it('--no-git makes none', async () => expect(await runCreateGame(['my-game', '--no-git'], { git: ok })).toEqual([]))
it('without git it says so and the game is still made', async () => {
  const out = await stdoutOf(['my-game'], { git: async () => 'missing' })
  expect(out).toContain("Git isn't installed, so the game has no history yet.")
})
it('a commit that fails leaves the repository and says how to commit', async () => {
  const out = await stdoutOf(['my-game'], { git: failOn('commit') })
  expect(out).toContain('To save this first version: git add -A && git commit -m "Start"')
})
```

- [ ] **Step 2: Run** `pnpm --filter @automata/tools test commands`. Expected: FAIL.
- [ ] **Step 3: Implement.** The live `git` runs `spawn('git', args, { cwd })`, `'missing'` on `ENOENT`. Not run with
  `--link-workspace` (a game inside this repository is already in one).
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Changeset and commit** `feat(tools): start a new game with its own git history`.

### Task 9: Quiet test runs in a new game

**Files:**
- Modify: `packages/content/src/shared/compile/read-sources.ts` (`isQuietlySkipped`), the template's project files
  (`template-project.ts`, `template-3d.ts`: a `svelte.config.js`)
- Test: `packages/content/tests/unit/shared/compile/read-sources.test.ts`, `template.test.ts`

**Interfaces:**
- Produces: `isQuietlySkipped(name)` is also true for names ending `.af2d.json` or `.af-sector.json`; template file
  `svelte.config.js` with `export default {}`.

- [ ] **Step 1: Write the failing tests:** `read-sources`: a `content/levels/start.af2d.json` next to `start.toml` gives
  no `skippedFile`, and `notes.md` still does. Template: every kind writes `svelte.config.js`.
- [ ] **Step 2: Run** both. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** them, then `pnpm test` in a new game made with `--link-workspace`. Expected: neither
  `skippedFile` nor "no Svelte config found" in the output.
- [ ] **Step 5: Changesets** (`@automata/content`, `@automata/tools`) **and commit** `fix(content,tools): stop two warnings
  every new game prints`.

### Task 10: The try-it's first minute

**Files:**
- Modify: `packages/editor/src/features/suite/shell/SuiteHome.svelte:27` (the note),
  `packages/editor/src/shared/level-2d/profiles/level-project/templates/platformer.ts` (platforms),
  the palette's first selection after a template is chosen (`packages/editor/src/shared/level-2d/tiles/palette-model.ts`
  or its caller), the phone layout of the brush-size control and the title
- Test: `packages/editor/tests/unit/suite/shell/Suite-topbar.test.ts`, the level-project template test, a palette test,
  and a layout test at 390 × 844 in `packages/editor/tests/browser/`; `site/tests/e2e/editor-try.e2e.ts` (the note's words)

**Interfaces:**
- Produces: the note's text "A sample game to try. Make your own with one command." with the command
  `npx @automata/tools create-game my-game` shown under it; `firstBrush(template): Brush` (the template's first IntGrid
  value, else its first tile; never a character).

- [ ] **Step 1: Write the failing tests:** the note text; after choosing Platformer, `firstBrush` is the ground and a tap
  paints ground; the Platformer level has at least three platform runs above the floor; at 390 × 844 the brush-size control's
  right edge is inside the viewport and the title is not cut.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** If #528 has moved the try-it out of the suite first, make the same changes where it moved
  them.
- [ ] **Step 4: Run** the unit and layout tests and the site's try-it e2e. Expected: PASS. Look at a phone screenshot.
- [ ] **Step 5: Commit** `fix(editor): a friendlier first minute in the try-it`.

## Phase 3: the editors hear the extensions, and the whole level shows (V10, V8)

### Task 11: Feel and Audio list the events a game's extensions say

**Files:**
- Modify: `packages/content/src/features/vite/event-ids.ts` (`writeEventIds`), the `package.json` of each extension
  with `.event.ts` files a game can hear (narrative, cutscenes, nav, physics, net, systems if it has any)
- Test: `packages/content/tests/unit/vite/event-ids.test.ts`,
  `tooling/repo-hygiene/tests/unit/extension-manifests.test.ts`

**Interfaces:**
- Produces: `dependencyEventIds(root: string, readJson: (path: string) => unknown): string[]`: for each name in the game's
  `dependencies` and `devDependencies` starting `@automata/`, the `automata.events` array of
  `<root>/node_modules/<name>/package.json`, if any. `writeEventIds` writes the sorted union with the game's own.

- [ ] **Step 1: Write the failing tests:**

```ts
it("adds the events the game's extensions declare", () => {
  const files = { '/g/package.json': { dependencies: { '@automata/narrative': '1' } },
    '/g/node_modules/@automata/narrative/package.json': { automata: { events: ['narrative.line'] } } }
  expect(dependencyEventIds('/g', (p) => files[p])).toEqual(['narrative.line'])
})
// extension-manifests.test.ts
it.each(extensionsWithEvents())('%s declares exactly the events it defines', (dir) =>
  expect(declaredEvents(dir)).toEqual(eventIds(sourcesOf(dir))))
```

- [ ] **Step 2: Run** both. Expected: FAIL.
- [ ] **Step 3: Implement**, and add `automata.events` to each manifest from its `defineEvent` ids.
- [ ] **Step 4: Run** them, then open the story game in the editor: Feel's list has the keeper talking
  (`narrative.line`) and a cutscene starting. Expected: PASS and seen.
- [ ] **Step 5: Changesets** (`@automata/content`, and each published extension touched) **and commit**
  `feat(content): Feel and Audio can answer what extensions say`.

### Task 12: A phone held sideways shows the whole level

**Files:**
- Modify: `packages/automata/src/features/render/letterbox/letterbox.ts` (`layout`, `DEFAULT_BAR_FRACTION = 0`)
- Test: `packages/automata/tests/unit/render/letterbox/letterbox.test.ts`, a real-browser layout test of the 2D template
  or Emberwick at 844 × 390 and 932 × 430 with touch controls on

**Interfaces:**
- Produces: in a non-portrait view, `scale = Math.min(viewWidth / logicalWidth, viewHeight / logicalHeight)`,
  `x = Math.round((viewWidth - width) / 2)`, `y = Math.round((viewHeight - height) / 2)`; `gameplay` is the field's rect;
  side bars fill left and right. Portrait is unchanged.

- [ ] **Step 1: Write the failing tests:**

```ts
it('fits the whole field in a landscape phone', () => {
  const g = new LetterboxFrame({ logicalWidth: 512, logicalHeight: 288 }).layout(844, 390)
  expect(g.height).toBeLessThanOrEqual(390)
  expect(g.gameplay.height).toBeCloseTo(288 * g.scale)
  expect(g.x).toBeGreaterThan(0)
})
it('keeps portrait as it was', () => { /* the existing portrait expectations, unchanged */ })
```

Real browser: no touch control's rect overlaps the field's rect at 932 × 430.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**; side bars use the bar colour.
- [ ] **Step 4: Run** the unit, browser and visual suites. Look at every changed landscape baseline (expected, actual,
  diff) and name each in the commit. Expected: only landscape baselines move.
- [ ] **Step 5: Changeset** (`@automata/framework`) **and commit** `fix(framework): fit the level in a landscape view instead of cropping it`.

## Phase 4: sharing (V11, decision D1 = A)

### Task 13: A guide to put the game on itch.io

**Files:**
- Create: `docs/guides/put-it-on-itch.md` (the site renders guides from `docs/guides/`)
- Modify: `packages/editor/src/features/suite/shell/PublishGameDialog.svelte:50` (the note links to the guide)
- Test: the site's guides test, `packages/editor/tests/unit/suite/shell/Suite-play-publish.test.ts`

- [ ] **Step 1: Write the failing tests:** the guide exists, is titled "Put your game on itch.io" and has four numbered
  steps (make a project, choose HTML, upload the zip, tick "played in the browser"); the dialog's note has a link named
  "How to put it on itch.io".
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Write** the guide (drunk grandma test: one action per step) and the link.
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit** `docs(guides): walk putting a game on itch.io`.

### Task 14: Publish asks where to put the game; itch.io is the first place (D1 = A)

The Owner, 2026-11-08 22:31 (D1 = A) and 22:32: "the zip should be separate from itch, do the zip then ask where they
want, itch will be first output". Spec §11.

**Files:**
- Create: `packages/tools/src/features/editor/places/place.ts` (what a place is, and the list),
  `packages/tools/src/features/editor/places/itch-place.ts`
- Modify: `packages/tools/src/features/editor/publish-game.ts` (unchanged zip step; the zip's path is kept for the
  places), `serve-editor.ts` (`GET /places`, `POST /places/<id>`),
  `packages/tools/src/shared/ship/targets/itch/publish-to-itch.ts` (accept butler's own login when no
  `BUTLER_API_KEY`), `packages/editor/src/features/suite/shell/PublishGameDialog.svelte` (two steps)
- Test: `packages/tools/tests/unit/editor/places/place.test.ts`, `itch-place.test.ts`, `serve-editor.test.ts`,
  `packages/editor/tests/unit/suite/shell/Suite-play-publish.test.ts`, a journey with a fake butler

**Interfaces:**
- Produces:
  - `interface Place { readonly id: string; readonly name: string; readonly asks: readonly PlaceQuestion[]; put(root:
    string, zip: string, answers: Readonly<Record<string, string>>): Promise<PlaceOutcome> }`
  - `interface PlaceQuestion { readonly id: string; readonly label: string; readonly example: string }`
  - `type PlaceOutcome = { ok: true; link: string } | { ok: false; need: string; problem: string; help?: { label: string;
    href: string } }`
  - `PLACES: readonly Place[] = [itchPlace]` (itch.io first; a new place is a new entry here)
  - `itchPlace`: id `itch`, name `itch.io`, asks `{ id: 'page', label: 'Your itch.io page', example:
    'your-name.itch.io/my-game' }`; writes the answer to `ship.config.ts`'s `itch.project` before the push; `need` is one of
    `'butler' | 'sign-in' | 'project' | 'kind'`.
- The dialog: step 1 "Make the zip" (as today, ending on "Download the zip"); step 2 "Where do you want to put it?",
  one 48 px button per place in `PLACES` order, shown only after the zip is made.

- [ ] **Step 1: Write the failing tests:**
  - `place.test.ts`: `PLACES[0].id === 'itch'`; a fake second place added to a test list shows as a second button with no
    dialog change (the dialog renders from `GET /places`).
  - `itch-place.test.ts`: butler missing gives `need: 'butler'` and help "Get itch.io's uploader"; not signed in gives
    `need: 'sign-in'`, and the dialog's "Sign in to itch.io" runs `butler login`; a project that does not exist gives
    `need: 'project'` with a link to make one; success returns `https://your-name.itch.io/my-game`; no key is written
    anywhere (the game folder and the tools' folder are unchanged except `ship.config.ts`).
  - Dialog: the places are not shown before the zip exists; after it, "Download the zip" and "Where do you want to put
    it?" are both on screen; choosing itch.io keeps the zip's download; success shows the link with "Copy link".
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** `itchPlace.put` uses `butlerPath` from `find-executable.ts` and the existing push; the zip
  step is not touched.
- [ ] **Step 4: Run** the tests and the journey. Expected: PASS. A real push needs the Owner's itch.io account; leave
  that gate unchecked and say so.
- [ ] **Step 5: Changeset and commit** `feat(tools): after the zip, Publish asks where to put the game, itch.io first`.

## Phase 5: what the site says (V7, V13, V14)

### Task 15 (after the free web editor work): Say what the product is, with one set of next steps

**Files:**
- Modify: `site/src/features/home/home-content.ts:46,53,106`, `site/src/routes/+page.svelte:8`,
  `site/src/shared/components/PageMeta.svelte:5`, `site/src/features/docs/llms.ts:12,31`,
  `site/src/features/start/start-content.ts` (`STEPS`), `site/src/features/editor/EditorPage.svelte:61`, `README.md` line 1,
  the game README (`targetReadme` in `create-game-targets.ts`)
- Test: the site's home, start, docs and llms tests; `template.test.ts` for the README

- [ ] **Step 1: Write the failing tests:** Home's lead is spec §10's words; no page's promise contains "2D" or "Draw
  levels"; `STEPS` has three steps whose second command is exactly `create-game`'s "Next:" command
  (`cd my-game && pnpm install && pnpm editor`) and whose third names Play and Publish; the game README's first command
  matches.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Write the copy** on the approved v2 layout; no new section.
- [ ] **Step 4: Run** the tests and the site build; look at Home and Start on a phone. Expected: PASS.
- [ ] **Step 5: Commit** `feat(site): say what Automata is for someone making games with an agent`.

### Task 16 (after the DUEL licence answer): Starter art

**Files:** `packages/tools/src/shared/create-game/template-content/assets/starter.png`, the template's `project.toml`
(player, coin, slime and a tile set use it), `template-content.ts`.

- [ ] **Step 1: Write the failing test:** a new game's `player-start`, `slime` and the tile set name frames of
  `assets/starter.png`; every pixel of it is a DUEL colour or transparent.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Add** the sheet from the source the Owner's licence answer allows; keep the player 16 × 24 so Task 6's box
  matches.
- [ ] **Step 4: Run** it and play a new game; look at it. Expected: PASS.
- [ ] **Step 5: Changeset and commit** `feat(tools): a new game starts with pictures, not boxes`.

## Phase 6: tidy-ups and proof (V19, hand-offs, the journey)

### Task 17: Comments in the API say why, not which plan

**Files:**
- Modify: `tooling/check-style/src/plan-comments.ts` (`PLAN_REFERENCE`), root `package.json` `style` script (add
  `packages/editor-3d/src` to `--plan-comments`), the 19 comments it then finds
- Test: `tooling/check-style/tests/unit/plan-comments.test.ts`

- [ ] **Step 1: Write the failing test:** `PLAN_REFERENCE` matches "(plan D-2)", "(plan 16.2)" and "plan ED3D.5c", and
  not "a plan", "the plan's".
- [ ] **Step 2: Run** it. Expected: FAIL on "plan D-2".
- [ ] **Step 3: Add** `String.raw\`\b[Pp]lan\s+(?:[A-Z]{1,4}[.-]?\d|\d)\`` and fix each comment it finds: say the reason in words.
- [ ] **Step 4: Run** `pnpm style`, then `pnpm build && pnpm api-index --write && pnpm agent-skills --write`. Expected:
  PASS, and `api.md` has no "plan D-".
- [ ] **Step 5: Changesets and commit** `docs: comments in the API say why, not which plan`.

### Task 18: The customer journey again, and the hand-offs

- [ ] **Step 1:** Check each hand-off in spec §12 against its acceptance line, on the newest stack head. Record each as
  met, or as still open with its thread.
- [ ] **Step 2:** Run spec §13's journey as the launch customer: `pnpm build`, pack, install in a scratch folder outside
  the workspace, `create-game`, open Claude Code in the folder (scratch config) and confirm it offers the plugin from
  `.claude/settings.json`; give a fresh agent the site's copied prompt and "add coins I can place and a score"; place two
  coins in Levels, tune the speed in the Tuner, play (the coin is picked up where the picture touches it), reload, close
  and reopen the editor (the work is there), Publish (the zip plays), then choose itch.io under "Where do you want to put it?" for a test page if the Owner
  provides one. Keep each step's screen in `refactor/2026-11-08-customer-value-screens/` in the shared folder.
- [ ] **Step 3:** Record what ran and what did not (WebKit, Firefox, a real iPad) in this plan's log and in
  `docs/refactor/progress.md`.

---

## Log

- 2026-11-08: spec and plan written (stage 2). Tasks 15 and 16 wait as stated in Base.
- 2026-11-08 22:31: the Owner answered D1 = A ("Put it on itch.io"). Task 14 no longer waits; spec §11 updated.
- 2026-11-08 22:32: the Owner: the zip is its own step, then Publish asks where to put the game, itch.io first. Task 14
  and spec §11 reshaped: a list of places, so more can be added.
