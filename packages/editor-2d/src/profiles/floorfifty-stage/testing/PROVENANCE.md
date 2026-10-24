# Provenance of the stage fixtures

`stages/*.toml` are the four stage files FloorFifty ships, copied byte for byte from `content/stages/` of the
`FloorFifty` repository at commit `ee5d44e` (2026-10-23, "Merge pull request #97 from SNEKPRTY/release/1.0.0-rc.1").
They are the Owner's own game content, used here as read-only test fixtures (2D editor spec FF-D3, FF-o). A refresh is a
re-copy at a newer commit with the diff reviewed; nothing in the editor edits these files.

`stage.schema.ts` is the vendored form of `packages/content/src/schema/stage.ts` at the same commit.

`art-aliases.json` is the sorted list of the 304 asset aliases in `packages/asset-contract/assets/art-manifest.json` of the
same commit (every `bundles.*[].alias`; nothing else of the manifest is copied). The alias checks read it as the loaded
art manifest: all 42 aliases the four stages use are in it.
