# Model provenance: `examples/resources/models`

| Asset | Used by | Made by | How | Date |
|---|---|---|---|---|
| `nightstand.glb` (228,532 bytes, SHA-256 `36889de5ff4a74a4b4fed1fb19faa18a3e47d847297f472cb3bd6b7d1e906225`) | `render3d/render3d-meshes.ts` | Copied byte for byte from The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at `92e6704`, `src/render/models/nightstand.glb` | The Last Light's props pipeline: a GPT prop sheet (second batch, `sheet-c.png`), Meshy image-to-3D, texture flattened to 12 colours (its `docs/art/props-3d/README.md`). Static: no skin | 2026-10-30 |
| `nightstand.bin` (87,419 bytes, SHA-256 `4b8eb9eef7ed5f242e076052f37fb53b289200a8b513014a9c670065b1f62528`) | `render3d/render3d-meshes.ts` | The same file as The Last Light's `src/render/models/nightstand.pack` at `92e6704`, renamed: AF serves the packed layout as `.bin`, which Ruken accepts (M3-D8) | `scripts/pack-models.py` from the GLB above: decimated, quantised (`LLP1` layout) | 2026-10-30 |

Its palette is The Last Light's (DUEL), not Endesga 64; the Owner may replace it with an AF prop when the props pipeline (M3.9) exists.
