# ED2D.4c3b Pixi level canvas: TDD plan

- **Task:** ED2D.4c3b in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §4 (`canvas/`: `level-view.ts`, `textures.manager.ts`), §5.3 (chunks shared between snapshots, ED2D-D4), §8 (the Level view canvas; Home), §11 (tileset images are workspace inputs under `assets/`; a missing image degrades to placeholders, never the document), §13 (a missing or corrupt image draws numbered placeholders; a lost WebGL context shows "Preview paused" and restores on `webglcontextrestored`, the document and history unaffected), §14 (Visual: Owner acceptance, never auto-promoted), ED2D-D11.
- **Lane:** editor-2d. **Depends on:** ED2D.4c3a (the headless draw list, #206). **Unblocks:** ED2D.4c4a (the Level view mounts this canvas), ED2D.6b (World view), EDFF.2b (stage canvas).
- **Status:** Planned 2026-10-30 on `claude/editors-ed2d-4c3b-pixi-canvas`, stacked on #206.
- **Progress:** 6 of 8 steps (2026-10-30).

## Why this task exists

ED2D.4c3a says what to draw as plain data; nothing draws it yet. This slice turns that list into Pixi objects, loads the workspace's tileset and background images into textures, survives a lost WebGL context, and puts a picture of each project's first level on its Home card. It decides nothing the draw list already decides: placement, placeholders and their reasons, layer order, overlays.

## Sources, read at these commits

- **AF `render-pixi`** (main at `62935186`): `renderer.ts` (WebGL is the default preference; `TextureSource.defaultOptions.scaleMode = 'nearest'` for pixel art), `no-eval.ts` and the `*.parity.test.ts` files (reading pixels with `renderer.extract.pixels`, skipping WebGL-only cases where a browser has none). Nothing is copied: `render-pixi` is a game renderer built on Effect services, and the editor needs a plain renderer on a canvas element.
- **`pixi.js` 8.22.0** (`lib/rendering/renderers/gl/context/GlContextSystem.js`): Pixi calls `preventDefault` on `webglcontextlost`, so the browser may restore the context, and on `webglcontextrestored` re-runs `contextChange`, which re-uploads every texture source it still holds on the next render. The canvas therefore only has to stop drawing while the context is lost, say so, and draw again once it is back.
- **The Last Light** (`92e6704`) `editor/src/client/`: draws a sector plan straight into Pixi with no textures; nothing extracted (as in ED2D.4c3a).

## Scope

**In:** `packages/editor-2d/src/canvas/` (the Pixi files beside `canvas/draw/`), `canvas/draw/level-images.ts` (pure), `app/canvas/LevelCanvas.svelte`, the Home card's thumbnail, the `canvas` Vitest project (Chromium), `Profile.preview`, `ProjectEntry.preview`, `pixi.js` 8.22.0 in the package (the repo's one pin, `docs/versions.md`).

**Out, with owner:**

