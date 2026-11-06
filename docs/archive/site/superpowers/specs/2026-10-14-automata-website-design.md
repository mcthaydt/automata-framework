# Automata Framework Website Design Specification

> **Date:** 2026-10-14  
> **Status:** Draft (Spec Review)  
> **Target Directory:** `/Users/mcthaydt/Developer/Business/Automata/automata-framework/website`  
> **Inspiration:** Raylib website feature architecture + Minimalist SF developer startup aesthetic (Linear, Vercel, Raycast)

---

## 1. Intent and Why

Automata Framework is a deterministic, web-first game framework built for modern browsers and Ruken. It combines pure synchronous ECS sim logic (Koota), modern rendering (PixiJS 2D/3D), structured concurrency and lifecycle management (Effect), and mobile-first responsive UI.

To drive adoption, developer trust, and commercial viability, Automata requires a flagship web portal. Raylib's website (`raylib.com`) has set the gold standard for programmer-focused game library portals: an immediate interactive demo, a live interactive examples gallery, an exhaustive searchable cheatsheet, and a showcase of real games, all without marketing fluff.

This website merges **all features of Raylib's portal** with a **minimalistic SF developer startup aesthetic**: crisp dark-mode typography, bento-grid feature highlights, command-palette search, micro-interactions, and instant code-to-canvas feedback.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Raylib Feature Completeness:**
   - **Hero with Live Experience:** Interactive game/demo running immediately on page load, with instant CLI copy command (`npx automata create-game <name>`).
   - **Interactive Examples Gallery:** Live runnable demos grouped by module (Sim, Render, Physics, UI, Host, Content) with split-screen code view showing canonical raylib headers (`Shows:`, `Controls:`, `Base:`, `Packages:`).
   - **Interactive API Cheatsheet:** Exhaustive, instant-search quick reference with keyboard shortcuts (`/` or `Cmd+K`), function signatures, parameter descriptions, and one-click copy.
   - **Showcase / Games Page:** Highlighting real games and base templates built on Automata (Emberwick `base-2d`, FloorFifty, The Last Light).
   - **Architecture & Spartan Docs:** Co-located directly with the repository's `docs/` folder, rendering the framework's architecture laws ("sim pure, Effect outside", "no eval", "Ruken first").
   - **Community & Ecosystem:** Links to GitHub repo, Discord community, Ruken platform, package releases, and sponsorships.
2. **SF Minimalist Developer Aesthetic:**
   - High-contrast, monochromatic dark theme (`#09090b` / `#18181b`) with subtle hairline borders (`border-white/10`) and Endesga 64 accent tokens.
   - Monospace typography for signatures and code (JetBrains Mono / Geist Mono) and crisp sans-serif for UI (Geist / Inter).
   - Bento-grid layout for features and architecture cards.
   - Responsive across mobile phones, tablets, and ultrawide desktops.

### Non-Goals
- Not a browser-based cloud IDE or visual scene editor (Automata adheres to the spartan programmer philosophy: code in your editor, test in the browser).
- No complex server-side database or user authentication for v1 (the portal is static-first with rich client-side interactivity).
- No heavy analytics trackers or intrusive cookie banners.

### Anti-Goals
- No bloated generic enterprise marketing layouts (no generic 3D floating abstract shapes, no walls of buzzwords).
- No multi-megabyte bundle sizes that slow down initial paint.
- No non-deterministic canvas embeds that freeze mobile browsers.

---

## 3. Technology Stack and Architecture

### Decisions in Force:
- **Location:** Workspace app located at `/Users/mcthaydt/Developer/Business/Automata/automata-framework/website`.
- **Monorepo Integration:**
  - Registered in `pnpm-workspace.yaml` as `website`.
  - Direct access to `docs/` for rendering framework architecture, overview, and specifications.
  - Direct access to `examples/` and `examples/gallery` for loading live demos and source files with Shiki syntax highlighting.
  - Participates in Turborepo build caching (`turbo run build --filter=website`).
