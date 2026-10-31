# GAME-3D.1a part 2 (G3-t): review images (2026-10-31)

base-3d's own screens with their words from the catalog (`src/messages/ui/en.json` through Paraglide and `t()`), in
English and in `xx-long` (the pseudo-locale that lengthens every word and wraps it in ⟦ ⟧), at 844×390 and 780×270.
Taken in Chromium (Vitest browser mode, production CSS) from the fixtures of `screens/strings.layout.test.ts`, by a
throwaway copy of that test that called `page.screenshot`; it was deleted and is not committed. The layout run itself
checks the same screens in Chromium, WebKit and Firefox (42 cases: no English left, ui's layout contract met).

28 images: `<screen>-<en|xx-long>-<width>x<height>.png` for the splash, the end, the game over, the Lock mode section,
the HUD (the fullest: the sling with 30 pellets, 999 embers, the Warden's bar), Items and Map.

## Against the reference (DESIGN.md §12.3, §13; DX.2d's screens; no mockup exists)

- **English:** unchanged from before this part. The words are the same, now read from the catalog by key.
- **xx-long:** every word base-3d shows is pseudo-localized, the accessible names included. The digits (embers, ammo)
  and the HUD's hearts (drawn, not text) stay as they are. The play screen's Pause is the default screens' (DX.2d),
  outside base-3d's catalog.
- **Long words:** the primary actions keep their full size at both heights. At 780×270, Items wraps "Boss key" over two
  lines in its facts row, and the Hookchain slot's name in its cell; nothing is clipped, and the corner Back stays
  fixed.
- The Items screen's Boss key row stays (the lock is kept in code, unplaced, under the trimmed slice); the heart pieces
  row is gone (cut by the 2026-10-31 rescope).
