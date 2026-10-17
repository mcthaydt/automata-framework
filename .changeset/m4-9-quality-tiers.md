---
---

Graphics quality tiers and the fixed-resolution composite (M4.9). `runtime` adds `QualityTier`, `qualityTierSchema` and `displaySettingsSchema`, the `render.filter.dropped` fact and an optional `RenderTarget.bus`. `render-pixi` adds `PixiRendererOptions.quality` and `composite`, `PixiStage.quality`, `setQuality`, `tryFilter` and `composite`, per-owner `minTier` in the post-filter slot, tier caps in `canvasResolutionFor`, `rebuildOnQuality` and `CompositeTarget`. A letterboxed pixel-art stage now draws its world and UI through the composite. Both packages are private, so this changeset releases nothing.
