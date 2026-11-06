# Automata Framework Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, high-craft developer website for Automata Framework located in `automata_website`, featuring Raylib-inspired feature parity (interactive hero demo, split-view examples gallery with canonical headers, searchable API cheatsheet, game showcase, and spartan docs synced from `../automata-framework/docs/`) styled as a minimalistic SF developer startup.

**Architecture:** Built with SvelteKit and Svelte 5, Tailwind CSS v4 for minimalist dark tokens, and `@sveltejs/adapter-static` for static site generation. Demos run inside isolated, sandboxed iframes driven by a pre-built static demo catalog synced from `../automata-framework`, ensuring bulletproof WebGL lifecycle isolation and independent CI deployment.

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vite, Tailwind CSS v4, Lucide Icons (`lucide-svelte`), Shiki, Zod, Vitest, `@testing-library/svelte`.

**Spec:** [`docs/superpowers/specs/2026-10-14-automata-website-design.md`](docs/superpowers/specs/2026-10-14-automata-website-design.md)

---

## Global Constraints

- **Location:** Project files reside in `/Users/mcthaydt/Developer/Business/Automata/automata_website`.
- **Independence:** The website must build and deploy completely independently as a standalone repository without requiring monorepo workspace links in CI.
- **Framework & Runtime:** SvelteKit with Svelte 5 and `@sveltejs/adapter-static` (zero Node runtime dependencies in production build).
- **Styling:** Tailwind CSS v4 with neutral dark theme (`#09090b` background, `#121215` card surfaces, `border-white/10` hairline borders) and Endesga 64 accents.
- **Security:** CSP-safe; zero `unsafe-eval` usage in application code.

## Review Focus

1. **Docs source file resolution:** When reading markdown files from `../../docs/`, Vite/Node filesystem loaders must handle relative paths cleanly during dev and prerendering. (Tested in Task 8)
2. **Cheatsheet search with regex / special characters (`(`, `*`, `[]`, `<>`):** Fuzzy search must sanitize input and never throw `SyntaxError: Invalid regular expression`. (Tested in Task 6)
3. **Rapid example switching:** Switching between examples quickly must cleanly reset the iframe player and source code viewer to the selected demo without race conditions or memory leaks. (Tested in Task 5)
4. **Mobile layout responsiveness (780×270 & small portrait):** The Examples Gallery must stack vertically with a fixed-height interactive player on top and scrollable code beneath. (Tested in Task 5)
5. **Cheatsheet copy interaction:** Clicking "Copy signature" or code snippet must show transient visual confirmation ("Copied!") and fallback gracefully if clipboard permissions are restricted. (Tested in Task 3 & 6)

---

## File Structure

```
website/
├── package.json
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── app.html
│   ├── app.css
│   ├── data/
│   │   ├── cheatsheet.ts           # Curated API reference with Zod validation
│   │   ├── cheatsheet.test.ts
│   │   ├── demos.ts                # Demos catalog imported from examples/gallery
│   │   ├── showcase.ts             # Showcase games (Emberwick, FloorFifty, Last Light)
│   │   └── docs-loader.ts          # Markdown reader for framework docs/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Header.svelte       # Top navigation, logo, star badge, search trigger
│   │   │   ├── Footer.svelte       # Minimalist footer with platform links
│   │   │   ├── BentoGrid.svelte    # Bento feature container & cards
│   │   │   ├── CodeBlock.svelte    # Shiki syntax highlighted code viewer with copy
│   │   │   ├── TerminalBox.svelte  # CLI command box with copy button
│   │   │   ├── CommandMenu.svelte  # Cmd+K global search palette
│   │   │   └── DemoRunner.svelte   # Sandboxed iframe player with Restart/Fullscreen
│   │   └── utils/
│   │       ├── highlight.ts        # Shiki code highlighting helper
│   │       └── search.ts           # Cheatsheet & docs search utility
│   └── routes/
│       ├── +layout.svelte          # Root layout with Header, Footer, and CommandMenu
│       ├── +layout.ts              # Prerender = true
│       ├── +page.svelte            # Homepage: Hero, Bento features, 50-line code, CTA
│       ├── examples/
│       │   ├── +page.svelte        # Raylib-style split-screen demo runner & code viewer
│       │   └── [slug]/+page.svelte # Direct permalink to specific example
│       ├── cheatsheet/
│       │   └── +page.svelte        # Searchable interactive API reference
│       ├── showcase/
│       │   └── +page.svelte        # Games showcase with playable Emberwick modal
│       └── docs/
│           ├── +page.svelte        # Spartan documentation reader
│           └── [slug]/+page.svelte # Individual framework doc reader (overview, laws, etc.)
└── static/
    ├── favicon.svg
    └── images/                     # Game banners, poster art
```

---

### Task 1: Monorepo Workspace Integration & Scaffolding

