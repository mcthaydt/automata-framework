# M1.8 part 2: Gallery Completion, Minimal `create-game` CLI & M1 Exit Spec

- **Status:** Drafted 2026-10-13 by the integration owner.
- **Task:** M1.8 close-out (Gallery completion, minimal `create-game`, and M1 exit evidence).
- **Parents:** [02 Master delivery plan](../../02-master-delivery-plan.md); [Ruken-first master spec](./2026-10-11-automata-framework-ruken-first-design.md) §4.1, §9.1; [`examples/README.md`](../../../examples/README.md); [01 Decomposition](../../01-decomposition.md) §4.
- **Consumes:** `@mcthaydt/automata-node`, `@mcthaydt/automata-ship`, `@mcthaydt/automata-sim`, `@mcthaydt/automata-runtime`, `@mcthaydt/automata-render-pixi`, `@mcthaydt/automata-ui`, `@mcthaydt/automata-content`, `@mcthaydt/automata-host`, `effect` 3.22.2.

---

## 1. Goal and boundaries

**Observable result:**
1. The demo gallery (`examples/gallery`) indexes all feature demos (`host/lifecycle-and-saves`, `content/hot-reload`, `physics/bodies-2d`, `ui/primitives`, `runtime/boot-and-flow`, `render-pixi/renderer-2d`), verified by `gallery.test.ts`. Every demo has the raylib-style header (`Shows:`, `Controls:`, `Base:`, `Packages:`) and runs cleanly under the fake host.
2. `packages/cli` exports `createGame` and the `create-game` binary. Running `create-game <dir> --id <id> --title <title>` scaffolds a standalone game project from the proven `base-2d` template, generating `package.json`, `ship.config.ts`, `vite.config.ts`, `tsconfig.json`, `index.html`, and `src/` game sources with reusable CI (`game-ci.yml`).
3. M1 exit gates are proven with live evidence: local CI green (`pnpm check`), cross-engine parity in Chromium, WebKit, and Firefox (`pnpm test:parity`), full Playwright browser journeys across phone and compact viewports (`pnpm test:e2e`), Ruken manifest and packaging validation via `automata-ship prepare`, and recorded bundle/performance budgets.

**Exclusions:**
- Full CLI features (`update-game`, `doctor`, codemods) are deferred to M8.
- 3D features and `@pixi/3d` extensions are deferred to M3 and M9.

---

## 2. Ownership

| Artifact / State | Owner | Allowed Writers |
|---|---|---|
| Gallery index (`examples/gallery/src/demos.ts`) | `examples/gallery` | Integration lane |
| `packages/cli` scaffolding logic | `@mcthaydt/automata-cli` | Integration lane |
| Generated game repository files | Author / target repo | `create-game` CLI |
| Manifest generation & validation | `@mcthaydt/automata-ship` | `automata-ship prepare` |
| Master delivery & continuation | `docs/` | Integration lane |

---

## 3. Contracts

### 3.1 `packages/cli` (`@mcthaydt/automata-cli`)

```ts
export interface CreateGameOptions {
  readonly targetDir: string
  readonly id: string
  readonly title: string
  readonly description?: string
  readonly author?: string
}

export interface CreateGameResult {
  readonly targetDir: string
  readonly id: string
  readonly title: string
  readonly createdFiles: readonly string[]
}

export class CreateGameError extends Data.TaggedError('CreateGameError')<{
  readonly reason: 'target-directory-exists' | 'invalid-id' | 'write-failed'
  readonly message: string
}> {}

export function createGame(
  options: CreateGameOptions,
): Effect.Effect<CreateGameResult, CreateGameError>
```

### 3.2 CLI Binary (`create-game`)

- Invocation: `automata create-game <target-dir> [--id <id>] [--title <title>]` or `create-game <target-dir> ...`
- Flag parsing: validates ID matches `^[a-z0-9-]+$` and `targetDir` is non-empty.
- Exit code: `0` on success, `1` on invalid arguments or file collision.

### 3.3 Gallery Index (`examples/gallery/src/demos.ts`)

Adds entries:
```ts
{
  path: 'runtime/boot-and-flow',
  package: '@af-examples/runtime-boot-and-flow',
  title: 'Runtime: boot and flow',
  shows: 'Boot program with veil overlay, error panels on failure modes, and Flow screen transitions.',
  base: 'none',
},
{
  path: 'render-pixi/renderer-2d',
  package: '@af-examples/renderer-2d',
  title: 'Renderer: 2D PixiJS',
  shows: 'WebGL2 default init with WebGPU fallback, sub-tick interpolation, and screen-space filter shader.',
  base: 'none',
}
```

---

## 4. Data and lifecycle flow

1. **Scaffold flow:**
   - Caller runs `createGame({ targetDir, id: 'my-game', title: 'My Game' })`.
   - CLI checks if `targetDir` exists and is non-empty; fails closed if non-empty.
   - CLI writes template files, substituting `{{ID}}`, `{{TITLE}}`, and workspace versions where appropriate.
   - CLI returns list of created files.
2. **Game verification flow:**
   - The scaffolded game installs dependencies, runs `vite build`, and `automata-ship prepare` writes a validated `ruken.toml`.
   - Game boots under Ruken's CSP with zero `eval`.

---

## 5. Failure policy

- **Directory collision:** If `targetDir` exists and contains files, fails with `target-directory-exists` without modifying any files.
- **Invalid ID:** If ID contains uppercase letters, spaces, or illegal manifest characters, fails with `invalid-id`.
- **Atomic cleanup on write failure:** If an unexpected I/O error occurs mid-scaffold, removes partially created directory and returns `write-failed`.

---

## 6. UI inventory and responsive behavior

The scaffolded project is derived from `base-2d`:
- ScreenFrame, Splash, Menu, Room, Pause, End screens.
- Responsive scaling: Integer letterbox at 320 × 192 inside safe-area insets.
- Touch controls: 44 px minimum targets, 48 px primary action buttons.
- Compact height: Layout holds at 780 × 270 landscape phone.

---

## 7. Test allocation

| Layer | What | Where |
|---|---|---|
| Unit (Node) | Gallery lists all demos and enforces `main.ts` raylib-style header | `examples/gallery/src/gallery.test.ts` |
| Unit (Node) | `createGame` validates ID, detects collisions, scaffolds all files | `packages/cli/src/create-game.test.ts` |
| Integration (Node) | Scaffolded game project builds and generates valid `ruken.toml` | `packages/cli/src/create-game.integration.test.ts` |
| E2E (Playwright) | `base-2d` and all feature demos pass browser journeys under fake host | `pnpm test:e2e` |
| Parity (Vitest browsers) | Parity tests green across Chromium, WebKit, and Firefox | `pnpm test:parity` |

---

## 8. Exit criteria

- All workspace packages and examples pass `pnpm check` (lint, typecheck, boundaries, style, unit tests).
- All parity suites pass in Chromium, WebKit, and Firefox (`pnpm test:parity`).
- All Playwright browser journeys pass (`pnpm test:e2e`).
- `base-2d` produces a valid `ruken.toml` accepted by `@ruken/manifest` via `automata-ship prepare`.
- `docs/02-master-delivery-plan.md` ticks M1.8 as complete and M1 fully exited.
- `docs/03-continuation-prompt.md` records all M1 completion evidence and points to M2.
