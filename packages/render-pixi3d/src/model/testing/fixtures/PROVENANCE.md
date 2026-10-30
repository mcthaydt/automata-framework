# Model fixtures

Copied byte for byte from The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at `92e6704`, `src/render/models/`, on
2026-10-30, to port the parse cases of its `tests/props.test.ts` (M3.4a).

| File | Bytes | SHA-256 | Made by |
|---|---|---|---|
| `nightstand.glb` | 228,532 | `36889de5ff4a74a4b4fed1fb19faa18a3e47d847297f472cb3bd6b7d1e906225` | The Last Light's props pipeline: a GPT prop sheet (second batch, `sheet-c.png`), Meshy image-to-3D, texture flattened to 12 colours (its `docs/art/props-3d/README.md`). Static: no skin |
| `nightstand.pack` | 87,419 | `4b8eb9eef7ed5f242e076052f37fb53b289200a8b513014a9c670065b1f62528` | `scripts/pack-models.py` from the GLB above (decimated, quantised, `LLP1` layout); AF serves this layout as `.bin` (M3-D8) |

Test-only. Every other model a test uses is written by `model-fixtures.ts` from code.
