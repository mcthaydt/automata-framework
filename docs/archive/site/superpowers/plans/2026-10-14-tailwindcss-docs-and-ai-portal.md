# Tailwind CSS-Inspired Docs & PixiJS-Style AI Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Automata Framework documentation into a Tailwind CSS-inspired 3-column layout (`/docs` and `/docs/[slug]`) and build a top-level PixiJS-inspired AI portal (`/ai` with `static/llms.txt` and `static/llms-full.txt`).

**Architecture:** Extend SvelteKit static prerendering with multi-page canonical routes (`/docs/[slug]`). Upgrade documentation data into 8 rich technical categories with TOC metadata, real-time sidebar search, callout banners, and Shiki code blocks. Generate automated `llms.txt` and `llms-full.txt` files at build time and host an interactive `/ai` skills hub for AI coding agents.

**Tech Stack:** SvelteKit 2, Svelte 5, Tailwind CSS v4, Shiki, Lucide Svelte, @sveltejs/adapter-static, Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-14-tailwindcss-docs-and-ai-portal-design.md`](file:///Users/mcthaydt/Developer/Business/Automata/automata_website/docs/superpowers/specs/2026-10-14-tailwindcss-docs-and-ai-portal-design.md)

---

## Global Constraints

- Standalone project strictly within `/Users/mcthaydt/Developer/Business/Automata/automata_website`.
- Do not modify files in the sibling `/Users/mcthaydt/Developer/Business/Automata/automata-framework` repository.
- Must produce static prerender output in `build/` using `@sveltejs/adapter-static` with zero 404 warnings.
- Dark monochrome SF-developer aesthetic (`#09090b` background, `#121215` cards, hairline borders, Endesga 64 accents).
- Strict zero-eval CSP compliance: no `eval`, `new Function`, or dynamic code execution in client code.

---

## Review Focus

1. **`llms.txt` Standard Compliance:** Conforms strictly to the `llmstxt.org` format with `# Title`, blockquote description, and `[Title](url): Description` links.
2. **Regex-Safe Docs Search Filter:** Special characters like `(`, `*`, `[`, `?` typed into the docs sidebar search input must not trigger runtime `SyntaxError`.
3. **Static Prerender Entry Resolution:** SvelteKit `entries()` in `src/routes/docs/[slug]/+page.ts` must emit all 8 canonical slugs so `pnpm build` creates all HTML pages without 404s.
4. **Mobile Responsive 3-Column Layout:** The left sidebar and right TOC gracefully collapse on viewports `< 1024px` with a drawer toggle, preventing horizontal scroll blowout.
5. **Shiki Tokenizer Fallback:** Any code block with unrecognized or missing language syntax must safely fall back to escaped plain text without crashing the page.

---

### Task 1: Documentation Data & Automated `llms.txt` Generation

**Files:**
- Modify: `scripts/sync-docs.ts`
- Modify: `src/data/docs.json`
- Create: `static/llms.txt`
- Create: `static/llms-full.txt`
- Test: `tests/llms-txt.test.ts`

**Interfaces:**
- Produces:
  - `src/data/docs.json` containing 8 comprehensive categories:
    1. `overview` (Overview & Vision)
    2. `quick-start` (Quick Start)
    3. `sim-ecs` (ECS Simulation & Determinism)
    4. `render-pixi` (PixiJS 2D Presentation)
    5. `effect-runtime` (Effect Runtime & Concurrency)
    6. `security-csp` (Zero-Eval CSP & Ruken Security)
    7. `mobile-ui` (Mobile UI Primitives)
    8. `ai-rules` (AI Coding Agent Rules)
  - `static/llms.txt` and `static/llms-full.txt`.

- [ ] **Step 1: Write failing test for `llms.txt` and `docs.json`**