**Files:**
- Modify: `pnpm-workspace.yaml` (add `website`)
- Create: `website/package.json`
- Create: `website/svelte.config.js`
- Create: `website/vite.config.ts`
- Create: `website/tsconfig.json`
- Create: `website/src/app.html`
- Create: `website/src/app.css`
- Create: `website/src/routes/+layout.svelte`
- Create: `website/src/routes/+layout.ts`
- Test: `website/tests/scaffold.test.ts`

**Interfaces:**
- Produces: Runnable SvelteKit application integrated into `pnpm-workspace.yaml`, configured with Svelte 5, Tailwind CSS v4, `@sveltejs/adapter-static`, and Vitest.

- [ ] **Step 1: Write the failing scaffold test**

```typescript
// website/tests/scaffold.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Website Monorepo Workspace Integration', () => {
  it('has package.json with svelte 5 and adapter-static', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))
    expect(pkg.name).toBe('@mcthaydt/automata-website')
    expect(pkg.devDependencies).toHaveProperty('@sveltejs/adapter-static')
    expect(pkg.devDependencies).toHaveProperty('svelte')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-website test tests/scaffold.test.ts`
Expected: FAIL (package not registered or file not found)

- [ ] **Step 3: Add `website` to `pnpm-workspace.yaml` and scaffold `website/`**

Update `pnpm-workspace.yaml` to include `website`. Create `website/package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/app.css`, and layout files. Run `pnpm install`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-website test tests/scaffold.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml website/
git commit -m "chore(website): scaffold automata website workspace app"
```

---

### Task 2: Demos Catalog & Raylib Header Ingestion

**Files:**
- Create: `website/src/data/demos.ts`
- Test: `website/tests/demos.test.ts`

**Interfaces:**
- Consumes: `examples/gallery/src/demos.ts` and `examples/*/*/src/main.ts`.
- Produces: `DEMOS_CATALOG` array with parsed canonical Raylib headers (`Shows:`, `Controls:`, `Base:`, `Packages:`) and raw source code for Shiki.

- [ ] **Step 1: Write failing test for demos catalog**

```typescript
// website/tests/demos.test.ts
import { describe, it, expect } from 'vitest'
import { getDemosCatalog } from '../src/data/demos'