| What | Where |
|---|---|
| Pointer to level pixels, pan, pinch, wheel zoom (`Viewport2D`), culling chunks against the viewport | ED2D.4c4a |
| Mounting the canvas in a Level view; the layer panel, palettes, tools | ED2D.4c4a |
| Importing or replacing an image (a re-import of the same path reloads it: the manager's `forget`, ED2D.5) | ED2D.5 |
| Visual goldens compared on the GPU runner | §14, D-5 runner; the images here are for review only |
| WebKit and Firefox canvas runs, iPad Safari | The Owner's device pass; the `canvas` project runs Chromium only (row) |

## Decisions made here (each vetoable by the Owner)

1. **No `render-pixi/no-eval`.** The editor is a standalone page with no Content-Security-Policy (`index.html` sets none, and it is not hosted by Ruken), so it imports `pixi.js` directly; `no-eval` would also make Zod jitless for the whole editor. A CSP for the editor would be a task of its own and would add the import first in `main.ts`.
2. **WebGL2, no fallback.** The canvas asks Pixi for `preference: 'webgl'` (AGENTS.md: WebGL2 is the default; WebGPU is opt-in and not offered). A browser without WebGL gets a canvas that says "Preview unavailable" and an editor that still works; a Home card keeps its initial.
3. **One scene builder, two hosts.** `level-scene.ts` turns a `LevelDrawList` into a Pixi `Container` and keeps, per layer, the Pixi container it built for each chunk object; a chunk that comes back `===` keeps its container, and one that does not is destroyed. Entities, objects and the overlays are rebuilt each update (a level holds tens of them, not thousands). `level-view.ts` (the editable canvas) and `level-thumbnails.ts` (Home) both use it.
4. **Placeholders are textures.** A numbered placeholder is a sprite of a small texture drawn once per colour, label and tile size (a 2D canvas at 4× the tile, at most 256 px, with the index centred), so a level of placeholders batches like one of real art and the text is not a Pixi `Text` per tile.
5. **The texture manager reads the workspace.** `createTextureManager({ read })` loads each path once with `createImageBitmap` on the bytes `read` returns (the workspace store), with nearest-neighbour scaling. A path that is missing, unreadable or does not decode is simply not loaded (the draw list then draws `missing` placeholders, and Checks report `missingTileset`); a load never throws. Frames are cached sub-textures.
6. **Colours.** A `#rrggbb` colour is used as is; a kit token name (`layer/entities`) is read from the element's CSS custom property `--color-layer-entities`. A token the page lacks, or a value that is not `#rgb`/`#rrggbb`, is a neutral grey (`#8e8c85`). An IntGrid value with no colour is that grey too.
7. **Camera.** `render(list, camera)` takes `{ x, y, scale }` (screen = level × scale + offset); `fitCamera(size, box)` fits a level in a box, centred. The Level view's `Viewport2D` (4c4a) will hand in its own.
8. **Context loss.** On `webglcontextlost` the view stops rendering and its `paused` store is `true`; `LevelCanvas.svelte` shows "Preview paused" (`role="status"`). On `webglcontextrestored` it renders the last list again and `paused` is `false`. Nothing touches the document or history.
9. **Thumbnails.** `Profile.preview?(value)` names the level a card shows (`level-project`: its first level); `listProjects` carries it on an `ok` entry. `createLevelThumbnails` renders one at a time on its own offscreen renderer, fitted into 96 × 96 px, as a PNG data URL cached by path, size and modification time; with no WebGL it answers `undefined`. The card shows it in its 48 px tile (`object-fit: contain`, pixelated) and keeps the initial when there is none. `startEditor` takes an optional `thumbnails` factory, so `main.ts` passes the Pixi one and the jsdom tests pass none (Pixi never loads in jsdom).
10. **Images for review.** `level-visuals.canvas.test.ts` renders the platformer and RPG templates (placeholders), a level drawn from a real PNG tileset, and the paused notice, and writes PNGs to `docs/evidence/owner-visual/2026-10-30-ed2d-4c3b/` only when run with `ED2D_VISUALS=1`; they are not goldens and no test compares against them.

## Contract

```ts
// canvas/draw/level-images.ts (pure)
export function levelImages(project: Project, level: string): readonly string[]   // sorted, unique

// canvas/colors.ts
export type ColorResolver = (value: string | undefined) => number
export function createColorResolver(readVar: (name: string) => string): ColorResolver

// canvas/textures.manager.ts
export interface TextureManager {
  load(paths: readonly string[]): Promise<void>
  readonly loaded: ReadonlySet<string>
  frame(path: string, frame: Bounds): Texture | undefined
  texture(path: string): Texture | undefined
  placeholder(label: string, color: string, size: Size): Texture
  forget(path: string): void
  destroy(): void
}
export function createTextureManager(options: { read(path: string): Promise<Uint8Array | undefined> }): TextureManager

// canvas/level-scene.ts
export interface LevelScene { readonly root: Container; update(list: LevelDrawList): void; destroy(): void }
export function createLevelScene(options: { textures: TextureManager; colors: ColorResolver }): LevelScene

// canvas/level-view.ts
export interface Camera { readonly x: number; readonly y: number; readonly scale: number }
export function fitCamera(size: Size, box: Size): Camera
export interface LevelView {
  readonly paused: Readable<boolean>
  render(list: LevelDrawList, camera: Camera): void
  resize(width: number, height: number, resolution: number): void
  destroy(): void
}
export function createLevelView(options: { canvas: HTMLCanvasElement; textures; colors }): Promise<LevelView | undefined>

// canvas/level-thumbnails.ts
export interface LevelThumbnails { thumbnail(key: string, preview: LevelPreview): Promise<string | undefined>; dispose(): void }
export function createLevelThumbnails(options: { read; colors }): LevelThumbnails

// profiles/profile.ts
export interface LevelPreview { readonly project: Project; readonly level: string }
interface Profile<V> { preview?(value: V): LevelPreview | undefined }
```

## Files

- Create: `src/canvas/draw/level-images.ts` (+ unit test), `src/canvas/colors.ts` (+ unit test), `src/canvas/textures.manager.ts`, `src/canvas/level-scene.ts`, `src/canvas/scene-items.ts`, `src/canvas/level-view.ts`, `src/canvas/level-thumbnails.ts`, `src/app/canvas/LevelCanvas.svelte`, the Chromium tests `src/canvas/*.canvas.test.ts` and `src/app/canvas/level-canvas.canvas.test.ts`, `src/testing/png.ts` (test images drawn in the browser), `src/canvas/level-visuals.canvas.test.ts`.
- Modify: `package.json` (`pixi.js`, `test:canvas`), `vitest.config.ts` (the `canvas` project), `src/profiles/profile.ts`, `src/profiles/level-project/level-project.ts` (+ test), `src/app/project-list.ts` (+ test), `src/app/home/{Home,ProjectList,ProjectCard}.svelte` (+ a DOM test), `src/app/App.svelte`, `src/app/boot.ts`, `src/main.ts`, the spec §4 (as built), this plan.

## Steps

Each step starts with a failing test and its reason. After each: `typecheck` and the focused run (`vitest run --project unit|dom|canvas <file>`).

- [x] **1. Pixi and the canvas project.** `pixi.js` 8.22.0; a `canvas` Vitest project (`*.canvas.test.ts`, Chromium, the Svelte plugin) and `test:canvas`.
- [x] **2. Images and colours (unit).** Fails: no modules. `levelImages` lists every tileset image and the level's background image once, sorted; a missing level throws `RangeError`. `createColorResolver`: `#rrggbb` and `#rgb` parse, a token reads its custom property, an unknown token, a bad value and `undefined` are the grey.
- [x] **3. Texture manager (Chromium).** Fails: no module. A PNG in the store loads (`loaded` has it, `texture` has its size, nearest scaling); a missing path, a store that throws and bytes that are not an image stay unloaded and do not reject; a second `load` does not read again; `frame` is cached per rectangle; `placeholder` is cached per label, colour and size; `forget` and `destroy` free them.
- [x] **4. Scene (Chromium).** Fails: no module. Pixels read back: a placeholder tile's colour fills its cell; an image tile draws its frame's pixels; an IntGrid cell its value's colour at the layer's opacity; a later layer covers an earlier one; the background colour fills the level. Reuse: a second update with the same chunk objects keeps every chunk container (`toBe`); a list with one new chunk replaces only that one and destroys the old; a layer that disappears is destroyed.
- [x] **5. View and context loss (Chromium).** Fails: no module. `createLevelView` renders a list at a camera (`fitCamera` centres and fits); `WEBGL_lose_context.loseContext()` makes `paused` true and a render then draws nothing; `restoreContext()` makes it false and the last list is drawn again (pixels back); `destroy` releases the renderer.
- [x] **6. `LevelCanvas.svelte` (Chromium).** Fails: no component. Mounted with a project and a view, it loads the level's images from the workspace and draws; a lost context shows "Preview paused" as a status and a restore hides it; unmounting destroys the view.
- [ ] **7. Thumbnails on Home.** Fails: no `preview`, no thumbnails. Unit: `level-project`'s `preview` is its first level (none for no level); an `ok` entry carries it. Chromium: `createLevelThumbnails` answers a PNG data URL, the same key once (one render), a failing renderer `undefined`. DOM: a card with a thumbnail shows it as an image with no alternative text in its tile (the title says the name), a card without keeps its initial. Boot passes the factory to Home; `main.ts` passes the Pixi one.
- [ ] **8. Images, docs and gates.** `ED2D_VISUALS=1` writes the review images; spec §4 as built; `pnpm format`, `TURBO_FORCE=true pnpm check`, the `canvas` and `layout` projects, changeset status.

## Gates

The package's `typecheck`, `test:unit`, `test:canvas` (Chromium) and `test:layout` (the Home card changed); `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm changeset status --since=origin/main`; `check-changesets`. Not run: WebKit and Firefox canvas runs (the row asks for Chromium; the Owner's device pass), the `browsers` parity project (no hashed output changes), the GPU runner's visual comparison (no goldens yet), CI (hosted runners are not getting jobs).

