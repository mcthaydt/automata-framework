# ADR 0001: ECS for automata-sim

- Status: Accepted
- Date: 2026-10-01

## Context
The overview spec §8 picked Koota, pending spike S1. The sim must be deterministic across engines (Node, Chromium, WebKit, Firefox), and it must snapshot and restore with an identical continuation (laws 5 and 6; A0+A1 spec §4.4).

## Decision
**Koota 0.6.6**, behind the `automata-sim` facade. Game code never imports the ECS directly.

S1 ran the same order-dependent workload on Koota and on Miniplex 2.0.0. Both are deterministic, and both need the same StableId ordering rule. Koota adds relations with data, Added/Changed/Removed tracking, and SoA storage at no determinism cost.

## Consequences
- **Ordering:** native Koota order is deterministic across engines but **does not survive a restore**, and it isn't ascending by ID. Every order-sensitive iteration (systems, render delta, snapshot) uses StableId order through an incrementally maintained index. Sorting per tick costs about 4× (0.66 → 2.68 ms/tick at ~2.6k entities with 4× CPU throttle).
- **IDs:** Koota recycles entity IDs (60 recycled in the S1 run), so the facade owns its own monotonic `StableId`, and Koota IDs never leave the sim.
- **Relations:** snapshotted as `(target sid u32, data)` lists sorted by target StableId. Restore spawns every entity in StableId order first, then adds relations.
- **Change tracking:** Added/Removed is deterministic across engines. `Changed` was **not** exercised by S1: a default `updateEach` emits no `Changed` events (verified in a probe). The facade's field setters must use `updateEach(…, { changeDetection: 'always' })` or `entity.set`, and A1's render-delta golden must assert a non-empty `changed` list. After a restore, the first tick reports everything as added, so the first render delta after `restore()` is a full resync.
- **Fallback:** if Koota has to be replaced, the facade keeps the swap internal. Miniplex was measured to behave the same under the StableId rule.
