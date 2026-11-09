# Site copy from the GTM research: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking. Native execution, no subagents (project rule).

**Goal:** Rewrite the site's words, and the Home page's order, so the site sells to the buyer the GTM research picked.

**Architecture:** Copy lives in `*-content.ts` files and a few page components. Prices move to one shared file so Home
and `/app` read the same numbers. Two new Home sections (`HomeBuiltIn`, `HomePricing`); no route is added or removed.

**Tech Stack:** SvelteKit, Vitest with Testing Library, Playwright.

**Spec:** the GTM research, `/mnt/project-files/gtm/2026-11-08-automata-gtm-research.md` (sections 0, 10 round 4 and 11),
plus the Owner's rulings below.

## Global Constraints

- Buyer: solo makers who use Claude Code, Cursor or Codex, have made a browser game with it and have not finished one.
- The pain, in order: the demo is not a game yet (saves, menus, settings, touch); the agent breaks what worked; getting it
  in front of players; a partner who doesn't code can't change it; agent cost.
- Headline: "Finish the game your agent started." (Owner rejected "Your agent makes the fun part. Automata is the rest.",
  2026-11-08 23:11; options on a decision card; the headline is one constant, `HERO.title`, so a different pick is one line.)
- "No credits, ever." Every editor is free on the web; sync with Sign in with GitHub is free; only the downloaded app is
  paid, once: $19.99 phone and tablet, $39.99 computer. MCP is in the apps only, and later.
- Publishing makes a zip, then offers itch.io.
- Never say "deterministic", "ECS" or "no-code" in marketing copy (llms.txt and docs may). Never name FigureBuilder or
  EnvironmentBuilder. Never say "open source" while `REPOSITORY_PUBLIC` is false (say "MIT licensed").
- Every line passes the drunk grandma test: short sentences, one idea each, says what happens and what to press.
- Footer address: hello@automataframework.com (unchanged).
- Copy only: no style, motion or layout system changes (the animations thread owns those). New sections reuse
  `home.css` classes.

## Review Focus

1. A claim the framework does not back (each built-in item maps to a module in `packages/automata/src`; see Task 2).
2. "Open source" on Home while the repository is private: the existing Home test forbids it; keep it.
3. Two prices drifting between Home and `/app`: one source, `shared/content/pricing.ts`, tested.
4. More than one lime button on Home: the new Pricing section uses `home-secondary` links only.
5. A phone at 390 px: new sections use the existing `home-section`/`page-wrap` grid, checked in the Chromium visitor suite.

---

### Task 1: One source for prices

**Files:** Create `site/src/shared/content/pricing.ts`; modify `site/src/features/app/app-offer.ts`; test
`site/tests/unit/app/app-page.test.ts` (existing).

- [ ] `APP_PRICES = { phone: '$19.99', computer: '$39.99' } as const` and `NO_CREDITS = 'No credits, ever.'`;
      `APP_OFFER` reads its prices from it. Existing price assertions still pass.

### Task 2: Home copy and order

**Files:** modify `home-content.ts`, `Home.svelte`, `HomeHero.svelte`, `HomeTargets.svelte`, `HomeDeterminism.svelte`,
`HomeEditor.svelte`, `HomeFacts.svelte`, `routes/+page.svelte`; create `HomeBuiltIn.svelte`, `HomePricing.svelte`; test
`tests/unit/home/home.test.ts`, `tests/e2e/visitor.e2e.ts`.

- [ ] Tests first: h1 is `HERO.title`; order is Hero, Facts, MadeWith, BuiltIn, Code, Determinism, Editor, Targets,
      Pricing, Examples, Changelog, Start; Pricing shows both `APP_PRICES` and `NO_CREDITS`; no "deterministic" in Home's
      text; still one lime primary.
- [ ] Built-in list, each backed by code: saves (`features/saves`), title, pause and settings screens (`app/screens`),
      keyboard, touch and gamepad with rebinding (`features/input`), music and sound with volume (`features/audio`),
      languages (`features/locale`), every screen size (`features/display`, `render/letterbox`).

### Task 3: Other pages

**Files:** `AppPage.svelte` (now titled Pricing), `EditorPage.svelte`, `Start.svelte`, `start-content.ts`,
`Header.svelte` (Pricing replaces Reference; Reference stays in the footer), `Footer.svelte`, `features/docs/llms.ts`;
tests `tests/unit/app`, `tests/unit/shared/components.test.ts`, `tests/unit/docs/llms-txt.test.ts`.

### Task 4: Marketing plan and announcement posts

Claude Docs for the Owner (not in the repository): the marketing strategy plan and the launch posts (Show HN,
r/aigamedev, r/vibecoding, X thread, itch.io devlog, email), each grandma-tested and held to what ships.

### Task 5: Gates

`pnpm --filter site test:unit`, `svelte-check`, `check:site`, lint and format; Chromium visitor and Home e2e. Update
`progress.md` and project memory.

## Log

- 2026-11-08: plan written; headline A taken as the default while the Owner picks.
- 2026-11-08: Tasks 1 to 5 done. Stacked on #520, not #539 (#539 sits on an older #520 and still has the pre-21:25
  app offer); this branch leaves `agent-prompt.ts` and `AgentSetup` alone so #539 merges on top cleanly.