- **Core Framework:** SvelteKit + Vite + TypeScript (Svelte 5 matching `@mcthaydt/automata-ui`).
- **Styling:** Tailwind CSS v4 with custom SF-minimalist dark tokens and hairline borders.
- **Icons:** Lucide Icons (`lucide-svelte`).
- **Code Highlighting:** Shiki with `github-dark` / `vitesse-dark` themes.
- **Demos Integration:** Sandboxed `iframe` with parent controls for bulletproof WebGL context disposal and event isolation.
- **Deployment:** Static Prerender (`@sveltejs/adapter-static`), zero-node server runtime, deployable anywhere (Vercel, Cloudflare Pages, GitHub Pages, or Caddy).

---

## 4. Page Architecture & Feature Breakdown

### 4.1. Navigation & Header
- **Left:** Minimalist Automata glyph + wordmark (`automata`), version pill (`v0.0.2-alpha`).
- **Center:** Main nav links:
  - `Overview` (`/`)
  - `Examples` (`/examples`)
  - `Cheatsheet` (`/cheatsheet`)
  - `Showcase` (`/showcase`)
  - `Docs` (`/docs`)
- **Right:**
  - Search trigger (`Cmd+K`)
  - GitHub star count badge (`mcthaydt/automata-framework`)
  - Discord community link
  - Minimalist "Quickstart" button (`npx automata create-game`)

---

### 4.2. Home (`/`)
1. **Hero Section:**
   - Headline: *"The deterministic game framework for the web & Ruken."*
   - Subhead: *"Pure synchronous ECS simulation, PixiJS 2D & 3D rendering, and Effect runtime boundaries. Zero eval, bit-identical cross-browser replays, mobile-first from day one."*
   - CTA Row:
     - `Get Started ->` button.
     - Interactive Terminal Copy Box: `npx automata create-game my-game` with one-click copy and verified tooltip.
   - Live Interactive Hero Canvas:
     - Embeds a playable, lightweight interactive Automata canvas (e.g. Emberwick room or physics sandbox) running at 60 FPS right in the hero frame with sound/pause controls.
2. **Architecture & Philosophy Bento Grid:**
   - **Card 1: Pure Determinism (Sim Core):** Fixed 60Hz timestep, Koota ECS, xoshiro128** RNG, bit-identical cross-engine hashes in Chromium, WebKit, and Firefox.
   - **Card 2: Modern Rendering (PixiJS 2D & 3D):** WebGL2 default, WebGPU opt-in, integer pixel scaling, letterbox geometry, custom no-eval filter shaders.
   - **Card 3: Robust Boundaries (Effect Runtime):** Structured concurrency, typed errors, scoped resource lifecycles, zero untrapped exceptions.
   - **Card 4: Mobile-First Geometry (Automata UI):** Adaptive height tiers, visual viewport occlusion tracking, phone-first safe areas (780×270 ready).
   - **Card 5: Content Compiler & Hot-Reload:** Smol-TOML discovery, Zod schema validation, instant in-place reload, deterministic snapshot hashing.
3. **Raylib-style Code Showcase:**
   - Side-by-side terminal & canvas showing the "Spartan 50-line Automata Game":
     - `definePlugin` + `createSim` + `createPixiRenderer` + `runApp`.
4. **Community & Sponsor Row:**
   - Sponsors, Ruken platform integration, open-source contributors, GitHub release link.

---

### 4.3. Examples Gallery (`/examples`)
*Directly mirroring Raylib's `/examples.html` with modern developer UX.*
- **Sidebar / Category Filter:**
  - `All Examples`
  - `Sim & Core` (systems, components, state, snapshots)
  - `2D Rendering` (sprites, cameras, pixel scaling, shaders)
  - `Physics` (Rapier 2D rigid bodies, colliders, contact events)
  - `Mobile UI` (primitives, action bars, responsive tiers)
  - `Runtime & Host` (boot flow, save slots, pause lifecycle)
  - `Content` (hot reload, room TOML schemas)
- **Split View Layout:**
  - **Left / Top:** Sandboxed `iframe` running the compiled demo with host-level controls (Restart / Fullscreen / Open in New Window / Resolution Scale). Using sandboxed `iframe` guarantees WebGL context disposal, clean event listener isolation, and zero cross-route memory leaks.
  - **Right / Bottom:** Source code browser with Shiki syntax highlighting and canonical Raylib header badges:
    - `Shows: [Summary]`
    - `Controls: [Arrow keys / Touch]`
    - `Base: [base-2d | none]`
    - `Packages: [@mcthaydt/automata-sim, ...]`
  - One-click copy code snippet, link to GitHub source file.

