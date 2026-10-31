# Model provenance: `games/base-3d/public/models`

The first slice's three static props (M3.7b part 3), drawn by the `scene` hook (`src/views.ts` `PROPS`). Each is copied byte for byte from The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at `92e6704`, `src/render/models/<name>.glb`.

| Asset | Bytes | SHA-256 | How it was made (The Last Light) | Date copied |
|---|---|---|---|---|
| `oil-drum.glb` | 323,916 | `139277070460ebc15822b1a7a34a799ec5d4f9af1a89de08db84423ffecbacd9` | The Bay's props batch (`docs/art/props-bay/README.md`, row g): a GPT reference sheet cropped per object, Meshy image-to-3D (5,000 triangles, remeshed, textured, no PBR, 30 credits), texture flattened by its props pipeline. Static: no skin | 2026-10-30 |
| `burner-bench.glb` | 326,020 | `b6896f9d64549d02611a85e5340de7801e618d7ffbc463f777d5ef3e98bb9347` | The same batch, row h | 2026-10-30 |
| `pallet-stack.glb` | 429,720 | `69d0d2dbd1fd9d50b85766443605dba5d32be957706c108185fad70dce11b146` | The same batch, row g (re-packed at `texture: 512`, its WP-36 handoff) | 2026-10-30 |

Their palette is The Last Light's (DUEL), not Endesga 64; the Owner may replace them with AF props when the props pipeline (M3.9) exists, as `examples/resources/models/PROVENANCE.md` says of the nightstand.
