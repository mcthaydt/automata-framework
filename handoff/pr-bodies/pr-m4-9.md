## Summary

M4.9 graphics quality tiers and render targets ([plan](docs/superpowers/plans/2026-10-17-m4-9-quality-tiers.md); M4 spec §4.11, §6; M4-D6; acceptance Q-a, Q-b). From `main`; the first commit is the TDD plan. Ported from FloorFifty `quality.ts` (rules only), `quality-rebuild.ts` and `render-target.ts` at `ac72660`, with their tests.

- **Tier contract (runtime):** `QualityTier` (`high`, `medium`, `low`), `qualityTierSchema`, `displaySettingsSchema` and `DEFAULT_QUALITY` (`high`). An unknown saved tier reads as `high`, as every settings field falls back to its default.
- **Resolution caps:** `canvasResolutionFor(formFactor, dpr, tier)`: low 1, medium 1.5, high 2. A portrait tablet stays at 1.
- **Slot tiers:** `postFilters.set(id, filters, order, { minTier })`, plus `setTier` and `tier`. An owner above the tier leaves the filter list and comes back in its old place.
- **Renderer:**
  - `PixiRendererOptions.quality`;
  - `PixiStage.quality` and `setQuality(tier)`, which re-caps the resolution and re-tiers the slot;
  - a geometry change keeps the tier's cap.
- **`rebuildOnQuality`:** destroys the old build before making the new one.
- **`CompositeTarget`:**
  - a letterboxed pixel-art stage draws its world and UI at the logical size and resolution 1, then nearest-upscales them;
  - the slot's filters run on the composite, so their cost is bounded by the logical size;
  - the backdrop keeps device resolution;
  - `composite: false` opts out.
- **Dropped filters (Q-b):**
  - `stage.tryFilter(id, make)` returns `undefined`, warns, and publishes `render.filter.dropped` on the render target's new optional `bus`;
  - the frame still draws;
  - the boot program now makes the presentation bus before the renderer, so the target can carry it.
- **Finding:** Pixi 8 does not throw on a broken GLSL program. It logs and renders with an unusable one, which the parity test shows. So `tryFilter` links the program on the renderer's own WebGL2 context. Under WebGPU only a build-time throw is caught, because WGSL errors arrive asynchronously.
- **Example:** `render/render-quality.ts` switches the tier with keys 1, 2 and 3 and reads it out. Core examples cannot build a filter (no `pixi.js` import), so the `minTier` half of Q-a is proved by the unit tests.
- **Changeset:** empty; runtime and render-pixi are private.
- **Goldens:** unchanged.

## Gates (local, `TURBO_FORCE=true`)

| Gate | Result |
|---|---|
| `pnpm format` | Clean |
| `pnpm check` | Passed, 30 of 30 |
| CI checks-job extras | Passed |
| `pnpm test:parity` | Passed, 11 of 11. `render-quality.parity.test.ts`: the real-compile cases ran in Chromium and WebKit; headless Firefox here has no WebGL at all (even with `webgl.force-enabled`), so they are skipped there by name, and the build-throw case ran in all three |
| `CI=1 pnpm test:e2e` | 74 passed, 2 skipped, including `render-quality` in both examples projects |
| `prepare-ruken` | Passed for Emberwick and the placeholder |

**Owner acceptance, not claimed:**
- The composite changes how Emberwick and the pixel-art examples draw: the world and the HUD at the logical size, upscaled by whole pixels. They need a visual look.
- The frame budget at each tier waits on the GPU runner (PRODUCT.7).
- Firefox's real-compile evidence waits on a runner with WebGL.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01QQDa25MEpciFkK7k5UV2dC