```typescript
// tests/llms-txt.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('LLMs.txt & Docs Pipeline', () => {
  it('generates llms.txt matching llmstxt.org specification', () => {
    const filePath = resolve(__dirname, '../static/llms.txt')
    expect(existsSync(filePath)).toBe(true)
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('# Automata Framework')
    expect(content).toContain('> Automata is a deterministic')
    expect(content).toContain('## Documentation')
    expect(content).toContain('- [Overview & Vision](/docs/overview)')
    expect(content).toContain('- [AI Coding Agent Rules](/docs/ai-rules)')
  })

  it('generates llms-full.txt with 5 Golden Rules and full markdown', () => {
    const filePath = resolve(__dirname, '../static/llms-full.txt')
    expect(existsSync(filePath)).toBe(true)
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('The 5 Golden Rules for LLMs')
    expect(content).toContain('Sub-tick alpha interpolation')
    expect(content).toContain('Zero Eval')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/llms-txt.test.ts --run`  
Expected: FAIL (`static/llms.txt` not found).

- [ ] **Step 3: Update `scripts/sync-docs.ts` and generate docs & llms text files**

Expand `scripts/sync-docs.ts` to include all 8 complete guide sections with headings, callouts, and code samples, and generate `src/data/docs.json`, `static/llms.txt`, and `static/llms-full.txt`. Run `npx tsx scripts/sync-docs.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/llms-txt.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-docs.ts src/data/docs.json static/llms.txt static/llms-full.txt tests/llms-txt.test.ts
git commit -m "feat(docs): expand 8 doc sections and generate static llms.txt endpoints"
```

---

### Task 2: PixiJS-Inspired AI Portal (`/ai`)

**Files:**
- Create: `src/routes/ai/+page.svelte`
- Test: `tests/ai-page.test.ts`

**Interfaces:**
- Produces:
  - Top-level `/ai` route inspired by `pixijs.com/llms`.
  - Agent switcher tabs (Skills CLI, Claude Code, Cursor, Windsurf, Antigravity) with clipboard copy.
  - "The 5 Golden Laws for LLMs" anti-hallucination interactive cards with code snippets.
  - Pre-crafted copyable Prompt Templates (New 2D Game, Custom PixiJS View, Deterministic ECS System, Zero-Eval Shader).
  - Quick links to `/llms.txt` and `/llms-full.txt`.

- [ ] **Step 1: Write failing test for `/ai` route**

```typescript
// tests/ai-page.test.ts
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AiPage from '../src/routes/ai/+page.svelte'

describe('AI & LLMs Page', () => {
  it('renders hero title and agent installation tabs', () => {
    const { getByText, getAllByText } = render(AiPage)
    expect(getByText(/Automata AI & Agent Skills/i)).toBeTruthy()
    expect(getAllByText(/Claude Code/i).length).toBeGreaterThan(0)
    expect(getAllByText(/Cursor/i).length).toBeGreaterThan(0)
  })

  it('renders the 5 Golden Laws for LLMs', () => {
    const { getByText } = render(AiPage)
    expect(getByText(/The 5 Golden Rules for LLMs/i)).toBeTruthy()
    expect(getByText(/Sub-tick Interpolation/i)).toBeTruthy()
    expect(getByText(/Zero Eval CSP/i)).toBeTruthy()
  })

  it('provides links to plain-text llms.txt endpoints', () => {
    const { getByRole } = render(AiPage)
    expect(getByRole('link', { name: /view llms\.txt/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/ai-page.test.ts --run`  
Expected: FAIL (`Cannot find module '../src/routes/ai/+page.svelte'`).

- [ ] **Step 3: Implement `src/routes/ai/+page.svelte`**