describe('Demos Catalog', () => {
  it('loads all gallery demos with raylib headers and source code', () => {
    const catalog = getDemosCatalog()
    expect(catalog.length).toBeGreaterThan(0)
    for (const demo of catalog) {
      expect(demo.path).toBeDefined()
      expect(demo.title).toBeDefined()
      expect(demo.shows).toBeDefined()
      expect(demo.packages).toBeInstanceOf(Array)
      expect(demo.sourceCode.length).toBeGreaterThan(20)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-website test tests/demos.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `website/src/data/demos.ts`**

Import `DEMOS` from `examples/gallery/src/demos.ts`. Load each demo's `main.ts` file via Node `fs` or Vite `?raw` imports, extract Raylib headers, and export `getDemosCatalog()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-website test tests/demos.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add website/src/data/demos.ts website/tests/demos.test.ts
git commit -m "feat(website): implement demos catalog loader with raylib header parser"
```

---

### Task 3: Shared SF-Minimalist UI Components

**Files:**
- Create: `website/src/lib/components/Header.svelte`
- Create: `website/src/lib/components/Footer.svelte`
- Create: `website/src/lib/components/BentoGrid.svelte`
- Create: `website/src/lib/components/CodeBlock.svelte`
- Create: `website/src/lib/components/TerminalBox.svelte`
- Create: `website/src/lib/components/CommandMenu.svelte`
- Create: `website/src/lib/utils/highlight.ts`
- Test: `website/tests/components.test.ts`

**Interfaces:**
- Produces: Reusable UI primitives with dark-mode styling, hairline borders (`border-white/10`), Shiki syntax highlighting, and `Cmd+K` navigation.

- [ ] **Step 1: Write failing tests for UI components**

```typescript
// website/tests/components.test.ts
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import TerminalBox from '../src/lib/components/TerminalBox.svelte'

describe('TerminalBox', () => {
  it('renders command text and copy button', () => {
    const { getByText, getByRole } = render(TerminalBox, { command: 'npx automata create-game' })
    expect(getByText('npx automata create-game')).toBeTruthy()
    expect(getByRole('button', { name: /copy/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-website test tests/components.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement components in `website/src/lib/components/`**

Build:
- `Header.svelte`: Navigation (Overview, Examples, Cheatsheet, Showcase, Docs), version badge, GitHub link, `Cmd+K` trigger.
- `Footer.svelte`: Minimalist credits, license status, GitHub and Discord links.
- `BentoGrid.svelte`: Bento container and card components with hairline borders and subtle glow.
- `CodeBlock.svelte`: Shiki syntax highlighter with copy button and badge.
- `TerminalBox.svelte`: Command line box with instant copy and transient visual confirmation.
- `CommandMenu.svelte`: Search modal with keyboard shortcuts.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-website test tests/components.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add website/src/lib/ website/tests/components.test.ts
git commit -m "feat(website): add SF-minimalist UI components, Shiki highlighter, and command palette"
```

---

### Task 4: Hero & Homepage (`/`)

**Files:**
- Create: `website/src/routes/+page.svelte`
- Test: `website/tests/homepage.test.ts`

**Interfaces:**
- Produces: Primary landing page featuring value proposition, quickstart terminal box, live hero demo canvas, bento grid of core pillars, and 50-line spartan game walkthrough.

- [ ] **Step 1: Write failing tests for Homepage**

```typescript
// website/tests/homepage.test.ts
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import Page from '../src/routes/+page.svelte'

describe('Homepage', () => {
  it('renders value proposition, terminal quickstart, and feature pillars', () => {
    const { getByText } = render(Page)
    expect(getByText(/The deterministic game framework/i)).toBeTruthy()
    expect(getByText(/npx automata create-game/i)).toBeTruthy()
    expect(getByText(/Pure Determinism/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-website test tests/homepage.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `website/src/routes/+page.svelte`**

Compose Hero, live canvas embed (`DemoRunner`), Bento feature pillars (Sim, Render-Pixi, Effect Runtime, UI, Content), and the 50-line Spartan game walkthrough.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-website test tests/homepage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add website/src/routes/+page.svelte website/tests/homepage.test.ts
git commit -m "feat(website): implement homepage with hero demo, bento grid, and quickstart"
```

---

### Task 5: Interactive Examples Gallery (`/examples`)

**Files:**
- Create: `website/src/lib/components/DemoRunner.svelte`
- Create: `website/src/routes/examples/+page.svelte`
- Create: `website/src/routes/examples/[slug]/+page.svelte`
- Test: `website/tests/examples.test.ts`

**Interfaces:**
- Consumes: `getDemosCatalog()` from Task 2.
- Produces: Split-screen gallery with module filter sidebar, sandboxed iframe player (Restart, Fullscreen, Open in Tab), fallback error overlay on load failure, and Shiki code viewer with Raylib headers.

- [ ] **Step 1: Write failing tests for Examples Gallery**

```typescript
// website/tests/examples.test.ts
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import ExamplesPage from '../src/routes/examples/+page.svelte'
import DemoRunner from '../src/lib/components/DemoRunner.svelte'

describe('Examples Gallery', () => {
  it('renders category filter and active demo code', () => {
    const { getByText } = render(ExamplesPage)
    expect(getByText(/All Examples/i)).toBeTruthy()
  })

  it('renders fallback error overlay on demo load failure', () => {
    const { getByTestId } = render(DemoRunner, { src: '/invalid-demo' })
    expect(getByTestId('demo-runner-container')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-website test tests/examples.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `DemoRunner.svelte` and `website/src/routes/examples/+page.svelte`**

Build split-screen layout with iframe runner and sticky controls, canonical Raylib header badges, copy snippet action, and vertical mobile stacking.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-website test tests/examples.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add website/src/lib/components/DemoRunner.svelte website/src/routes/examples/ website/tests/examples.test.ts
git commit -m "feat(website): implement raylib-style split-view examples gallery"
```

---

### Task 6: Interactive API Cheatsheet (`/cheatsheet`)

**Files:**
- Create: `website/src/data/cheatsheet.ts`
- Create: `website/src/routes/cheatsheet/+page.svelte`
- Test: `website/tests/cheatsheet.test.ts`

**Interfaces:**
- Produces: Interactive API cheatsheet covering all 7 packages (`sim`, `runtime`, `render-pixi`, `physics`, `ui`, `host`, `content`) with regex-safe fuzzy search (Review Focus 2) and instant copy.

- [ ] **Step 1: Write failing tests for Cheatsheet**

```typescript
// website/tests/cheatsheet.test.ts
import { describe, it, expect } from 'vitest'
import { CHEATSHEET_MODULES, searchCheatsheet } from '../src/data/cheatsheet'

describe('Cheatsheet Data & Search', () => {
  it('covers all 7 framework modules', () => {
    const moduleNames = CHEATSHEET_MODULES.map(m => m.name)
    expect(moduleNames).toContain('@mcthaydt/automata-sim')
    expect(moduleNames).toContain('@mcthaydt/automata-runtime')
    expect(moduleNames).toContain('@mcthaydt/automata-render-pixi')
    expect(moduleNames).toContain('@mcthaydt/automata-physics')
    expect(moduleNames).toContain('@mcthaydt/automata-ui')
    expect(moduleNames).toContain('@mcthaydt/automata-host')
    expect(moduleNames).toContain('@mcthaydt/automata-content')
  })

  it('safely handles search query with special regex characters', () => {
    expect(() => searchCheatsheet('createSim(')).not.toThrow()
    expect(() => searchCheatsheet('[tag]')).not.toThrow()
    expect(() => searchCheatsheet('*')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-website test tests/cheatsheet.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `website/src/data/cheatsheet.ts` and `website/src/routes/cheatsheet/+page.svelte`**

Define structured data covering all 7 packages. Implement regex-safe search. Build cheatsheet page with `/` shortcut focus, sticky module filter, signature cards, and copy buttons.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-website test tests/cheatsheet.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add website/src/data/cheatsheet.ts website/src/routes/cheatsheet/ website/tests/cheatsheet.test.ts
git commit -m "feat(website): implement interactive api cheatsheet with regex-safe search"
```

---

### Task 7: Showcase Page (`/showcase`)

**Files:**
- Create: `website/src/data/showcase.ts`
- Create: `website/src/routes/showcase/+page.svelte`
- Test: `website/tests/showcase.test.ts`

**Interfaces:**
- Produces: Raylib-style games showcase with playable Emberwick modal, tech breakdown drawers, and links for FloorFifty and The Last Light.

- [ ] **Step 1: Write failing tests for Showcase**

```typescript
// website/tests/showcase.test.ts
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import ShowcasePage from '../src/routes/showcase/+page.svelte'

describe('Showcase Page', () => {
  it('renders Emberwick, FloorFifty, and The Last Light cards', () => {
    const { getByText } = render(ShowcasePage)
    expect(getByText(/Emberwick/i)).toBeTruthy()
    expect(getByText(/FloorFifty/i)).toBeTruthy()
    expect(getByText(/The Last Light/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-website test tests/showcase.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `website/src/data/showcase.ts` and `website/src/routes/showcase/+page.svelte`**

Build showcase cards with platform tags (Web, Ruken, Desktop), screenshots/posters, technical highlight bullets, and playable iframe modal for Emberwick.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-website test tests/showcase.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add website/src/data/showcase.ts website/src/routes/showcase/ website/tests/showcase.test.ts
git commit -m "feat(website): implement games showcase with playable emberwick modal"
```

---

### Task 8: Spartan Docs & Architecture Guide (`/docs`)

**Files:**
- Create: `website/src/data/docs-loader.ts`
- Create: `website/src/routes/docs/+page.svelte`
- Create: `website/src/routes/docs/[slug]/+page.svelte`
- Test: `website/tests/docs.test.ts`

**Interfaces:**
- Consumes: Markdown documentation from `docs/` (`00-overview.md`, `01-decomposition.md`, `04-how-we-build.md`).
- Produces: Clean, spartan developer documentation reader with sidebar navigation and on-this-page table of contents.

- [ ] **Step 1: Write failing tests for Docs loader and route**

```typescript
// website/tests/docs.test.ts
import { describe, it, expect } from 'vitest'
import { getDocSections } from '../src/data/docs-loader'

describe('Docs Loader', () => {
  it('loads core documentation sections from monorepo docs/', () => {
    const sections = getDocSections()
    expect(sections.length).toBeGreaterThan(0)
    const titles = sections.map(s => s.title)
    expect(titles).toContain('Overview')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mcthaydt/automata-website test tests/docs.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `website/src/data/docs-loader.ts` and `website/src/routes/docs/`**

Read documentation markdown from `docs/`, parse headings and frontmatter, and render through a clean reader with Shiki syntax highlighting.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mcthaydt/automata-website test tests/docs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add website/src/data/docs-loader.ts website/src/routes/docs/ website/tests/docs.test.ts
git commit -m "feat(website): implement spartan docs reader sourcing from monorepo docs/"
```

---

### Task 9: Static Build, Prerender & Verification Gate

**Files:**
- Modify: `website/package.json` (verify scripts `check`, `build`, `test`)
- Test: Full static build output in `website/build/`

**Interfaces:**
- Produces: Verified production static output (`website/build/`) with zero prerender errors, clean typecheck, and all passing unit tests.

- [ ] **Step 1: Verify test suite passes**

Run: `pnpm --filter @mcthaydt/automata-website test`
Expected: All tests pass (0 failures).

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @mcthaydt/automata-website check`
Expected: Clean with 0 type errors.

- [ ] **Step 3: Run static prerender build**

Run: `pnpm --filter @mcthaydt/automata-website build`
Expected: Static build completes successfully, generating `build/index.html`, `build/examples/index.html`, `build/cheatsheet/index.html`, `build/showcase/index.html`, `build/docs/index.html`.

- [ ] **Step 4: Commit**

```bash
git add website/
git commit -m "chore(website): verify static prerender build and test gates"
```
