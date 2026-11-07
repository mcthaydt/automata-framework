# DUEL

AF's default palette: 256 colours as 32 ramps of 8, dark to light. Colour `r * 8 + s` is ramp `r`, step `s`;
[duel.txt](duel.txt) lists them in that order (paint.net format), and `packages/content` embeds the same list as
`DUEL_RAMPS` (a test checks the two against each other).

- **Source:** generated from the DUEL look-up table, as the 3D builders carry it (provenance: `docs/provenance/sources.md`).
- **Author and licence:** not recorded yet. This is a placeholder until the Owner supplies them; nothing outside this
  file claims either.
- **Outline colour:** ramp 6, step 0 (`#002219`), never shaded.
- **Use:** a game's `content/palette.toml` may replace it; without one the game gets DUEL.