## Execution record

- **Step 1** (2026-10-30): `pixi.js` 8.22.0 (the repo's one pin; M3.2 had moved it from 8.21.0) and the `canvas` project. A first run in a fresh checkout failed every test with "Vite unexpectedly reloaded a test" while Vite found Pixi mid-run; the project now pre-bundles `pixi.js` (`optimizeDeps.include`), and a run with `node_modules/.vite` removed passes.
- **Step 2** (2026-10-30): `levelImages` (3 tests) and `createColorResolver` (3 tests), failing first on the missing modules.
- **Step 3** (2026-10-30): the texture manager (7 tests in Chromium), failing first on the missing module.
- **Step 4** (2026-10-30): `level-scene.ts` and `scene-items.ts` (10 tests), failing first on the missing module. Found test-first: the entity and object pass emptied the chunk layers it was not for, so no tile showed; it now leaves them alone. Half-opacity pixels came back `#7f0000` where `#800000` was written; a colour at half alpha may round either way, so those three samples allow one step a channel.
- **Step 5** (2026-10-30): `level-view.ts` (6 tests), failing first on the missing module. The context-loss test first timed out: a `restoreContext()` asked for while the loss event is still being delivered never arrives in Chromium (a plain WebGL2 canvas with no Pixi showed the same), so the test asks in a later task. The view takes only WebGL (`preference: ['webgl']`): a string preference would let Pixi fall back to WebGPU or its canvas renderer.
- **Step 6** (2026-10-30): `LevelCanvas.svelte` (4 tests), failing first on the missing component. Images load only when the level's image list changes, so hover never reads a file (a missing image is tried again on each load); the draw is synchronous after that. The notice is one `role="status"` element that is hidden when there is nothing to say. Window facts (`devicePixelRatio`, `getComputedStyle`, `ResizeObserver`) come from the host element's own window, not the globals (ED2D.4c2a decision 9).