---

### 4.4. API Cheatsheet (`/cheatsheet`)
*Directly mirroring Raylib's `/cheatsheet/cheatsheet.html`.*
- **Global Search:** Fast instant filter input with shortcut (`/` to focus).
- **Architecture & Data Pipeline:**
  - Authored as a structured, versioned static TypeScript dataset (`src/data/cheatsheet.ts`) with Zod schema validation.
  - Prevents brittle AST parser dependencies over complex Effect types, ensuring every signature and docstring is cleanly curated, readable, and spartan.
- **Module Groups:**
  - `@mcthaydt/automata-sim`: `createSim`, `step`, `definePlugin`, `defineComponent`, `defineResource`, `EntityStore`, `snapshot`, `hash`.
  - `@mcthaydt/automata-runtime`: `createApp`, `defineExtension`, `Time`, `Flow`, `PresentationBus`, `Settings`.
  - `@mcthaydt/automata-render-pixi`: `createPixiRenderer`, `RenderDeltaConsumer`, `FilterHelper`, `setupLetterbox`.
  - `@mcthaydt/automata-physics`: `physicsPlugin`, `RigidBody`, `Collider`, `raycast`.
  - `@mcthaydt/automata-ui`: `ScreenFrame`, `ActionBar`, `CornerControls`, `Dialog`, `LoaderOverlay`, `Geometry`.
  - `@mcthaydt/automata-host`: `Hosting`, `Storage`, `track`.
  - `@mcthaydt/automata-content`: `compileContent`, `defineContentSchema`.
- **Card Format per Function/Type:**
  - Name, TypeScript signature, parameter list, return type, short description, and copy signature button.

---

### 4.5. Showcase (`/showcase`)
*Directly mirroring Raylib's `/games.html`.*
- Grid of curated games and base templates:
  - **Emberwick (`base-2d`):** Atmospheric retro dungeon adventure in Endesga 64 palette. Compiled and playable directly in-browser on the site.
  - **FloorFifty:** Modular turn-based puzzle game on Ruken. Rich card with screenshots, tech breakdown, and external launch/store link.
  - **The Last Light:** 2.5D lighting and atmospheric survival experiment. Rich card with screenshots, tech breakdown, and external repository link.
- Game details modal/drawer with:
  - Play / Launch button, platform tags (Web, Ruken, Desktop), source repository link, technical highlights.

---

### 4.6. Documentation (`/docs`)
*Spartan developer guide:*
1. **Quickstart:** Installation via CLI, anatomy of a game project, directory structure.
2. **Core Concepts:**
   - The ECS Sim vs. Presentation layer boundary.
   - Why Effect runs the runtime and Koota runs the sim.
   - The No-Eval rule (Ruken CSP compliance).
3. **Pipelines:** Compiling content TOML, packaging with `ruken.toml`, testing cross-browser parity.
4. **Publishing:** Releasing to Ruken and standalone web.

---

## 5. Visual Design & Theme System

- **Background:** `#09090b` (zinc-950), `#000000` for canvas borders.
- **Surfaces:** `#121215` (zinc-900), `#18181b` for code blocks and cards.
- **Borders:** `1px solid rgba(255, 255, 255, 0.08)` (hairline borders).
- **Accents:** Endesga 64 palette accents (Cyan `#38bdf8`, Amber `#fbbf24`, Emerald `#34d399`).
- **Typography:**
  - UI: `Inter`, `Geist Sans`, or system sans-serif.
  - Code/Terminal: `JetBrains Mono`, `Geist Mono`, or system monospace.
- **Glow & Highlights:** Subtle top-radial gradients (`radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56, 189, 248, 0.15), transparent)`).

---

## 6. What's Left to the Builder

1. Choice of specific code syntax theme colors in Shiki matching the Endesga 64 aesthetic.
2. Exact responsive breakpoint thresholds for the examples split view (stacking vertically below 1024px).
3. Selection of initial featured demo to autoplay muted on the hero canvas.
