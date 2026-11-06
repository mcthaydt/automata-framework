# Automata Framework: Tailwind CSS-Inspired Docs & PixiJS-Style AI Portal Design Spec

**Date:** 2026-10-14  
**Author:** Antigravity  
**Status:** Approved for Implementation Planning  
**Target Repository:** `automata_website`  

---

## 1. Intent & Why

Automata Framework is a deterministic 2D game framework built for modern web browsers and the Ruken gaming platform. While the website currently provides a basic Spartan docs reader, developers expect a reference-grade documentation experience matching the industry gold standard set by **Tailwind CSS**.

Furthermore, modern game developers rely heavily on AI coding agents (Claude Code, Cursor, Windsurf, GitHub Copilot, Antigravity). Without explicit guidance and skills, AI models hallucinate outdated patterns: they introduce `eval` / `new Function` (violating Ruken's strict CSP), mutate game state outside Koota ECS, import Effect inside simulation loops, or neglect sub-tick interpolation.

Inspired directly by **PixiJS's AI initiative** (`pixijs.com/llms`), Automata will introduce:
1. A **Tailwind CSS-inspired documentation layout** (`/docs` and `/docs/[slug]`) with 3-column navigation, rich categorized sections, parameter tables, callout blocks, real-time sidebar filter, and an "On this page" TOC.
2. A **first-class top-level AI Portal** (`/ai`), giving developers one-click setup for AI agents, anti-hallucination rules, downloadable prompt rules, and static `llms.txt` endpoints following the `llmstxt.org` standard.

---

## 2. Goals & Success Criteria

### Documentation Redesign (`/docs` & `/docs/[slug]`)
- **Tailwind 3-Column Layout:**
  - **Left Sidebar:** Sticky hierarchical category navigation (*Getting Started*, *Architecture & Core Laws*, *Koota ECS Simulation*, *PixiJS 2D Rendering*, *Effect Runtime & Scopes*, *Security & Ruken CSP*, *Mobile UI Primitives*, *AI & Skills*). Includes:
    - Real-time instant search input with `/` shortcut filtering docs categories and headings.
    - Category status badges (`v0.1`, `M1`), active item border glow, and mobile drawer toggle.
  - **Center Canvas:** Tailwind-quality article styling: section eyebrows, breadcrumb navigation, copyable code blocks with language pills, parameter/options tables, and alert callouts (`Note`, `Tip`, `Important`, `CSP Violation`).
  - **Right Sidebar:** Sticky "On this page" Table of Contents that tracks heading scroll positions, with quick links ("Edit on GitHub", "Join Community").
- **Canonical Routing & Deep-Linking:**
  - `/docs` defaults to the first guide (`/docs/overview`).
  - `/docs/[slug]` provides static, canonical prerendered pages for all 8 categories so external bookmarks, search engines, and `llms.txt` links resolve cleanly.
- **Content Breadth:** Rich, multi-section guides covering:
  1. *Overview & Vision* (Philosophy, Seven Laws, Ruken direction).
  2. *Quick Start* (`npx automata create-game`, dev server, anatomy).
  3. *ECS Simulation & Determinism* (Koota ECS, traits, systems, fixed 60Hz loop, bit-identical replays).
  4. *PixiJS 2D Presentation* (Sub-tick alpha interpolation, `RenderDelta`, sprites, custom shaders).
  5. *Effect Runtime & Concurrency* (Structured concurrency, typed errors, `Scope` resource disposal).
  6. *Zero-Eval CSP & Ruken Security* (No-eval linkers, CSP policy, sandboxed iframes).
  7. *Mobile UI Primitives* (FloorFifty reachability, geometry owner, touch controls).
  8. *AI Coding Agent Rules* (The 5 Golden Laws for LLMs).

### Automata AI & LLMs Portal (`/ai`)
- **Top-Level Navigation:** Positioned prominently in `Header.svelte`, `CommandMenu.svelte`, and `Footer.svelte`.
- **PixiJS-Inspired Skills Hub:**
  - One-click copy commands for AI agents:
    - **Skills CLI:** `npx skills add mcthaydt/automata`
    - **Claude Code:** `claude /plugin marketplace add mcthaydt/automata` or system prompt injection.
    - **Cursor:** Remote rule configuration and `.cursorrules` snippet.
    - **Windsurf / Copilot:** Instructions and prompt files.
    - **Antigravity:** Custom skill instructions.
  - **The 5 Golden Laws for LLMs:** Anti-hallucination guardrails:
    1. Simulation is 100% deterministic, synchronous, and runs on Koota ECS (never import Effect in sim).
    2. Effect runs all side effects (I/O, host, network, saves) outside the sim.
    3. Zero Eval: No `new Function`, `eval`, or dynamic code generation (strict CSP).
    4. PixiJS presentation consumes `RenderDelta` with sub-tick alpha interpolation (`alpha = accumulator / dt`).
    5. State ownership: Only the sim mutates game entities; UI and presentation only observe truth.
  - **Prompt Generator & Copyable System Instructions:** Pre-crafted prompt templates for generating games, ECS systems, and shaders.
- **Static `llms.txt` Endpoints:**
  - `/llms.txt`: Summary and markdown link index conforming to `llmstxt.org`.
  - `/llms-full.txt`: Consolidated, full-text documentation generated automatically during `sync` for LLM ingestion.

---

## 3. Non-Goals & Anti-Goals

- **Non-Goals:**
  - Hosting an interactive server-side OpenAI/Anthropic API chatbot that charges API fees.
  - Modifying the sibling `automata-framework` repository.
  - Publishing a live NPM package to the public registry during this task (the site will supply the canonical repo rules, configurations, and copyable snippets).
- **Anti-Goals:**
  - Cluttered, slow-rendering client pages that degrade the minimal SF startup aesthetic.
  - Breaking static prerendering (`@sveltejs/adapter-static`) or introducing client-side Node dependencies.

---

## 4. Architectural & Component Design

### 1. Route Structure
```
src/
├── routes/
│   ├── +page.svelte              # Homepage (Hero, Bento, Walkthrough)
│   ├── examples/                 # Raylib-style split gallery
│   ├── cheatsheet/               # 7-package cheatsheet
│   ├── showcase/                 # Games showcase (Emberwick)
│   ├── docs/                     # Tailwind CSS-inspired docs layout
│   │   ├── +page.svelte          # Docs index (renders active doc or redirects to /docs/overview)
│   │   └── [slug]/
│   │       ├── +page.ts          # Prerender entries() generating all doc slugs
│   │       └── +page.svelte      # Canonical article route
│   └── ai/                       # PixiJS-inspired AI & LLMs Portal
│       └── +page.svelte          # AI tools, Skills install, 5 Golden Rules, prompt templates
static/
├── llms.txt                      # llmstxt.org index (generated by sync-docs)
└── llms-full.txt                 # Consolidated plain-text LLM documentation (generated by sync-docs)
```

### 2. Data Model & Documentation Engine (`src/data/docs-loader.ts`)
```typescript
export interface DocSection {
  id: string
  slug: string
  title: string
  category: string
  badge?: string
  description: string
  content: string
  toc: { id: string; text: string; level: number }[]
}

export interface DocCategory {
  name: string
  items: DocSection[]
}
```

### 3. Builder Design Calls & Settled Architecture

1. **Content Scope:** Comprehensive, production-grade technical guides for all 8 categories authored directly within `scripts/sync-docs.ts` and `src/data/docs.json`, sourcing from framework ADRs, specs, and actual code.
2. **Authoring & Rendering Pipeline:** Structured markdown parser rendering code snippets with copyable Shiki blocks, alert callout boxes (`Tip`, `Note`, `Important`, `CSP Warning`), and parameter tables without heavy external runtime dependencies.
3. **Routing & URL Canonicalization:** Both `/docs` and `/docs/[slug]` are fully supported and statically prerendered with `export const prerender = true` and `entries()` in SvelteKit.
4. **Search Filter:** A responsive instant search input at the top of the Left Sidebar (`/` keyboard shortcut) that filters articles and sections in real time, with parallel deep integration in `CommandMenu.svelte`.
5. **LLM Generation Pipeline:** `scripts/sync-docs.ts` automatically outputs both `static/llms.txt` and `static/llms-full.txt` during `pnpm sync`, preventing documentation drift.

---

## 5. Verification Plan

1. **Unit Tests (`vitest`):**
   - `tests/docs-tailwind.test.ts`: Verify 3-column navigation, sidebar search filter, TOC scroll-spy structure, and category switching.
   - `tests/ai-page.test.ts`: Verify agent installation command tabs, Golden Rules rendering, copy prompt action, and link targets.
   - `tests/llms-txt.test.ts`: Verify `static/llms.txt` and `static/llms-full.txt` exist and match the `llmstxt.org` specification.
2. **Typecheck Gate (`pnpm check`):**
   - 0 errors, 0 warnings across all `.svelte` and `.ts` files.
3. **Static Prerender Build Gate (`pnpm build`):**
   - Clean static output in `build/` including `build/docs.html`, `build/docs/*.html`, `build/ai.html`, `build/llms.txt`, and `build/llms-full.txt` with zero 404 warnings.