Build the PixiJS-inspired AI portal with agent tabs, interactive clipboard copy, 5 Golden Rules visual cards, pre-crafted prompt templates, and plain-text links.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/ai-page.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/ai/+page.svelte tests/ai-page.test.ts
git commit -m "feat(ai): implement pixijs-inspired ai & agent skills portal"
```

---

### Task 3: Global Navigation & Command Menu Integration

**Files:**
- Modify: `src/lib/components/Header.svelte`
- Modify: `src/lib/components/CommandMenu.svelte`
- Modify: `src/lib/components/Footer.svelte`
- Modify: `tests/components.test.ts`

**Interfaces:**
- Updates `Header.svelte` with `AI` navigation item and sparkle badge.
- Updates `CommandMenu.svelte` with AI quick-copy actions and docs deep links.
- Updates `Footer.svelte` with AI & LLMs column.

- [ ] **Step 1: Write failing test in `tests/components.test.ts`**

```typescript
// tests/components.test.ts
it('renders AI link in navigation header', () => {
  const { getByRole } = render(Header)
  expect(getByRole('link', { name: /AI/i })).toBeTruthy()
})

it('includes AI portal link in footer', () => {
  const { getByRole } = render(Footer)
  expect(getByRole('link', { name: /AI & Skills/i })).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components.test.ts --run`  
Expected: FAIL (link with name `/AI/i` not found).

- [ ] **Step 3: Update `Header.svelte`, `CommandMenu.svelte`, and `Footer.svelte`**

Add `/ai` to navigation links with badge, register AI actions in `CommandMenu`, and add "AI & LLMs" column in `Footer`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Header.svelte src/lib/components/CommandMenu.svelte src/lib/components/Footer.svelte tests/components.test.ts
git commit -m "feat(nav): integrate AI portal into header, command menu, and footer"
```

---

### Task 4: Tailwind CSS-Inspired 3-Column Docs Page (`/docs`)

**Files:**
- Modify: `src/data/docs-loader.ts`
- Modify: `src/routes/docs/+page.svelte`
- Create: `tests/docs-tailwind.test.ts`

**Interfaces:**
- Consumes: `getDocSections()`, `getDocCategories()` from `src/data/docs-loader.ts`.
- Produces:
  - Responsive 3-column layout:
    - Left Sidebar (col-span-3): Instant regex-safe search filter with `/` shortcut, category groups, active item border indicator, version badges, mobile drawer button.
    - Center Canvas (col-span-6): Breadcrumb, section eyebrow, prose typography, copyable code blocks with Shiki, parameter tables, styled callout boxes (`Tip`, `Note`, `Important`, `CSP Violation`).
    - Right Sidebar (col-span-3): Sticky "On this page" TOC tracking active heading anchors, quick GitHub/community links.

- [ ] **Step 1: Write failing test for Tailwind docs features**

```typescript
// tests/docs-tailwind.test.ts
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import DocsPage from '../src/routes/docs/+page.svelte'

describe('Tailwind-Inspired Docs Page', () => {
  it('renders 3-column structure: categories, content, and on-this-page toc', () => {
    const { getByText, getByPlaceholderText } = render(DocsPage)
    expect(getByPlaceholderText(/Search docs.../i)).toBeTruthy()
    expect(getByText(/On this page/i)).toBeTruthy()
  })

  it('filters documentation categories and sections with regex-safe search', async () => {
    const { getByPlaceholderText, queryByText } = render(DocsPage)
    const input = getByPlaceholderText(/Search docs.../i)
    
    // Test regex safety
    await fireEvent.input(input, { target: { value: 'Koota (' } })
    expect(queryByText(/ECS Simulation/i)).toBeTruthy()
  })

  it('renders styled callout boxes and parameter tables', () => {
    const { container } = render(DocsPage)
    expect(container.querySelector('[data-callout]')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/docs-tailwind.test.ts --run`  
Expected: FAIL (`Search docs...` input not found).

- [ ] **Step 3: Update `docs-loader.ts` and `src/routes/docs/+page.svelte`**

Implement category groupings, TOC extraction, regex-safe search filter, Tailwind 3-column layout, callouts, parameter tables, and TOC scroll spy.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/docs-tailwind.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/docs-loader.ts src/routes/docs/+page.svelte tests/docs-tailwind.test.ts
git commit -m "feat(docs): implement tailwind-inspired 3-column docs layout with search filter and toc"
```

---

### Task 5: Canonical Prerendered Routing (`/docs/[slug]`)

**Files:**
- Create: `src/routes/docs/[slug]/+page.ts`
- Create: `src/routes/docs/[slug]/+page.svelte`
- Modify: `src/routes/docs/+page.svelte` (support deep-linking & redirect to default overview)
- Test: `tests/docs-routing.test.ts`

**Interfaces:**
- Produces:
  - `src/routes/docs/[slug]/+page.ts`: Generates `entries()` returning all 8 doc slugs for `@sveltejs/adapter-static`.
  - Canonical URLs: `/docs/overview`, `/docs/quick-start`, `/docs/sim-ecs`, `/docs/render-pixi`, `/docs/effect-runtime`, `/docs/security-csp`, `/docs/mobile-ui`, `/docs/ai-rules`.

- [ ] **Step 1: Write failing test for `[slug]` route pre-generation**

```typescript
// tests/docs-routing.test.ts
import { describe, expect, it } from 'vitest'
import { entries } from '../src/routes/docs/[slug]/+page'
import { getDocSections } from '../../data/docs-loader'

describe('Docs Canonical Slug Routing', () => {
  it('entries() emits all 8 canonical documentation slugs', () => {
    const slugs = entries()
    expect(slugs.length).toBe(8)
    const slugNames = slugs.map((s) => s.slug)
    expect(slugNames).toContain('overview')
    expect(slugNames).toContain('quick-start')
    expect(slugNames).toContain('sim-ecs')
    expect(slugNames).toContain('render-pixi')
    expect(slugNames).toContain('effect-runtime')
    expect(slugNames).toContain('security-csp')
    expect(slugNames).toContain('mobile-ui')
    expect(slugNames).toContain('ai-rules')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/docs-routing.test.ts --run`  
Expected: FAIL (`Cannot find module '../src/routes/docs/[slug]/+page'`).

- [ ] **Step 3: Implement `src/routes/docs/[slug]/+page.ts` and `+page.svelte`**

Provide `entries()` returning all 8 slugs and render the canonical doc view with deep-link synchronization.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/docs-routing.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/docs/[slug]/ tests/docs-routing.test.ts src/routes/docs/+page.svelte
git commit -m "feat(docs): implement canonical prerendered slug routes with entries pre-generation"
```

---

### Task 6: Full Verification Gate (Tests, Svelte-Check, Prerender Build)

**Files:**
- Output verification in `build/`

**Interfaces:**
- Verifies:
  - All unit tests pass with zero failures.
  - `pnpm check` passes with 0 errors and 0 warnings.
  - `pnpm build` creates all static pages (`build/docs.html`, `build/docs/*.html`, `build/ai.html`, `build/llms.txt`, `build/llms-full.txt`) with zero 404 warnings.

- [ ] **Step 1: Run full test suite**

Run: `pnpm test --run`  
Expected: All test suites PASS (0 failures).

- [ ] **Step 2: Run TypeScript and Svelte diagnostics**

Run: `pnpm check`  
Expected: 0 errors and 0 warnings.

- [ ] **Step 3: Run static prerender build**

Run: `pnpm build`  
Expected: Static build completes with exit code 0, generating:
- `build/index.html`
- `build/docs.html`
- `build/docs/overview.html`
- `build/docs/quick-start.html`
- `build/docs/sim-ecs.html`
- `build/docs/render-pixi.html`
- `build/docs/effect-runtime.html`
- `build/docs/security-csp.html`
- `build/docs/mobile-ui.html`
- `build/docs/ai-rules.html`
- `build/ai.html`
- `build/llms.txt`
- `build/llms-full.txt`
- `build/examples.html`
- `build/cheatsheet.html`
- `build/showcase.html`

- [ ] **Step 4: Verify isolation of sibling repository**

Run: `git -C ../automata-framework status`  
Expected: Working tree clean, zero modified files.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore(website): verify tailwind docs and ai portal static prerender gates"
```
