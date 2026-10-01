# A0: Bootstrap and Spikes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the monorepo just far enough to run the six A0 spikes (S1–S6) across Node, Chromium, WebKit and Firefox. Each spike ends with a written verdict, and the spike code is deleted once all verdicts are in.

**Architecture:**
- **Root tooling** (pnpm, turbo, TS, Biome, lefthook): real and permanent. A1 builds on it.
- **`spikes/`:** a single throwaway workspace package. Each spike lives in its own subfolder.
- **Two shared tools for cross-engine parity:**
  - A Vitest config that runs `*.parity.test.ts` files in Node *and* in the three browsers. Each test asserts a hash against one committed constant, so every engine must produce identical bytes.
  - A Playwright page runner, `spikes/shared/run-page.ts`, for things that need a real page: GPU rendering, the CSP check, and CPU-throttled benchmarks.

**Tech stack** (versions verified on npm 2026-10-01):

| Tool | Version |
|---|---|
| Node | 24 |
| pnpm | 10.33.4 |
| TypeScript | 7.0.2 |
| Biome | 2.5.15 |
| turbo | 2.11.6 |
| lefthook | 2.1.16 |
| Vitest | 5.0.3 (with `@vitest/browser-playwright` 5.0.3) |
| Playwright | 1.63.0 |
| Vite | 8.3.2 |
| koota | 0.6.6 |
| `@dimforge/rapier{2d,3d}-deterministic-compat` | 0.21.0 |
| three | 0.186.1 |
| pixi.js | 8.21.0 |
| pixelmatch | 7.2.0 |
| pngjs | 7.0.0 |

**Specs:**
- `docs/superpowers/specs/2026-10-01-a0-a1-spikes-foundation-design.md`: §2 is A0, §3.1–3.2 cover the bootstrap.
- Parent spec: `docs/superpowers/specs/2026-10-01-automata-framework-overview-design.md`.
- Ruken protocol, used by S6: `/Users/mcthaydt/Desktop/Business/Ruken/RukenApp/docs/superpowers/specs/2026-10-01-ruken-p01-protocol-sdk-design.md` (§4–§8).

**Scope note:** A1's core (`automata-sim`, `automata-content`, `automata-testing`, the checks, `examples/blank-game`) is **Plan 2**. It is written *after* this plan's verdicts land, because its ECS facade, relation serialization and math module depend directly on S1 and S5.

## Global Constraints

- Node `>=24` (`.nvmrc` = `24`). pnpm is pinned with `"packageManager": "pnpm@10.33.4"`.
- TypeScript is strict, ESM only (`"type": "module"`), `moduleResolution: "Bundler"`, with `noUncheckedIndexedAccess` on.
- Formatting and lint use Biome: single quotes, no semicolons, 2-space indent, line width 110.
- Commit messages follow Conventional Commits and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Spike code is exempt from TDD and the style rules, but every **pass criterion** in spec §2 must be checked by a test or a runner script. A pass criterion is never "eyeballed".
- Every parity test compares against a single committed expected constant. **Never** set separate expected values per engine.
- The CSP under test is exactly `script-src 'self' 'wasm-unsafe-eval'` (Ruken's). Other directives may be permissive.
- `spikes/` is deleted in a single commit at the end of A0. `docs/spikes/*.md` is kept.
- Run `pnpm format` before **every** commit. lefthook's Biome pre-commit check rejects unformatted files, and the code blocks in this plan are not guaranteed to be Biome-formatted.

## Review Focus

These failure modes are the most likely to fool a spike into a false PASS. Each has a guard test in the task that owns it.

1. **A parity hash computed over empty or trivial data passes in every engine.** Guard: each parity test asserts a minimum sample or entity count before hashing (Tasks 3, 4, 5).
2. **A "webgpu" run silently falls back to WebGL**, so the comparison is WebGL against WebGL. Guard: the page reports its actual backend, and the runner fails if it doesn't match the requested one (Tasks 6, 7).
3. **The CSP check passes because the wasm never loaded.** Guard: the page must report `ok: true` only after Rapier actually steps a body, and the runner fails on any `securitypolicyviolation` event (Task 4).
4. **Koota relations or recycled IDs are left out of the snapshot**, so restore "works" on a world without relations. Guard: the S1 snapshot test includes a relation with data and an ID recycled by destroy-then-spawn (Task 3).
5. **The Ruken stub accepts a look-alike host origin** (`evilruken.com`, `ruken.com.example.net`, a localhost host while the game is on a production origin). Guard: allowlist tests use P01 §4's exact examples (Task 8).

---

## File Structure

```
(root)
├─ package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, biome.json
├─ lefthook.yml, .nvmrc, .gitignore, AGENTS.md, CLAUDE.md
├─ docs/spikes/README.md                     verdict index (kept)
├─ docs/spikes/s1-koota.md … s6-ruken-stub.md  one verdict per spike (kept)
├─ docs/adr/0001-ecs-choice.md               (kept)
└─ spikes/                                   (deleted at the end of A0)
   ├─ package.json, tsconfig.json, vitest.config.ts
   ├─ shared/
   │  ├─ hash.ts        sha256Hex(bytes), f64Bytes(values)
   │  ├─ prng.ts        mulberry32(seed)
   │  ├─ run-page.ts    Vite build + preview + Playwright, with CSP/throttle/screenshot options
   │  └─ smoke.parity.test.ts
   ├─ s1-koota/         churn.parity.test.ts, snapshot.ts, snapshot.parity.test.ts, bench.html, bench.ts, expected.ts
   ├─ s2-rapier/        scene.ts, rapier.parity.test.ts, csp.html, csp.ts, expected.ts
   ├─ s3-three/         index.html, main.ts, compare.ts
   ├─ s4-pixi/          index.html, main.ts, dither.ts
   ├─ s5-math/          dmath.ts, dmath.parity.test.ts, dmath.accuracy.node.test.ts, dmath.bench.node.test.ts, expected.ts
   └─ s6-ruken/         protocol.ts, allowlist.ts, sdk-stub.ts, mock-host.ts, *.node.test.ts
```

---

### Task 1: Root bootstrap

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `biome.json`, `lefthook.yml`, `.nvmrc`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`

**Interfaces:**
- Produces: root scripts `pnpm lint`, `pnpm format`, `pnpm test`, `pnpm typecheck`, and `tsconfig.base.json`, which every package extends.

- [ ] **Step 1: Write the root config files**

`package.json`:
```json
{
  "name": "automata-framework",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.33.4",
  "engines": { "node": ">=24" },
  "scripts": {
    "lint": "biome check .",
    "format": "biome check --write .",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
  - tooling/*
  - examples/*
  - spikes
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] }
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

`biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.15/schema.json",
  "files": { "includes": ["**", "!**/dist", "!**/node_modules", "!**/__goldens__", "!**/.turbo"] },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 110 },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" } },
  "linter": { "enabled": true, "rules": { "recommended": true } }
}
```

`lefthook.yml`:
```yaml
pre-commit:
  commands:
    biome:
      glob: "*.{ts,js,json,jsonc}"
      run: pnpm exec biome check --no-errors-on-unmatched {staged_files}
```

`.nvmrc`:
```
24
```

`.gitignore`:
```
node_modules/
dist/
.turbo/
spikes/out/
*.log
.DS_Store
```

`CLAUDE.md`:
```
@AGENTS.md
```

`AGENTS.md`:
```markdown
# AutomataFramework — Agent Rules

Read `docs/superpowers/specs/2026-10-01-automata-framework-overview-design.md` first. Then read the spec for the phase you are working on.

- **Strict TDD** in `packages/`, `tooling/`, `examples/`: write a failing test first, then make the minimal change. (`spikes/` is exempt; see the A0+A1 spec §2.)
- **Seven laws** (overview spec §2). In particular: only the sim changes gameplay state; the sim has no I/O, wall-clock or `Math.random`; the host is a port.
- **Naming:** role suffixes (`*.component.ts`, `*.system.ts`, `*.command.ts`, `*.event.ts`, `*.resource.ts`, `*.plugin.ts`, `*.manager.ts`, `*.schema.ts`, `*.migration.ts`, `*.test.ts`). Folders group by feature.
- **Determinism is cross-engine:** goldens must match bit-for-bit in Node, Chromium, WebKit and Firefox. Never accept a hash mismatch as "flaky".
- Conventional Commits. Packages publish as `@snekprty/automata-<name>` (GitHub Packages, `SNEKPRTY/automata-framework`).
- Heavy GPU, visual and E2E suites run on the Linux GPU runner (from A3), not on the developer Mac.
```

- [ ] **Step 2: Install the root dev tools**

Run: `pnpm add -Dw @biomejs/biome@2.5.15 turbo@2.11.6 typescript@7.0.2 lefthook@2.1.16 && pnpm exec lefthook install`
Expected: install succeeds, and lefthook prints `sync hooks: ✔️ (pre-commit)`.

- [ ] **Step 3: Verify that lint runs clean**

Run: `pnpm lint`
Expected: exits 0 (for example, "Checked N files … No fixes applied").

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: bootstrap monorepo tooling (pnpm, turbo, TS, Biome, lefthook)"
```

---

### Task 2: Spikes package and the cross-engine parity harness

**Files:**
- Create: `spikes/package.json`, `spikes/tsconfig.json`, `spikes/vitest.config.ts`
- Create: `spikes/shared/hash.ts`, `spikes/shared/prng.ts`, `spikes/shared/run-page.ts`, `spikes/shared/smoke.parity.test.ts`, `spikes/shared/smoke.html`, `spikes/shared/smoke.ts`

**Interfaces:**
- Produces:
  - `sha256Hex(bytes: Uint8Array): Promise<string>` (lowercase hex)
  - `f64Bytes(values: ArrayLike<number>): Uint8Array` (little-endian Float64 bytes)
  - `mulberry32(seed: number): () => number` (uniform in [0, 1), 32-bit integer math only)
  - CLI `node spikes/shared/run-page.ts --page <path.html> [--browser chromium|webkit|firefox] [--query k=v&…] [--csp] [--throttle N] [--headed] [--screenshot file.png] [--timeout ms]`. It prints the page's `window.__result` as JSON to stdout. It exits 1 on a timeout, a CSP violation, or `__result.ok === false`.
  - Vitest projects: `node` runs `**/*.parity.test.ts` and `**/*.node.test.ts`; `browsers` runs `**/*.parity.test.ts` in Chromium, WebKit and Firefox.

- [ ] **Step 1: Write the package files**

`spikes/package.json`:
```json
{
  "name": "@spikes/all",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:node": "vitest run --project node",
    "test:browsers": "vitest run --project browsers"
  }
}
```

`spikes/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "compilerOptions": { "types": ["vite/client"] }, "include": ["**/*.ts"] }
```

`spikes/vitest.config.ts`:
```ts
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 120_000,
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.parity.test.ts', '**/*.node.test.ts'],
        },
      },
      {
        test: {
          name: 'browsers',
          include: ['**/*.parity.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'webkit' }, { browser: 'firefox' }],
          },
        },
      },
    ],
  },
})
```

- [ ] **Step 2: Install the spike dependencies and browsers**

Run:
```bash
pnpm --filter @spikes/all add -D vitest@5.0.3 @vitest/browser-playwright@5.0.3 playwright@1.63.0 vite@8.3.2 \
  koota@0.6.6 @dimforge/rapier3d-deterministic-compat@0.21.0 @dimforge/rapier2d-deterministic-compat@0.21.0 \
  three@0.186.1 @types/three pixi.js@8.21.0 pixelmatch@7.2.0 pngjs@7.0.0 @types/pngjs @types/node
pnpm --filter @spikes/all exec playwright install chromium webkit firefox
```
Expected: the install succeeds and the browsers download.

- [ ] **Step 3: Write the shared helpers**

`spikes/shared/hash.ts`:
```ts
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Little-endian Float64 bytes, written explicitly so the platform's endianness can't matter. */
export function f64Bytes(values: ArrayLike<number>): Uint8Array {
  const view = new DataView(new ArrayBuffer(values.length * 8))
  for (let i = 0; i < values.length; i++) view.setFloat64(i * 8, values[i] as number, true)
  return new Uint8Array(view.buffer)
}
```

`spikes/shared/prng.ts`:
```ts
/** mulberry32: 32-bit integer ops only (Math.imul, >>>, ^), so it is bit-exact in every engine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

- [ ] **Step 4: Write the smoke parity test (proves the harness runs everywhere)**

`spikes/shared/smoke.parity.test.ts`:
```ts
import { expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from './hash'
import { mulberry32 } from './prng'

test('mulberry32 + sha256 are identical in every engine', async () => {
  const rand = mulberry32(42)
  const values = Array.from({ length: 10_000 }, () => rand())
  expect(values.length).toBe(10_000)
  expect(await sha256Hex(f64Bytes(values))).toBe(SMOKE_EXPECTED)
})

const SMOKE_EXPECTED = 'replace-with-node-hash'
```

- [ ] **Step 5: Run it in Node to get the expected hash**

Run: `pnpm --filter @spikes/all test:node -- shared/smoke`
Expected: FAIL. The message reads `expected '<64-hex>' to be 'replace-with-node-hash'`. Copy that 64-hex value into `SMOKE_EXPECTED`.

- [ ] **Step 6: Run all four engines**

Run: `pnpm --filter @spikes/all test -- shared/smoke`
Expected: PASS in 4 runs (node, chromium, webkit, firefox).

- [ ] **Step 7: Write the page runner**

`spikes/shared/run-page.ts`:
```ts
import { mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const spikesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:"

const { values } = parseArgs({
  options: {
    page: { type: 'string' },
    browser: { type: 'string', default: 'chromium' },
    query: { type: 'string', default: '' },
    csp: { type: 'boolean', default: false },
    throttle: { type: 'string', default: '1' },
    headed: { type: 'boolean', default: false },
    screenshot: { type: 'string' },
    timeout: { type: 'string', default: '60000' },
  },
})
if (!values.page) throw new Error('--page is required (path relative to spikes/, e.g. s2-rapier/csp.html)')

const outDir = join(spikesRoot, 'out', values.page.replace(/[/.]/g, '_'))
await build({
  root: spikesRoot,
  base: './',
  logLevel: 'warn',
  build: { outDir, emptyOutDir: true, rollupOptions: { input: join(spikesRoot, values.page) } },
})
const server = await preview({
  root: spikesRoot,
  base: './',
  build: { outDir },
  preview: { port: 0, headers: values.csp ? { 'Content-Security-Policy': CSP } : {} },
  logLevel: 'warn',
})
const origin = server.resolvedUrls?.local[0]
if (!origin) throw new Error('preview server did not report a URL')

const browserType = { chromium, webkit, firefox }[values.browser as 'chromium' | 'webkit' | 'firefox']
const browser = await browserType.launch({
  headless: !values.headed,
  args: values.browser === 'chromium' ? ['--enable-unsafe-webgpu', '--enable-features=Vulkan'] : [],
})
const page = await browser.newPage({ viewport: { width: 480, height: 270 } })
const violations: string[] = []
page.on('console', (m) => {
  if (m.type() === 'error') console.error(`[page] ${m.text()}`)
})
await page.exposeFunction('__reportCspViolation', (v: string) => violations.push(v))
await page.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', (e) => {
    ;(window as unknown as { __reportCspViolation: (v: string) => void }).__reportCspViolation(
      `${e.violatedDirective} ${e.blockedURI}`,
    )
  })
})
if (values.browser === 'chromium' && Number(values.throttle) > 1) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(values.throttle) })
}

const pagePath = relative(spikesRoot, join(spikesRoot, values.page)).replaceAll('\\', '/')
await page.goto(`${origin}${pagePath}${values.query ? `?${values.query}` : ''}`)
let result: { ok?: boolean } & Record<string, unknown>
try {
  await page.waitForFunction(() => (window as unknown as { __result?: unknown }).__result !== undefined, null, {
    timeout: Number(values.timeout),
  })
  result = await page.evaluate(() => (window as unknown as { __result: never }).__result)
} catch (err) {
  console.error(`TIMEOUT waiting for window.__result: ${String(err)}`)
  await browser.close()
  await server.close()
  process.exit(1)
}
if (values.screenshot) {
  mkdirSync(dirname(values.screenshot), { recursive: true })
  await page.locator('canvas').first().screenshot({ path: values.screenshot })
}
await browser.close()
await server.close()

console.log(JSON.stringify({ browser: values.browser, csp: values.csp, violations, ...result }, null, 2))
if (violations.length > 0 || result.ok === false) process.exit(1)
```

`spikes/shared/smoke.html`:
```html
<!doctype html>
<html><head><meta charset="utf-8" /></head><body><canvas width="8" height="8"></canvas>
<script type="module" src="./smoke.ts"></script></body></html>
```

`spikes/shared/smoke.ts`:
```ts
;(window as unknown as { __result: unknown }).__result = { ok: true, userAgent: navigator.userAgent }
```

- [ ] **Step 8: Verify the runner, including under the CSP**

Run: `node spikes/shared/run-page.ts --page shared/smoke.html --csp`
Expected: JSON on stdout containing `"ok": true` and `"violations": []`, and exit code 0.

If Vite 8 warns that `rollupOptions` is deprecated, rename the key to `rolldownOptions` (same shape) and re-run.

- [ ] **Step 9: Commit**

```bash
git add spikes pnpm-lock.yaml package.json
git commit -m "chore(spikes): cross-engine parity harness and Playwright page runner"
```

---

### Task 3: S1, Koota determinism, snapshot and performance

**Files:**
- Create: `spikes/s1-koota/world.ts`, `spikes/s1-koota/churn.parity.test.ts`, `spikes/s1-koota/snapshot.ts`, `spikes/s1-koota/snapshot.parity.test.ts`, `spikes/s1-koota/expected.ts`, `spikes/s1-koota/bench.html`, `spikes/s1-koota/bench.ts`, `docs/spikes/s1-koota.md`

**Interfaces:**
- Consumes: `sha256Hex`, `f64Bytes`, `mulberry32` (Task 2); `run-page.ts` (Task 2).
- Produces: the verdict document `docs/spikes/s1-koota.md`. It must answer four questions:
  - (a) Is iteration order deterministic across engines?
  - (b) Is the order ascending by `entity.id()`?
  - (c) Are IDs recycled?
  - (d) Can relation data be serialized, and how?

  It also records ms/tick numbers, and gives a verdict of KOOTA or MINIPLEX.

- [ ] **Step 1: Write the shared world definition**

`spikes/s1-koota/world.ts`:
```ts
import { createWorld, relation, trait, type World } from 'koota'
import { mulberry32 } from '../shared/prng'

export const StableId = trait({ value: 0 })
export const Position = trait({ x: 0, y: 0 })
export const Velocity = trait({ x: 0, y: 0 })
export const Health = trait({ hp: 0 })
export const Contains = relation({ store: { amount: 0 } })

export type Sim = { world: World; nextId: number }

/** Koota caps the number of live worlds, so tests destroy every world they create (see destroyWorlds). */
const created: World[] = []
export function createSimWorld(): Sim {
  const world = createWorld()
  created.push(world)
  return { world, nextId: 1 }
}
export function destroyWorlds(): void {
  for (const w of created.splice(0)) w.destroy()
}

export function spawnBody(sim: Sim, x: number, y: number, vx: number, vy: number) {
  return sim.world.spawn(
    StableId({ value: sim.nextId++ }),
    Position({ x: Math.fround(x), y: Math.fround(y) }),
    Velocity({ x: Math.fround(vx), y: Math.fround(vy) }),
  )
}

/** Seeded structural churn: spawn, destroy, add or remove a trait, add a relation. */
export function churn(sim: Sim, seed: number, ops: number) {
  const rand = mulberry32(seed)
  const alive: ReturnType<typeof spawnBody>[] = []
  for (let i = 0; i < ops; i++) {
    const r = rand()
    if (r < 0.5 || alive.length === 0) {
      alive.push(spawnBody(sim, rand() * 100, rand() * 100, rand() - 0.5, rand() - 0.5))
    } else if (r < 0.7) {
      const idx = Math.floor(rand() * alive.length)
      alive[idx]?.destroy()
      alive.splice(idx, 1)
    } else if (r < 0.85) {
      const e = alive[Math.floor(rand() * alive.length)]
      if (e && !e.has(Health)) e.add(Health({ hp: Math.floor(rand() * 100) }))
      else e?.remove(Health)
    } else {
      const a = alive[Math.floor(rand() * alive.length)]
      const b = alive[Math.floor(rand() * alive.length)]
      if (a && b && a !== b) a.add(Contains(b, { amount: Math.floor(rand() * 10) }))
    }
  }
  return alive
}

/** One fixed step: pos += vel * dt, with f32 rounding. */
export function step(sim: Sim, dt: number) {
  sim.world.query(Position, Velocity).updateEach(([p, v]) => {
    p.x = Math.fround(p.x + v.x * dt)
    p.y = Math.fround(p.y + v.y * dt)
  })
}
```

- [ ] **Step 2: Write the churn parity test (questions a, b and c)**

`spikes/s1-koota/churn.parity.test.ts`:
```ts
import { afterEach, expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { CHURN_ORDER_EXPECTED } from './expected'
import { Health, Position, StableId, churn, createSimWorld, destroyWorlds } from './world'

afterEach(destroyWorlds)

test('query iteration order after 10k seeded ops is identical in every engine', async () => {
  const sim = createSimWorld()
  churn(sim, 1234, 10_000)
  const rows: number[] = []
  for (const e of sim.world.query(Position, Health)) {
    rows.push(e.id(), e.get(StableId)!.value, e.get(Position)!.x, e.get(Health)!.hp)
  }
  expect(rows.length / 4).toBeGreaterThan(500) // Review Focus #1: not vacuous
  expect(await sha256Hex(f64Bytes(rows))).toBe(CHURN_ORDER_EXPECTED)
})

test('records whether iteration is ascending by entity.id() (informational, for the verdict)', () => {
  const sim = createSimWorld()
  churn(sim, 1234, 10_000)
  const ids = [...sim.world.query(Position)].map((e) => e.id())
  const ascending = ids.every((id, i) => i === 0 || id > (ids[i - 1] as number))
  console.log(`[S1] ascending-by-id=${ascending} count=${ids.length}`)
})

test('records whether destroyed ids are recycled (informational, for the verdict)', () => {
  const sim = createSimWorld()
  const a = sim.world.spawn(Position)
  const idA = a.id()
  a.destroy()
  const b = sim.world.spawn(Position)
  console.log(`[S1] recycled=${b.id() === idA}`)
})
```

`spikes/s1-koota/expected.ts`:
```ts
export const CHURN_ORDER_EXPECTED = 'replace-with-node-hash'
export const SNAPSHOT_CONTINUE_EXPECTED = 'replace-with-node-hash'
```

- [ ] **Step 3: Get the Node hash, then run all engines**

Run: `pnpm --filter @spikes/all test:node -- s1-koota/churn`
Expected: the order test FAILs with `expected '<hex>' to be 'replace-with-node-hash'`. Paste the hex into `CHURN_ORDER_EXPECTED`, then run:

Run: `pnpm --filter @spikes/all test -- s1-koota/churn`
Expected: PASS in all 4 engines. Record the `[S1]` log lines for the verdict. **If a browser fails, that is a finding, not a bug to suppress.** Record which engine failed and how.

- [ ] **Step 4: Write the snapshot serializer (question d)**

`spikes/s1-koota/snapshot.ts`:
```ts
import { Contains, Health, Position, StableId, Velocity, type Sim } from './world'

type Row = {
  sid: number
  pos?: [number, number]
  vel?: [number, number]
  hp?: number
  contains: Array<[number, number]> // [target sid, amount]
}
export type Snapshot = { nextId: number; rows: Row[] }

/** Canonical snapshot: rows sorted by StableId, relation targets sorted by target StableId. */
export function takeSnapshot(sim: Sim): Snapshot {
  const rows: Row[] = []
  for (const e of sim.world.query(StableId)) {
    const row: Row = { sid: e.get(StableId)!.value, contains: [] }
    if (e.has(Position)) { const p = e.get(Position)!; row.pos = [p.x, p.y] }
    if (e.has(Velocity)) { const v = e.get(Velocity)!; row.vel = [v.x, v.y] }
    if (e.has(Health)) row.hp = e.get(Health)!.hp
    for (const t of e.targetsFor(Contains)) {
      row.contains.push([t.get(StableId)!.value, e.get(Contains(t))!.amount])
    }
    row.contains.sort((a, b) => a[0] - b[0])
    rows.push(row)
  }
  rows.sort((a, b) => a.sid - b.sid)
  return { nextId: sim.nextId, rows }
}

/** Rebuild into a fresh world: spawn in StableId order first, then add relations. */
export function restoreSnapshot(snap: Snapshot, into: Sim): void {
  into.nextId = snap.nextId
  const bySid = new Map<number, ReturnType<Sim['world']['spawn']>>()
  for (const r of snap.rows) {
    const e = into.world.spawn(StableId({ value: r.sid }))
    if (r.pos) e.add(Position({ x: r.pos[0], y: r.pos[1] }))
    if (r.vel) e.add(Velocity({ x: r.vel[0], y: r.vel[1] }))
    if (r.hp !== undefined) e.add(Health({ hp: r.hp }))
    bySid.set(r.sid, e)
  }
  for (const r of snap.rows) {
    for (const [targetSid, amount] of r.contains) {
      bySid.get(r.sid)!.add(Contains(bySid.get(targetSid)!, { amount }))
    }
  }
}

export function snapshotBytes(snap: Snapshot): number[] {
  const out: number[] = [snap.nextId, snap.rows.length]
  for (const r of snap.rows) {
    out.push(r.sid, r.pos?.[0] ?? NaN, r.pos?.[1] ?? NaN, r.vel?.[0] ?? NaN, r.vel?.[1] ?? NaN, r.hp ?? -1)
    out.push(r.contains.length, ...r.contains.flat())
  }
  return out
}
```

- [ ] **Step 5: Write the snapshot, restore and continue parity test**

`spikes/s1-koota/snapshot.parity.test.ts`:
```ts
import { afterEach, expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { SNAPSHOT_CONTINUE_EXPECTED } from './expected'
import { restoreSnapshot, snapshotBytes, takeSnapshot } from './snapshot'
import { churn, createSimWorld, destroyWorlds, step } from './world'

afterEach(destroyWorlds)

const DT = 1 / 60

async function hashOf(sim: Parameters<typeof takeSnapshot>[0]) {
  return sha256Hex(f64Bytes(snapshotBytes(takeSnapshot(sim))))
}

test('snapshot at tick 150, restore into a fresh world, continue to 300 == uninterrupted 300', async () => {
  const a = createSimWorld()
  churn(a, 99, 5_000)
  for (let t = 0; t < 300; t++) step(a, DT)
  const uninterrupted = await hashOf(a)

  const b = createSimWorld()
  churn(b, 99, 5_000)
  for (let t = 0; t < 150; t++) step(b, DT)
  const snap = takeSnapshot(b)
  expect(snap.rows.some((r) => r.contains.length > 0)).toBe(true) // Review Focus #4: relations present
  expect(snap.rows.length).toBeGreaterThan(1_000) // Review Focus #1

  const c = createSimWorld()
  restoreSnapshot(snap, c)
  for (let t = 150; t < 300; t++) step(c, DT)

  expect(await hashOf(c)).toBe(uninterrupted)
  expect(uninterrupted).toBe(SNAPSHOT_CONTINUE_EXPECTED)
})

test('a destroy-then-spawn recycled id survives the round trip under its StableId', async () => {
  const a = createSimWorld()
  churn(a, 7, 200)
  const snap = takeSnapshot(a)
  const c = createSimWorld()
  restoreSnapshot(snap, c)
  expect(await hashOf(c)).toBe(await hashOf(a))
  expect(c.nextId).toBe(a.nextId)
})
```

- [ ] **Step 6: Get the Node hash, then run all engines**

Run: `pnpm --filter @spikes/all test:node -- s1-koota/snapshot`
Expected: only the `SNAPSHOT_CONTINUE_EXPECTED` assertion fails (the first `toBe` must already PASS). Paste the hex in, then:

Run: `pnpm --filter @spikes/all test -- s1-koota`
Expected: every S1 test passes in all 4 engines.

- [ ] **Step 7: Write the throttled performance benchmark**

`spikes/s1-koota/bench.html`:
```html
<!doctype html>
<html><head><meta charset="utf-8" /></head><body><canvas width="8" height="8"></canvas>
<script type="module" src="./bench.ts"></script></body></html>
```

`spikes/s1-koota/bench.ts`:
```ts
import { Health, Position, Velocity, churn, createSimWorld, step } from './world'

const sim = createSimWorld()
churn(sim, 5, 4_000) // about 2k live entities
const live = sim.world.query(Position).length
const TICKS = 600
const t0 = performance.now()
for (let t = 0; t < TICKS; t++) {
  step(sim, 1 / 60)
  sim.world.query(Health).updateEach(([h]) => {
    h.hp = Math.max(0, h.hp - 1)
  })
  sim.world.query(Position, Velocity).readEach(([p]) => void p.x)
}
const msPerTick = (performance.now() - t0) / TICKS
;(window as unknown as { __result: unknown }).__result = { ok: true, live, msPerTick }
```

- [ ] **Step 8: Run the benchmark unthrottled and at 4× throttle**

Run:
```bash
node spikes/shared/run-page.ts --page s1-koota/bench.html
node spikes/shared/run-page.ts --page s1-koota/bench.html --throttle 4
```
Expected: two JSON results with `live` around 2000 and a `msPerTick` value. Record both. The budget for comparison: the whole sim gets about 8 ms of a 33 ms (30 FPS) frame, and this toy load should use well under 2 ms at 4×.

- [ ] **Step 9: Write the verdict**

`docs/spikes/s1-koota.md`: fill in every bracketed field from the recorded outputs.
```markdown
# S1 — Koota determinism and snapshot

- **Question:** Is Koota 0.6.6 deterministic across engines, and can its world be snapshotted and restored canonically?
- **Method:** `spikes/s1-koota/*`. Churn parity over 10k ops; snapshot at tick 150, restore and continue vs uninterrupted run; 2k-entity benchmark at 1× and 4× CPU throttle.

## Results
| Check | Node | Chromium | WebKit | Firefox |
|---|---|---|---|---|
| Churn order hash | [PASS/FAIL] | … | … | … |
| Snapshot→restore→continue | … | … | … | … |

- Iteration ascending by `entity.id()`: [true/false]
- IDs recycled after destroy: [true/false]. Consequence: the facade must use its own `StableId` (already decided in spec §4.4).
- Relations with data serialize via `targetsFor` + `get(Contains(t))`: [works/doesn't]
- msPerTick at ~2k entities: 1× [n] ms, 4× [n] ms

## Verdict
[KOOTA | MINIPLEX], because [one or two sentences].

## Consequences for Plan 2 (A1)
- Facade ordering rule: [e.g. "iterate in native order; it is deterministic" OR "sort by StableId in every order-sensitive query"]
- Relation snapshot section: [the encoding used above, or an alternative]
- Restore strategy: [spawn in StableId order, then relations]
```

- [ ] **Step 10: Commit**

```bash
git add spikes/s1-koota docs/spikes/s1-koota.md
git commit -m "spike(s1): Koota cross-engine determinism, snapshot/restore, perf — verdict"
```

---

### Task 4: S2, Rapier deterministic builds (parity and CSP)

**Files:**
- Create: `spikes/s2-rapier/scene.ts`, `spikes/s2-rapier/rapier.parity.test.ts`, `spikes/s2-rapier/expected.ts`, `spikes/s2-rapier/csp.html`, `spikes/s2-rapier/csp.ts`, `docs/spikes/s2-rapier.md`

**Interfaces:**
- Consumes: `sha256Hex`, `f64Bytes`, `mulberry32`, `run-page.ts`.
- Produces: `run3d(ticks, restoreAt?)` and `run2d(ticks, restoreAt?)`, each returning `{ bodies: number; translations: number[]; snapshot: Uint8Array }`. Also the verdict document.

- [ ] **Step 1: Write the scenes**

`spikes/s2-rapier/scene.ts`:
```ts
import R2 from '@dimforge/rapier2d-deterministic-compat'
import R3 from '@dimforge/rapier3d-deterministic-compat'
import { mulberry32 } from '../shared/prng'

let ready: Promise<void> | undefined
export function initRapier() {
  ready ??= Promise.all([R3.init(), R2.init()]).then(() => undefined)
  return ready
}

export type RunOut = { bodies: number; translations: number[]; snapshot: Uint8Array }

export function run3d(ticks: number, restoreAt?: number): RunOut {
  let world = new R3.World({ x: 0, y: -9.81, z: 0 })
  world.createCollider(R3.ColliderDesc.cuboid(50, 0.5, 50))
  const rand = mulberry32(3)
  for (let i = 0; i < 40; i++) {
    const body = world.createRigidBody(
      R3.RigidBodyDesc.dynamic().setTranslation(rand() * 10 - 5, 2 + i * 0.6, rand() * 10 - 5),
    )
    world.createCollider(R3.ColliderDesc.ball(0.3 + rand() * 0.2).setRestitution(0.4), body)
  }
  for (let t = 0; t < ticks; t++) {
    if (t === restoreAt) world = R3.World.restoreSnapshot(world.takeSnapshot())
    world.step()
  }
  const translations: number[] = []
  world.forEachRigidBody((b) => {
    const p = b.translation()
    translations.push(b.handle, p.x, p.y, p.z)
  })
  return { bodies: translations.length / 4, translations, snapshot: world.takeSnapshot() }
}

export function run2d(ticks: number, restoreAt?: number): RunOut {
  let world = new R2.World({ x: 0, y: -9.81 })
  world.createCollider(R2.ColliderDesc.cuboid(50, 0.5))
  const rand = mulberry32(4)
  for (let i = 0; i < 40; i++) {
    const body = world.createRigidBody(R2.RigidBodyDesc.dynamic().setTranslation(rand() * 10 - 5, 2 + i * 0.6))
    world.createCollider(R2.ColliderDesc.ball(0.3 + rand() * 0.2).setRestitution(0.4), body)
  }
  for (let t = 0; t < ticks; t++) {
    if (t === restoreAt) world = R2.World.restoreSnapshot(world.takeSnapshot())
    world.step()
  }
  const translations: number[] = []
  world.forEachRigidBody((b) => {
    const p = b.translation()
    translations.push(b.handle, p.x, p.y)
  })
  return { bodies: translations.length / 3, translations, snapshot: world.takeSnapshot() }
}
```

- [ ] **Step 2: Write the parity tests**

`spikes/s2-rapier/expected.ts`:
```ts
export const R3_EXPECTED = 'replace-with-node-hash'
export const R2_EXPECTED = 'replace-with-node-hash'
```

`spikes/s2-rapier/rapier.parity.test.ts`:
```ts
import { beforeAll, expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { R2_EXPECTED, R3_EXPECTED } from './expected'
import { initRapier, run2d, run3d } from './scene'

beforeAll(() => initRapier())

test('3D: 300 steps produce identical translations in every engine; mid-run restore changes nothing', async () => {
  const straight = run3d(300)
  const restored = run3d(300, 150)
  expect(straight.bodies).toBe(40) // Review Focus #1
  const h = await sha256Hex(f64Bytes(straight.translations))
  expect(await sha256Hex(f64Bytes(restored.translations))).toBe(h)
  expect(h).toBe(R3_EXPECTED)
  console.log(`[S2] 3d snapshot-bytes sha=${await sha256Hex(straight.snapshot)} len=${straight.snapshot.length}`)
})

test('2D: 300 steps produce identical translations in every engine; mid-run restore changes nothing', async () => {
  const straight = run2d(300)
  const restored = run2d(300, 150)
  expect(straight.bodies).toBe(40)
  const h = await sha256Hex(f64Bytes(straight.translations))
  expect(await sha256Hex(f64Bytes(restored.translations))).toBe(h)
  expect(h).toBe(R2_EXPECTED)
  console.log(`[S2] 2d snapshot-bytes sha=${await sha256Hex(straight.snapshot)} len=${straight.snapshot.length}`)
})
```

- [ ] **Step 3: Get the Node hashes, then run all engines**

Run: `pnpm --filter @spikes/all test:node -- s2-rapier`
Expected: only the `toBe(R3_EXPECTED)` and `toBe(R2_EXPECTED)` assertions fail. Paste in the two hex values, then:

Run: `pnpm --filter @spikes/all test -- s2-rapier`
Expected: PASS in all 4 engines. Also record whether the `[S2] snapshot-bytes sha=` lines match across engines; this is informational. **Any engine mismatch is the S2 FAIL condition** and must be escalated before A1 (spec §2).

- [ ] **Step 4: Write the CSP page (Review Focus #3: ok only after a real step)**

`spikes/s2-rapier/csp.html`:
```html
<!doctype html>
<html><head><meta charset="utf-8" /></head><body><canvas width="8" height="8"></canvas>
<script type="module" src="./csp.ts"></script></body></html>
```

`spikes/s2-rapier/csp.ts`:
```ts
import { initRapier, run2d, run3d } from './scene'

const out: Record<string, unknown> = { ok: false }
try {
  await initRapier()
  const a = run3d(30)
  const b = run2d(30)
  const fell3 = (a.translations[2] as number) < 2 // body 0 started at y=2 and has fallen
  const fell2 = (b.translations[2] as number) < 2
  Object.assign(out, { ok: fell3 && fell2, bodies3d: a.bodies, bodies2d: b.bodies })
} catch (err) {
  out.error = String(err)
}
;(window as unknown as { __result: unknown }).__result = out
```

- [ ] **Step 5: Run the CSP check in every browser**

Run:
```bash
for b in chromium webkit firefox; do node spikes/shared/run-page.ts --page s2-rapier/csp.html --csp --browser $b || echo "FAIL $b"; done
```
Expected: three JSON results, each with `"ok": true`, `"violations": []`, and no `FAIL` lines.

- [ ] **Step 6: Measure the wasm payload**

Run:
```bash
for p in rapier3d-deterministic-compat rapier2d-deterministic-compat; do f=$(ls spikes/node_modules/@dimforge/$p/rapier.mjs 2>/dev/null || ls spikes/node_modules/@dimforge/$p/dist/rapier.mjs); echo "$p raw=$(wc -c <"$f") gzip=$(gzip -c "$f" | wc -c)"; done
```
Expected: two lines with byte counts. Record them.

- [ ] **Step 7: Write the verdict**

`docs/spikes/s2-rapier.md`:
```markdown
# S2 — Rapier deterministic builds

- **Question:** Do `@dimforge/rapier{2d,3d}-deterministic-compat@0.21.0` produce bit-identical results in Node, Chromium, WebKit and Firefox, survive snapshot/restore mid-run, and load under `script-src 'self' 'wasm-unsafe-eval'`?

## Results
| Check | Node | Chromium | WebKit | Firefox |
|---|---|---|---|---|
| 3D translations hash | … | … | … | … |
| 2D translations hash | … | … | … | … |
| Snapshot bytes identical (informational) | … | … | … | … |
| CSP load + step (`ok`, no violations) | n/a | … | … | … |

- Payload (raw / gzip): 3D [n] / [n] bytes; 2D [n] / [n] bytes. Ruken warns above a 50 MB zip, so this is [fine/concern].

## Verdict
[PASS | FAIL → escalate], because [reason].

## Consequences for Plan 2
- Package choice: the `-deterministic-compat` builds (wasm inlined as base64, so no bundler wasm plugin is needed).
- Physics snapshot section: Rapier `takeSnapshot()` bytes, [hashable directly / hash translations instead].
```

- [ ] **Step 8: Commit**

```bash
git add spikes/s2-rapier docs/spikes/s2-rapier.md
git commit -m "spike(s2): Rapier deterministic 2D/3D parity, restore, CSP — verdict"
```

---

### Task 5: S5, deterministic math

**Files:**
- Create: `spikes/s5-math/dmath.ts`, `spikes/s5-math/dmath.parity.test.ts`, `spikes/s5-math/dmath.accuracy.node.test.ts`, `spikes/s5-math/dmath.bench.node.test.ts`, `spikes/s5-math/expected.ts`, `docs/spikes/s5-math.md`

**Interfaces:**
- Produces: `sin`, `cos`, `tan`, `atan`, `atan2(y, x)`, `exp`, `log`, `pow(x, y)`, `hypot(x, y)`, all `(…number) => number`. They are built only from `+ - * /`, `Math.sqrt`, `Math.fround`, `Math.round/floor/ceil/trunc/abs/min/max/sign`, `Number.isNaN/isFinite/isInteger` and `DataView` bit access. Plan 2 copies this file into `automata-sim/math`.

- [ ] **Step 1: Write the deterministic math module (fdlibm-derived kernels)**

`spikes/s5-math/dmath.ts`:
```ts
// Deterministic math built from operations IEEE-754 requires to be correctly rounded.
// Kernels and constants are adapted from fdlibm (Sun Microsystems, freely redistributable).

const scratch = new DataView(new ArrayBuffer(8))

// --- sin / cos / tan -------------------------------------------------------
const INV_PIO2 = 6.36619772367581382433e-1
const PIO2_1 = 1.57079632673412561417e0 // first 33 bits of pi/2
const PIO2_1T = 6.07710050650619224932e-11 // pi/2 - PIO2_1
const S1 = -1.66666666666666324348e-1
const S2 = 8.33333333332248946124e-3
const S3 = -1.98412698298579493134e-4
const S4 = 2.75573137070700676789e-6
const S5 = -2.50507602534068634195e-8
const S6 = 1.58969099521155010221e-10
const C1 = 4.16666666666666019037e-2
const C2 = -1.38888888888741095749e-3
const C3 = 2.48015872894767294178e-5
const C4 = -2.75573143513906633035e-7
const C5 = 2.08757232129817482790e-9
const C6 = -1.13596475577881948265e-11

function kSin(x: number): number {
  const z = x * x
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))
  return x + x * z * (S1 + z * r)
}
function kCos(x: number): number {
  const z = x * x
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))))
  return 1 - 0.5 * z + z * r
}

let redQ = 0
let redR = 0
/** Cody–Waite reduction. Accurate for |x| < 2^19 * pi/2 (~8.2e5); deterministic for every finite x. */
function reduce(x: number): void {
  const n = Math.round(x * INV_PIO2)
  redR = x - n * PIO2_1 - n * PIO2_1T
  redQ = ((n % 4) + 4) % 4
}

export function sin(x: number): number {
  if (!Number.isFinite(x)) return Number.NaN
  reduce(x)
  return redQ === 0 ? kSin(redR) : redQ === 1 ? kCos(redR) : redQ === 2 ? -kSin(redR) : -kCos(redR)
}
export function cos(x: number): number {
  if (!Number.isFinite(x)) return Number.NaN
  reduce(x)
  return redQ === 0 ? kCos(redR) : redQ === 1 ? -kSin(redR) : redQ === 2 ? -kCos(redR) : kSin(redR)
}
export function tan(x: number): number {
  return sin(x) / cos(x)
}

// --- atan / atan2 ----------------------------------------------------------
const ATANHI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.570796326794896558e0]
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17]
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.1111110405462355788e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2, -5.83357013379057348645e-2,
  4.97687799461593236017e-2, -3.6531572744216915527e-2, 1.62858201153657823623e-2,
] as const
const PI = 3.141592653589793116e0
const PI_LO = 1.2246467991473531772e-16
const PIO2 = 1.570796326794896558e0

export function atan(x0: number): number {
  if (Number.isNaN(x0)) return Number.NaN
  const neg = x0 < 0
  let x = Math.abs(x0)
  if (x >= 4.4e16) return neg ? -(PIO2 + ATANLO[3]!) : PIO2 + ATANLO[3]!
  let id: number
  if (x < 0.4375) id = -1
  else if (x < 0.6875) { id = 0; x = (2 * x - 1) / (2 + x) }
  else if (x < 1.1875) { id = 1; x = (x - 1) / (x + 1) }
  else if (x < 2.4375) { id = 2; x = (x - 1.5) / (1 + 1.5 * x) }
  else { id = 3; x = -1 / x }
  const z = x * x
  const w = z * z
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))))
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))))
  const r = id < 0 ? x - x * (s1 + s2) : ATANHI[id]! - (x * (s1 + s2) - ATANLO[id]! - x)
  return neg ? -r : r
}

/** Finite inputs only (sim values are finite). atan2(0, 0) = 0 by convention here. */
export function atan2(y: number, x: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return Number.NaN
  if (x === 0) return y > 0 ? PIO2 : y < 0 ? -PIO2 : 0
  const z = atan(Math.abs(y / x))
  if (x > 0) return y < 0 ? -z : z
  return y < 0 ? z - PI_LO - PI : PI - (z - PI_LO)
}

// --- exp / log / pow -------------------------------------------------------
const LN2_HI = 6.9314718036912381649e-1
const LN2_LO = 1.90821492927058770002e-10
const INV_LN2 = 1.442695040888963387e0
const P1 = 1.66666666666666019037e-1
const P2 = -2.77777777770155933842e-3
const P3 = 6.61375632143793436117e-5
const P4 = -1.6533902205465251539e-6
const P5 = 4.13813679705723846039e-8

/** Exact 2^k for -1022 <= k <= 1023, built from the bit pattern. */
function pow2i(k: number): number {
  scratch.setUint32(0, ((k + 1023) << 20) >>> 0, false)
  scratch.setUint32(4, 0, false)
  return scratch.getFloat64(0, false)
}

export function exp(x: number): number {
  if (Number.isNaN(x)) return Number.NaN
  if (x > 709.782712893383973096) return Number.POSITIVE_INFINITY
  if (x < -745.13321910194110842) return 0
  const k = Math.round(x * INV_LN2)
  const hi = x - k * LN2_HI
  const lo = k * LN2_LO
  const r = hi - lo
  const t = r * r
  const c = r - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))))
  const y = 1 - (lo - (r * c) / (2 - c) - hi)
  if (k === 1024) return y * 2 * pow2i(1023)
  if (k >= -1021) return y * pow2i(k)
  return y * pow2i(k + 1000) * pow2i(-1000)
}

const LG1 = 6.666666666666735130e-1
const LG2 = 3.999999999940941908e-1
const LG3 = 2.857142874366239149e-1
const LG4 = 2.222219843214978396e-1
const LG5 = 1.818357216161805012e-1
const LG6 = 1.531383769920937332e-1
const LG7 = 1.479819860511658591e-1
const SQRT2 = 1.41421356237309514547e0

export function log(x0: number): number {
  if (Number.isNaN(x0) || x0 < 0) return Number.NaN
  if (x0 === 0) return Number.NEGATIVE_INFINITY
  if (x0 === Number.POSITIVE_INFINITY) return x0
  let x = x0
  let k = 0
  if (x < 2.2250738585072014e-308) { x *= 18014398509481984; k = -54 } // scale subnormals by 2^54
  scratch.setFloat64(0, x, false)
  const hx = scratch.getUint32(0, false)
  k += ((hx >>> 20) & 0x7ff) - 1023
  scratch.setUint32(0, ((hx & 0x000fffff) | 0x3ff00000) >>> 0, false)
  let m = scratch.getFloat64(0, false) // in [1, 2)
  if (m > SQRT2) { m *= 0.5; k += 1 }
  const f = m - 1
  const s = f / (2 + f)
  const z = s * s
  const w = z * z
  const t1 = w * (LG2 + w * (LG4 + w * LG6))
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)))
  const hfsq = 0.5 * f * f
  return k * LN2_HI - (hfsq - (s * (hfsq + t2 + t1) + k * LN2_LO) - f)
}

export function pow(x: number, y: number): number {
  if (y === 0) return 1
  if (Number.isNaN(x) || Number.isNaN(y)) return Number.NaN
  if (x > 0) return exp(y * log(x))
  if (x === 0) return y > 0 ? 0 : Number.POSITIVE_INFINITY
  if (!Number.isInteger(y)) return Number.NaN
  const v = exp(y * log(-x))
  return Math.abs(y) % 2 === 1 ? -v : v
}

/** No overflow scaling: inputs must satisfy x*x + y*y < 1.7e308. */
export function hypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}
```

- [ ] **Step 2: Write the parity test (1M samples per function family)**

`spikes/s5-math/expected.ts`:
```ts
export const DMATH_EXPECTED = 'replace-with-node-hash'
```

`spikes/s5-math/dmath.parity.test.ts`:
```ts
import { expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { mulberry32 } from '../shared/prng'
import { atan2, cos, exp, hypot, log, pow, sin, tan } from './dmath'
import { DMATH_EXPECTED } from './expected'

const N = 125_000 // × 8 functions = 1,000,000 samples

test('dmath outputs are bit-identical in every engine (1M samples)', async () => {
  const rand = mulberry32(2026)
  const out = new Float64Array(N * 8)
  for (let i = 0; i < N; i++) {
    const a = rand() * 2000 - 1000
    const b = rand() * 2000 - 1000
    const o = i * 8
    out[o] = sin(a)
    out[o + 1] = cos(a)
    out[o + 2] = tan(a)
    out[o + 3] = atan2(a, b)
    out[o + 4] = exp(a / 15) // [-66, 66]
    out[o + 5] = log(Math.abs(a) * 1e3 + 1e-300)
    out[o + 6] = pow(rand() * 100 + 1e-9, rand() * 20 - 10)
    out[o + 7] = hypot(a, b)
  }
  expect(out.filter(Number.isFinite).length).toBe(N * 8) // Review Focus #1: no NaN/Infinity padding
  expect(await sha256Hex(f64Bytes(out))).toBe(DMATH_EXPECTED)
})
```

- [ ] **Step 3: Get the Node hash, then run all engines**

Run: `pnpm --filter @spikes/all test:node -- s5-math/dmath.parity`
Expected: FAIL only on the hash. Paste the hex into `DMATH_EXPECTED`, then:

Run: `pnpm --filter @spikes/all test -- s5-math/dmath.parity`
Expected: PASS in all 4 engines.

- [ ] **Step 4: Write the accuracy test (Node, compared against `Math.*`)**

`spikes/s5-math/dmath.accuracy.node.test.ts`:
```ts
import { expect, test } from 'vitest'
import { mulberry32 } from '../shared/prng'
import { atan2, cos, exp, log, pow, sin, tan } from './dmath'

function maxErr(f: (r: () => number) => [number, number], n = 200_000, rel = false) {
  const rand = mulberry32(7)
  let worst = 0
  for (let i = 0; i < n; i++) {
    const [got, want] = f(rand)
    const e = rel ? Math.abs((got - want) / want) : Math.abs(got - want)
    if (e > worst) worst = e
  }
  return worst
}

test('accuracy bounds (record the numbers in the verdict)', () => {
  const r = {
    sin: maxErr((q) => { const x = q() * 2000 - 1000; return [sin(x), Math.sin(x)] }),
    cos: maxErr((q) => { const x = q() * 2000 - 1000; return [cos(x), Math.cos(x)] }),
    tan: maxErr((q) => {
      let x = q() * 2000 - 1000
      while (Math.abs(Math.cos(x)) < 1e-3) x += 0.01
      return [tan(x), Math.tan(x)]
    }, 200_000, true),
    atan2: maxErr((q) => { const y = q() * 2000 - 1000; const x = q() * 2000 - 1000; return [atan2(y, x), Math.atan2(y, x)] }),
    exp: maxErr((q) => { const x = q() * 1400 - 700; return [exp(x), Math.exp(x)] }, 200_000, true),
    log: maxErr((q) => { const x = 10 ** (q() * 600 - 300); return [log(x), Math.log(x)] }, 200_000, true),
    pow: maxErr((q) => { const x = q() * 100 + 1e-9; const y = q() * 20 - 10; return [pow(x, y), Math.pow(x, y)] }, 200_000, true),
  }
  console.log('[S5] max error', JSON.stringify(r))
  expect(r.sin).toBeLessThan(1e-14)
  expect(r.cos).toBeLessThan(1e-14)
  expect(r.tan).toBeLessThan(1e-12)
  expect(r.atan2).toBeLessThan(1e-14)
  expect(r.exp).toBeLessThan(1e-14)
  expect(r.log).toBeLessThan(1e-14)
  expect(r.pow).toBeLessThan(1e-12)
})

test('edge values', () => {
  expect(exp(0)).toBe(1)
  expect(log(1)).toBe(0)
  expect(exp(710)).toBe(Number.POSITIVE_INFINITY)
  expect(exp(-800)).toBe(0)
  expect(log(0)).toBe(Number.NEGATIVE_INFINITY)
  expect(Number.isNaN(log(-1))).toBe(true)
  expect(Math.abs(log(5e-324) - Math.log(5e-324))).toBeLessThan(1e-12)
  expect(Math.abs(atan2(1, -1) - Math.atan2(1, -1))).toBeLessThan(1e-15)
  expect(pow(-2, 3)).toBeCloseTo(-8, 12)
})
```

- [ ] **Step 5: Run the accuracy test**

Run: `pnpm --filter @spikes/all test:node -- s5-math/dmath.accuracy`
Expected: PASS, and a `[S5] max error {...}` line is printed. Record it. If a bound fails, fix the kernel; don't loosen the bound. Exception: tan near its poles is already excluded.

- [ ] **Step 6: Write and run the benchmark**

`spikes/s5-math/dmath.bench.node.test.ts`:
```ts
import { test } from 'vitest'
import * as d from './dmath'

test('cost vs Math.* (informational)', () => {
  const xs = Float64Array.from({ length: 1_000_000 }, (_, i) => (i % 2000) - 1000.5)
  const time = (f: (x: number) => number) => {
    let s = 0
    const t0 = performance.now()
    for (const x of xs) s += f(x)
    return [performance.now() - t0, s] as const
  }
  const rows = {
    sin: [time(d.sin)[0], time(Math.sin)[0]],
    atan: [time(d.atan)[0], time(Math.atan)[0]],
    exp: [time((x) => d.exp(x / 15))[0], time((x) => Math.exp(x / 15))[0]],
    log: [time((x) => d.log(Math.abs(x)))[0], time((x) => Math.log(Math.abs(x)))[0]],
  }
  console.log('[S5] ms per 1M (dmath, Math)', JSON.stringify(rows))
})
```
Run: `pnpm --filter @spikes/all test:node -- s5-math/dmath.bench`
Expected: a `[S5] ms per 1M` line. Record it.

- [ ] **Step 7: Write the verdict**

`docs/spikes/s5-math.md`:
```markdown
# S5 — Deterministic math

- **Question:** Can `sin/cos/tan/atan2/exp/log/pow/hypot`, built only from bit-exact operations, give identical bits in V8, JSC and SpiderMonkey with acceptable accuracy and cost?

## Results
- Parity, 1M samples: Node [ ], Chromium [ ], WebKit [ ], Firefox [ ]
- Max error: [paste the [S5] max error JSON]
- Cost, ms per 1M (dmath vs Math): [paste]

## Limits (documented contract)
- `sin/cos` are accurate for |x| < ~8.2e5. Beyond that they stay deterministic but get less accurate.
- `atan2` and `hypot` take finite inputs only. `atan2(0, 0) = 0`. `hypot` does no overflow scaling.
- `pow` is computed as `exp(y·log x)`, so its relative error grows with |y·log x|.

## Verdict
[PASS | FAIL], because [reason].

## Consequences for Plan 2
- `automata-sim/math` = this module, plus a test that compares it against a golden table of committed input/output bit patterns.
- check-boundaries `Math.*` allowlist: `sqrt, fround, round, floor, ceil, trunc, abs, min, max, sign, imul, clz32`.
```

- [ ] **Step 8: Commit**

```bash
git add spikes/s5-math docs/spikes/s5-math.md
git commit -m "spike(s5): deterministic math kernels, cross-engine parity, accuracy — verdict"
```

---

### Task 6: S3, Three.js WebGPU → WebGL2 with TSL post-processing

**Files:**
- Create: `spikes/s3-three/index.html`, `spikes/s3-three/main.ts`, `spikes/s3-three/compare.ts`, `docs/spikes/s3-three.md`

**Interfaces:**
- Consumes: `run-page.ts` (`--query backend=webgpu|webgl2 --screenshot`).
- Produces: `window.__result = { ok, requested, backend: 'webgpu'|'webgl2', fps }`. Also `compare.ts <a.png> <b.png>`, which prints `{ diffPixels, total, ratio }` and exits 1 when the ratio is 0.01 or more.

- [ ] **Step 1: Write the page**

`spikes/s3-three/index.html`:
```html
<!doctype html>
<html><head><meta charset="utf-8" /><style>body{margin:0;background:#000}</style></head>
<body><script type="module" src="./main.ts"></script></body></html>
```

`spikes/s3-three/main.ts`:
```ts
import { bayerDither } from 'three/addons/tsl/math/Bayer.js'
import { pass } from 'three/tsl'
import * as THREE from 'three/webgpu'

const requested = new URLSearchParams(location.search).get('backend') === 'webgl2' ? 'webgl2' : 'webgpu'
const renderer = new THREE.WebGPURenderer({ antialias: false, forceWebGL: requested === 'webgl2' })
renderer.setPixelRatio(1)
renderer.setSize(480, 270)
document.body.appendChild(renderer.domElement)
await renderer.init()
const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2'

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x202040)
scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 2))
const camera = new THREE.PerspectiveCamera(60, 480 / 270, 0.1, 100)
camera.position.set(0, 1.5, 4)
camera.lookAt(0, 0, 0)
const material = new THREE.MeshStandardMaterial({ color: 0xff8844, flatShading: true })
const meshes = Array.from({ length: 5 }, (_, i) => {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), material)
  m.position.set(i - 2, 0, 0)
  scene.add(m)
  return m
})
const pipeline = new THREE.RenderPipeline(renderer)
pipeline.outputNode = bayerDither(pass(scene, camera), 8)

const pose = (t: number) => meshes.forEach((m, i) => m.rotation.set(i * 0.3 + t, i * 0.5 + t * 0.7, 0))

// Animated FPS measurement over 300 frames.
const frames = 300
let count = 0
const t0 = performance.now()
await new Promise<void>((done) => {
  const tick = () => {
    pose(count / 60)
    pipeline.render()
    if (++count < frames) requestAnimationFrame(tick)
    else done()
  }
  requestAnimationFrame(tick)
})
const fps = frames / ((performance.now() - t0) / 1000)

// Static frame for the screenshot comparison.
pose(0)
pipeline.render()
await new Promise((r) => requestAnimationFrame(() => r(null)))
;(window as unknown as { __result: unknown }).__result = {
  ok: backend === requested, // Review Focus #2: a silent fallback fails the run
  requested,
  backend,
  fps: Math.round(fps),
}
```

- [ ] **Step 2: Write the pixel comparison script**

`spikes/s3-three/compare.ts`:
```ts
import { readFileSync } from 'node:fs'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

const [a, b] = process.argv.slice(2)
if (!a || !b) throw new Error('usage: node compare.ts a.png b.png')
const A = PNG.sync.read(readFileSync(a))
const B = PNG.sync.read(readFileSync(b))
if (A.width !== B.width || A.height !== B.height) throw new Error(`size mismatch ${A.width}x${A.height} vs ${B.width}x${B.height}`)
const diffPixels = pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: 0.1 })
const total = A.width * A.height
const ratio = diffPixels / total
console.log(JSON.stringify({ diffPixels, total, ratio }))
process.exit(ratio < 0.01 ? 0 : 1)
```

- [ ] **Step 3: Run both backends in Chromium and compare**

Run:
```bash
node spikes/shared/run-page.ts --page s3-three/index.html --query backend=webgpu --screenshot spikes/out/s3-webgpu.png --headed
node spikes/shared/run-page.ts --page s3-three/index.html --query backend=webgl2 --screenshot spikes/out/s3-webgl2.png
node spikes/s3-three/compare.ts spikes/out/s3-webgpu.png spikes/out/s3-webgl2.png
```
Expected:
- Both runs report `"ok": true`, and `backend` equals `requested`.
- The compare prints a `ratio` below 0.01 and exits 0.
- **Why `--headed` for WebGPU:** headless Chromium on macOS may not expose a WebGPU adapter. If the headed run also reports `backend: "webgl2"`, record "WebGPU unavailable on this machine" as a finding and re-check on the A3 Linux GPU runner.

- [ ] **Step 4: Measure FPS on an emulated phone**

Run: `node spikes/shared/run-page.ts --page s3-three/index.html --query backend=webgl2 --throttle 4`
Expected: `"ok": true` and an `fps` value. Record it as the "mid-range phone (4× CPU) proxy". The pass target is 30 FPS or higher.

- [ ] **Step 5: Write the verdict**

`docs/spikes/s3-three.md`:
```markdown
# S3 — Three.js r186 WebGPU → WebGL2 with TSL post

- **Question:** Can one `WebGPURenderer` + `RenderPipeline` + TSL dither run on both backends with matching output?

## Results
- WebGPU backend obtained (headed Chromium, macOS): [yes/no]
- Pixel diff WebGPU vs WebGL2: ratio [n] (pass < 0.01)
- FPS (WebGL2, 4× CPU throttle): [n]
- Bundle note: `three/webgpu` + `three/tsl` gzip size from the build output: [n] KB

## Verdict
[PASS | PARTIAL | FAIL], because [reason].

## Consequences for A2/A4
- The post-process stack is authored in TSL, with one implementation for both backends.
- Backend selection: `forceWebGL` when [condition, e.g. no adapter or blocklisted GPU].
```

- [ ] **Step 6: Commit**

```bash
git add spikes/s3-three docs/spikes/s3-three.md
git commit -m "spike(s3): Three WebGPU/WebGL2 + TSL dither parity and FPS — verdict"
```

---

### Task 7: S4, PixiJS 8 on WebGPU and WebGL

**Files:**
- Create: `spikes/s4-pixi/index.html`, `spikes/s4-pixi/main.ts`, `spikes/s4-pixi/dither.ts`, `docs/spikes/s4-pixi.md`

**Interfaces:**
- Consumes: `run-page.ts`; `spikes/s3-three/compare.ts`.
- Produces: `window.__result = { ok, requested, backend: 'webgpu'|'webgl', fps5k }`.

- [ ] **Step 1: Write the dither filter (GLSL and WGSL)**

`spikes/s4-pixi/dither.ts`:
```ts
import { Filter, GlProgram, GpuProgram } from 'pixi.js'

const glVertex = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }`

const glFragment = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uSteps;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  vec2 p = floor(gl_FragCoord.xy);
  float x = mod(p.x, 4.0);
  float y = mod(p.y, 4.0);
  float b = mod(floor(x + 1.0) * floor(y + 1.0) * 17.0, 16.0) / 16.0 - 0.5;
  finalColor = vec4(floor(c.rgb * uSteps + b) / uSteps, c.a);
}`

const wgsl = /* wgsl */ `
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>, uInputPixel: vec4<f32>, uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>, uGlobalFrame: vec4<f32>, uOutputTexture: vec4<f32>,
};
struct DitherUniforms { uSteps: f32 };
@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> ditherUniforms: DitherUniforms;
struct VSOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> };
fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32> {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
@vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
  return VSOutput(filterVertexPosition(aPosition), aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw));
}
@fragment fn mainFragment(@location(0) uv: vec2<f32>, @builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let c = textureSample(uTexture, uSampler, uv);
  let p = floor(pos.xy);
  let x = p.x % 4.0;
  let y = p.y % 4.0;
  let b = ((floor(x + 1.0) * floor(y + 1.0) * 17.0) % 16.0) / 16.0 - 0.5;
  let s = ditherUniforms.uSteps;
  return vec4(floor(c.rgb * s + b) / s, c.a);
}`

export function ditherFilter(steps = 8) {
  return new Filter({
    glProgram: GlProgram.from({ vertex: glVertex, fragment: glFragment, name: 'dither' }),
    gpuProgram: GpuProgram.from({
      vertex: { source: wgsl, entryPoint: 'mainVertex' },
      fragment: { source: wgsl, entryPoint: 'mainFragment' },
    }),
    resources: { ditherUniforms: { uSteps: { value: steps, type: 'f32' } } },
  })
}
```

- [ ] **Step 2: Write the page (static frame plus a 5k-sprite stress test)**

`spikes/s4-pixi/index.html`:
```html
<!doctype html>
<html><head><meta charset="utf-8" /><style>body{margin:0;background:#000}</style></head>
<body><script type="module" src="./main.ts"></script></body></html>
```

`spikes/s4-pixi/main.ts`:
```ts
import { Container, Graphics, Sprite, Texture, autoDetectRenderer } from 'pixi.js'
import { mulberry32 } from '../shared/prng'
import { ditherFilter } from './dither'

const requested = new URLSearchParams(location.search).get('backend') === 'webgl' ? 'webgl' : 'webgpu'
const renderer = await autoDetectRenderer({
  preference: requested,
  width: 480,
  height: 270,
  background: 0x202040,
  antialias: false,
  resolution: 1,
})
document.body.appendChild(renderer.canvas)
const backend = renderer.name === 'webgpu' ? 'webgpu' : 'webgl'

const rand = mulberry32(11)
const stress = new Container()
const sprites = Array.from({ length: 5000 }, () => {
  const s = new Sprite(Texture.WHITE)
  s.tint = Math.floor(rand() * 0xffffff)
  s.width = s.height = 4
  s.position.set(rand() * 480, rand() * 270)
  stress.addChild(s)
  return s
})
const frames = 300
let n = 0
const t0 = performance.now()
await new Promise<void>((done) => {
  const tick = () => {
    for (const s of sprites) s.x = (s.x + 1) % 480
    renderer.render(stress)
    if (++n < frames) requestAnimationFrame(tick)
    else done()
  }
  requestAnimationFrame(tick)
})
const fps5k = frames / ((performance.now() - t0) / 1000)

// Static frame for the screenshot comparison: gradient bars plus the dither filter.
const scene = new Container()
for (let i = 0; i < 16; i++) {
  scene.addChild(new Graphics().rect(i * 30, 0, 30, 270).fill({ color: (i * 16) << 16 | (255 - i * 16) << 8 | 128 }))
}
scene.filters = [ditherFilter(8)]
renderer.render(scene)
await new Promise((r) => requestAnimationFrame(() => r(null)))
;(window as unknown as { __result: unknown }).__result = {
  ok: backend === requested,
  requested,
  backend,
  fps5k: Math.round(fps5k),
}
```

- [ ] **Step 3: Run both backends and compare**

Run:
```bash
node spikes/shared/run-page.ts --page s4-pixi/index.html --query backend=webgpu --screenshot spikes/out/s4-webgpu.png --headed
node spikes/shared/run-page.ts --page s4-pixi/index.html --query backend=webgl --screenshot spikes/out/s4-webgl.png
node spikes/s3-three/compare.ts spikes/out/s4-webgpu.png spikes/out/s4-webgl.png
node spikes/shared/run-page.ts --page s4-pixi/index.html --query backend=webgl --throttle 4
```
Expected: `"ok": true` on every run, a compare ratio below 0.01, and the `fps5k` values recorded. If the WGSL fails to compile, read the browser console error that run-page prints and fix the shader. A Pixi version change to the filter uniform layout is the most likely cause. Record the fix in the verdict.

- [ ] **Step 4: Write the verdict**

`docs/spikes/s4-pixi.md`:
```markdown
# S4 — PixiJS 8.21 on WebGPU and WebGL

## Results
- WebGPU backend obtained: [yes/no]; dither filter compiles on both: [yes/no]
- Pixel diff ratio: [n]
- fps with 5k sprites: WebGPU [n], WebGL [n], WebGL at 4× throttle [n]

## Verdict
[PASS | PARTIAL | FAIL], because [reason].

## Consequences for A2/A4
- Every Pixi post effect ships as GLSL + WGSL pairs, using the uniform layout above. [any fixes needed]
```

- [ ] **Step 5: Commit**

```bash
git add spikes/s4-pixi docs/spikes/s4-pixi.md
git commit -m "spike(s4): Pixi 8 WebGPU/WebGL dither filter + 5k sprite stress — verdict"
```

---

### Task 8: S6, Ruken SDK stub that conforms to P01

**Files:**
- Create: `spikes/s6-ruken/protocol.ts`, `spikes/s6-ruken/allowlist.ts`, `spikes/s6-ruken/sdk-stub.ts`, `spikes/s6-ruken/mock-host.ts`, `spikes/s6-ruken/allowlist.node.test.ts`, `spikes/s6-ruken/handshake.node.test.ts`, `docs/spikes/s6-ruken-stub.md`

**Interfaces:**
- Produces:
  - `isAllowedHostOrigin(hostOrigin: string, gameOrigin: string): boolean`
  - `type Envelope` and `makeEnvelope(kind, type, payload?, re?)`
  - `initRuken(opts: InitOptions, env: RukenEnv): Promise<RukenStub>`
  - `createMockHost(opts: MockHostOptions): MockHost`

  A2's `@snekprty/automata-host` Ruken adapter is built against these shapes until the real `@ruken/sdk` exists.

- [ ] **Step 1: Write the allowlist tests first, using P01 §4's exact examples (Review Focus #5)**

`spikes/s6-ruken/allowlist.node.test.ts`:
```ts
import { expect, test } from 'vitest'
import { isAllowedHostOrigin } from './allowlist'

const PROD_GAME = 'https://g-abc123.rukengames.com'
const LOCAL_GAME = 'http://g-abc123.localhost:8787'

test.each([
  ['https://ruken.com', PROD_GAME, true],
  ['https://test.ruken.com', PROD_GAME, true],
  ['https://admin.private.ruken.com', PROD_GAME, true],
  ['https://pr-12.preview.ruken.com', PROD_GAME, true],
  ['https://ruken.com:443', PROD_GAME, true],
  ['https://evilruken.com', PROD_GAME, false],
  ['https://ruken.com.example.net', PROD_GAME, false],
  ['http://ruken.com', PROD_GAME, false],
  ['https://ruken.com:8443', PROD_GAME, false],
  ['tauri://localhost', PROD_GAME, true],
  ['http://tauri.localhost', PROD_GAME, true],
  ['https://tauri.localhost', PROD_GAME, true],
  ['http://localhost:5173', PROD_GAME, false], // a localhost host must never talk to a prod game
  ['http://localhost:5173', LOCAL_GAME, true],
  ['http://127.0.0.1:9000', 'http://localhost:4400', true],
  ['http://localhost:5173', 'http://abc.rkg.localhost', true],
  ['http://localhost:5173', 'https://g-x.rukengames-dev.com', false],
  ['https://localhost:5173', LOCAL_GAME, false], // local rule requires http:
  ['not a url', PROD_GAME, false],
])('host %s with game %s → %s', (host, game, allowed) => {
  expect(isAllowedHostOrigin(host, game)).toBe(allowed)
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @spikes/all test:node -- s6-ruken/allowlist`
Expected: FAIL with `Failed to resolve import "./allowlist"`.

- [ ] **Step 3: Implement the allowlist**

`spikes/s6-ruken/allowlist.ts`:
```ts
function parse(origin: string): URL | null {
  try {
    return new URL(origin)
  } catch {
    return null
  }
}

function isLocalGame(game: URL): boolean {
  const h = game.hostname
  return game.protocol === 'http:' && (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost'))
}

/** P01 §4 HOST_ALLOWLIST. Compares parsed URL parts, never string prefixes. */
export function isAllowedHostOrigin(hostOrigin: string, gameOrigin: string): boolean {
  const host = parse(hostOrigin)
  if (!host) return false
  const h = host.hostname
  // 1. Ruken web: https, default port, ruken.com or any subdomain depth.
  if (host.protocol === 'https:' && host.port === '' && (h === 'ruken.com' || h.endsWith('.ruken.com'))) return true
  // 2. Desktop.
  if (hostOrigin === 'tauri://localhost' || hostOrigin === 'http://tauri.localhost' || hostOrigin === 'https://tauri.localhost') return true
  // 3. Local development, only when the game itself is local.
  const game = parse(gameOrigin)
  if (host.protocol === 'http:' && (h === 'localhost' || h === '127.0.0.1') && game && isLocalGame(game)) return true
  return false
}
```

Note: `new URL('https://ruken.com:443').port` is `''`, because the default port is normalized away. `new URL('tauri://localhost')` parses, but the rule compares the full origin string exactly.

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm --filter @spikes/all test:node -- s6-ruken/allowlist`
Expected: PASS, 19 cases.

- [ ] **Step 5: Write the protocol types**

`spikes/s6-ruken/protocol.ts`:
```ts
export type ErrorCode =
  | 'UNSUPPORTED' | 'NOT_READY' | 'TIMEOUT' | 'RATE_LIMITED' | 'QUOTA_EXCEEDED'
  | 'INVALID_PAYLOAD' | 'DENIED' | 'OFFLINE' | 'CANCELLED' | 'INTERNAL'

export type Envelope = {
  ruken: 1
  id: string
  kind: 'req' | 'res' | 'evt'
  type: string
  re?: string
  payload?: unknown
  error?: { code: ErrorCode; message: string; retryable: boolean }
}

export type Capability =
  | 'lifecycle' | 'input' | 'display' | 'audio' | 'exit' | 'menu' | 'saves' | 'leaderboards'
  | 'entitlements' | 'dlc' | 'ads' | 'telemetry' | 'analytics.custom' | 'links'

export type HelloPayload = {
  sdkVersion: string
  proto: { min: string; max: string }
  gameId: string
  wants: Capability[]
  pauseBehavior: 'pause' | 'continue'
  menu: boolean
}

export type WelcomePayload = {
  proto: string
  granted: Capability[]
  player: { id: string; displayName: string }
  locale: string
  saves: { snapshot: Record<string, string>; status: string }
  consent: { analytics: boolean }
  host: { kind: 'web' | 'desktop'; version: string }
}

let counter = 0
export function makeEnvelope(kind: Envelope['kind'], type: string, payload?: unknown, re?: string): Envelope {
  counter += 1
  const env: Envelope = { ruken: 1, id: `m${counter}`, kind, type }
  if (payload !== undefined) env.payload = payload
  if (re !== undefined) env.re = re
  return env
}

export function isEnvelope(v: unknown): v is Envelope {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return e.ruken === 1 && typeof e.id === 'string' && typeof e.type === 'string' &&
    (e.kind === 'req' || e.kind === 'res' || e.kind === 'evt')
}
```

- [ ] **Step 6: Write the handshake and behaviour tests first**

`spikes/s6-ruken/handshake.node.test.ts`:
```ts
import { afterEach, expect, test, vi } from 'vitest'
import { createFakeFrame, createMockHost } from './mock-host'
import { initRuken } from './sdk-stub'

afterEach(() => vi.useRealTimers())

const OPTS = { gameId: 'blank-game', wants: ['saves', 'menu'] as const, pauseBehavior: 'pause' as const }

test('hosted: hello → welcome over MessagePort → ready only after session.ready', async () => {
  const frame = createFakeFrame({ gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' })
  const host = createMockHost({ frame, granted: ['lifecycle', 'saves', 'menu'], saves: { slot1: 'abc' } })
  const ruken = await initRuken({ ...OPTS, onMenuRequest: () => true }, frame.gameEnv)
  expect(ruken.hosted).toBe(true)
  expect(ruken.granted.has('saves')).toBe(true)
  expect(ruken.saves.storage.getItem('slot1')).toBe('abc')
  let ready = false
  void ruken.ready.then(() => { ready = true })
  await Promise.resolve()
  expect(ready).toBe(false) // R-04: nothing before session.ready
  host.sendReady()
  await ruken.ready
  expect(ready).toBe(true)
})

test('welcome from a non-allowlisted origin is ignored; falls back to standalone after 10 s', async () => {
  vi.useFakeTimers()
  const frame = createFakeFrame({ gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://evilruken.com' })
  createMockHost({ frame, granted: ['lifecycle'], saves: {} })
  const p = initRuken({ ...OPTS, onMenuRequest: () => true }, frame.gameEnv)
  await vi.advanceTimersByTimeAsync(10_000)
  const ruken = await p
  expect(ruken.hosted).toBe(false)
  expect(frame.helloCount()).toBeGreaterThanOrEqual(40) // every 250 ms for 10 s
})

test('standalone when parent === self: localStorage fallback under ruken:<gameId>:', async () => {
  const frame = createFakeFrame({ gameOrigin: 'http://localhost:5173', hostOrigin: null })
  const ruken = await initRuken({ ...OPTS, onMenuRequest: () => true }, frame.gameEnv)
  expect(ruken.hosted).toBe(false)
  ruken.saves.storage.setItem('slot1', 'xyz')
  expect(frame.localStorage.getItem('ruken:blank-game:slot1')).toBe('xyz')
  await ruken.ready // resolves immediately in standalone mode
})

test('lifecycle.changed and menu.open reach the game; menu.open is answered', async () => {
  const frame = createFakeFrame({ gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' })
  const host = createMockHost({ frame, granted: ['lifecycle', 'menu'], saves: {} })
  const onMenu = vi.fn(() => true)
  const ruken = await initRuken({ ...OPTS, onMenuRequest: onMenu }, frame.gameEnv)
  const states: string[] = []
  ruken.lifecycle.on('change', (e) => states.push(e.state))
  host.sendLifecycle('background', ['host-overlay'])
  const res = await host.requestMenuOpen()
  expect(states).toEqual(['background'])
  expect(ruken.lifecycle.state).toBe('background')
  expect(onMenu).toHaveBeenCalledOnce()
  expect(res).toEqual({ opened: true })
})

test('saves: setItem is synchronous, emits saves.set; key and size limits throw QuotaExceededError', async () => {
  const frame = createFakeFrame({ gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' })
  const host = createMockHost({ frame, granted: ['saves'], saves: {} })
  const ruken = await initRuken({ ...OPTS, onMenuRequest: () => true }, frame.gameEnv)
  ruken.saves.storage.setItem('slot.1', 'data')
  expect(ruken.saves.storage.getItem('slot.1')).toBe('data') // synchronous cache
  expect(() => ruken.saves.storage.setItem('bad key!', 'x')).toThrow(/QuotaExceededError/)
  expect(() => ruken.saves.storage.setItem('big', 'x'.repeat(1_048_577))).toThrow(/QuotaExceededError/)
  // flush is a request/response round trip over the same ordered port, so saves.set has arrived by the time it resolves
  expect(await ruken.saves.flush()).toEqual({ persisted: 'host-outbox' })
  expect(host.received('saves.set')).toEqual([expect.objectContaining({ key: 'slot.1', value: 'data' })])
})

test('saves.status events update ruken.saves.status and notify listeners', async () => {
  const frame = createFakeFrame({ gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' })
  const host = createMockHost({ frame, granted: ['saves'], saves: {} })
  const ruken = await initRuken({ ...OPTS, onMenuRequest: () => true }, frame.gameEnv)
  expect(ruken.saves.status).toBe('saved') // from welcome.saves.status
  const seen: string[] = []
  ruken.saves.on('status', (s) => seen.push(s))
  host.sendSavesStatus('offline-queued')
  await ruken.saves.flush() // round trip: the status event was delivered first
  expect(ruken.saves.status).toBe('offline-queued')
  expect(seen).toEqual(['offline-queued'])
})
```

- [ ] **Step 7: Run them to see them fail**

Run: `pnpm --filter @spikes/all test:node -- s6-ruken/handshake`
Expected: FAIL with `Failed to resolve import "./mock-host"`.

- [ ] **Step 8: Implement the fake frame and the mock host**

`spikes/s6-ruken/mock-host.ts`:
```ts
import { MessageChannel, type MessagePort } from 'node:worker_threads'
import { type Capability, type Envelope, isEnvelope, makeEnvelope } from './protocol'

type Listener = (ev: { data: unknown; origin: string; ports: MessagePort[] }) => void

export type RukenEnv = {
  isTopLevel: boolean
  gameOrigin: string
  postToParent(msg: unknown): void
  addMessageListener(fn: Listener): () => void
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
  localStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
}

export type FakeFrame = {
  gameEnv: RukenEnv
  localStorage: Map<string, string> & Pick<Storage, 'getItem'>
  helloCount(): number
  _onHello(fn: (hello: Envelope) => void): void
  _deliverToGame(ev: { data: unknown; origin: string; ports: MessagePort[] }): void
}

export function createFakeFrame(o: { gameOrigin: string; hostOrigin: string | null }): FakeFrame & { hostOrigin: string | null } {
  const listeners = new Set<Listener>()
  let hellos = 0
  let onHello: ((h: Envelope) => void) | undefined
  const store = new Map<string, string>() as FakeFrame['localStorage']
  store.getItem = (k: string) => store.get(k) ?? null
  const gameEnv: RukenEnv = {
    isTopLevel: o.hostOrigin === null,
    gameOrigin: o.gameOrigin,
    postToParent(msg) {
      if (isEnvelope(msg) && msg.type === 'hello') {
        hellos++
        onHello?.(msg)
      }
    },
    addMessageListener(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof globalThis.setTimeout>),
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    },
  }
  return {
    hostOrigin: o.hostOrigin,
    gameEnv,
    localStorage: store,
    helloCount: () => hellos,
    _onHello: (fn) => { onHello = fn },
    _deliverToGame: (ev) => { for (const l of listeners) l(ev) },
  }
}

export type MockHost = {
  sendReady(): void
  sendSavesStatus(state: string): void
  sendLifecycle(state: 'active' | 'background', reasons: string[]): void
  requestMenuOpen(): Promise<unknown>
  received(type: string): unknown[]
}

export function createMockHost(o: {
  frame: ReturnType<typeof createFakeFrame>
  granted: Capability[]
  saves: Record<string, string>
}): MockHost {
  let port: MessagePort | undefined
  const inbox: Envelope[] = []
  const pending = new Map<string, (payload: unknown) => void>()
  o.frame._onHello((hello) => {
    const hostOrigin = o.frame.hostOrigin
    if (port || hostOrigin === null) return
    const channel = new MessageChannel()
    channel.port1.unref() // don't keep the test process alive
    channel.port2.unref()
    port = channel.port1
    port.on('message', (msg: unknown) => {
      if (!isEnvelope(msg)) return
      inbox.push(msg)
      if (msg.kind === 'res' && msg.re) pending.get(msg.re)?.(msg.payload)
      if (msg.kind === 'req' && msg.type === 'saves.flush') {
        port!.postMessage(makeEnvelope('res', 'saves.flush', { persisted: 'host-outbox' }, msg.id))
      }
    })
    const want = (hello.payload as { wants: Capability[] }).wants
    const welcome = makeEnvelope('evt', 'welcome', {
      proto: '1.0',
      granted: [...new Set([...o.granted.filter((c) => want.includes(c) || ['lifecycle', 'input', 'display', 'audio', 'exit', 'telemetry'].includes(c))])],
      player: { id: 'p_opaque', displayName: 'Tester' },
      locale: 'en',
      saves: { snapshot: o.saves, status: 'saved' },
      consent: { analytics: false },
      host: { kind: 'web', version: 'mock' },
    })
    o.frame._deliverToGame({ data: welcome, origin: hostOrigin, ports: [channel.port2] })
  })
  return {
    sendReady: () => port?.postMessage(makeEnvelope('evt', 'session.ready', {})),
    sendSavesStatus: (state) => port?.postMessage(makeEnvelope('evt', 'saves.status', { state })),
    sendLifecycle: (state, reasons) => port?.postMessage(makeEnvelope('evt', 'lifecycle.changed', { state, reasons })),
    requestMenuOpen: () =>
      new Promise((resolve) => {
        const req = makeEnvelope('req', 'menu.open', {})
        pending.set(req.id, resolve)
        port?.postMessage(req)
      }),
    received: (type) => inbox.filter((m) => m.type === type).map((m) => m.payload),
  }
}
```

- [ ] **Step 9: Implement the SDK stub**

`spikes/s6-ruken/sdk-stub.ts`:
```ts
import type { MessagePort } from 'node:worker_threads'
import { isAllowedHostOrigin } from './allowlist'
import type { RukenEnv } from './mock-host'
import { type Capability, type WelcomePayload, isEnvelope, makeEnvelope } from './protocol'

export type InitOptions = {
  gameId: string
  wants: readonly Capability[]
  pauseBehavior: 'pause' | 'continue'
  onMenuRequest: () => boolean
}

type LifecycleEvent = { state: 'active' | 'background'; reasons: string[] }
const KEY_RE = /^[A-Za-z0-9._:-]{1,128}$/
const MAX_VALUE_BYTES = 1_048_576

function quota(msg: string): Error {
  const e = new Error(`QuotaExceededError: ${msg}`)
  e.name = 'QuotaExceededError'
  return e
}

export type RukenStub = Awaited<ReturnType<typeof initRuken>>

export async function initRuken(opts: InitOptions, env: RukenEnv) {
  const welcome = env.isTopLevel ? null : await handshake(opts, env)
  const port = welcome?.port
  const lifecycleListeners = new Set<(e: LifecycleEvent) => void>()
  const pending = new Map<string, (p: unknown) => void>()
  const cache = new Map<string, string>(Object.entries(welcome?.payload.saves.snapshot ?? {}))
  let lifecycleState: LifecycleEvent['state'] = 'active'
  let savesStatus = welcome?.payload.saves.status ?? 'saved'
  const statusListeners = new Set<(s: string) => void>()
  let resolveReady!: () => void
  const ready = new Promise<void>((r) => { resolveReady = r })
  if (!port) resolveReady()

  port?.on('message', (msg: unknown) => {
    if (!isEnvelope(msg)) return
    if (msg.kind === 'res' && msg.re) { pending.get(msg.re)?.(msg.payload); pending.delete(msg.re); return }
    if (msg.type === 'session.ready') resolveReady()
    else if (msg.type === 'saves.status') {
      savesStatus = (msg.payload as { state: string }).state
      for (const l of statusListeners) l(savesStatus)
    } else if (msg.type === 'lifecycle.changed') {
      const e = msg.payload as LifecycleEvent
      lifecycleState = e.state
      for (const l of lifecycleListeners) l(e)
    } else if (msg.type === 'menu.open' && msg.kind === 'req') {
      port.postMessage(makeEnvelope('res', 'menu.open', { opened: opts.onMenuRequest() !== false }, msg.id))
    } else if (msg.kind === 'req') {
      port.postMessage({ ...makeEnvelope('res', msg.type, undefined, msg.id), error: { code: 'UNSUPPORTED', message: msg.type, retryable: false } })
    }
  })

  const prefix = `ruken:${opts.gameId}:`
  const storage = {
    getItem: (k: string) => (port ? (cache.get(k) ?? null) : env.localStorage.getItem(prefix + k)),
    setItem: (k: string, v: string) => {
      if (!KEY_RE.test(k)) throw quota(`invalid key "${k}"`)
      if (new TextEncoder().encode(v).length > MAX_VALUE_BYTES) throw quota(`value for "${k}" exceeds 1 MB`)
      if (!port) return env.localStorage.setItem(prefix + k, v)
      cache.set(k, v)
      port.postMessage(makeEnvelope('evt', 'saves.set', { key: k, value: v, baseRevision: null, writeId: `w${Date.now()}` }))
    },
    removeItem: (k: string) => {
      if (!port) return env.localStorage.removeItem(prefix + k)
      cache.delete(k)
      port.postMessage(makeEnvelope('evt', 'saves.remove', { key: k, baseRevision: null, writeId: `w${Date.now()}` }))
    },
  }

  function request(type: string, payload: unknown): Promise<unknown> {
    if (!port) return Promise.resolve(undefined)
    const req = makeEnvelope('req', type, payload)
    return new Promise((resolve) => {
      pending.set(req.id, resolve)
      port.postMessage(req)
    })
  }

  return {
    hosted: Boolean(port),
    ready,
    granted: new Set<Capability>(welcome?.payload.granted ?? []),
    player: welcome?.payload.player ?? { id: 'local', displayName: 'Player' },
    lifecycle: {
      get state() { return lifecycleState },
      on: (_: 'change', fn: (e: LifecycleEvent) => void) => { lifecycleListeners.add(fn); return () => lifecycleListeners.delete(fn) },
    },
    saves: {
      storage,
      get status() { return savesStatus },
      on: (_: 'status', fn: (s: string) => void) => { statusListeners.add(fn); return () => statusListeners.delete(fn) },
      flush: async () => (port ? request('saves.flush', {}) : { persisted: 'host-outbox' }),
    },
  }
}

function handshake(opts: InitOptions, env: RukenEnv): Promise<{ payload: WelcomePayload; port: MessagePort } | null> {
  return new Promise((resolve) => {
    const hello = makeEnvelope('evt', 'hello', {
      sdkVersion: '0.0.0-spike', proto: { min: '1.0', max: '1.x' }, gameId: opts.gameId,
      wants: [...opts.wants], pauseBehavior: opts.pauseBehavior, menu: true,
    })
    let done = false
    let retry: unknown
    const finish = (v: { payload: WelcomePayload; port: MessagePort } | null) => {
      if (done) return
      done = true
      env.clearTimeout(retry)
      env.clearTimeout(giveUp)
      off()
      resolve(v)
    }
    const off = env.addMessageListener((ev) => {
      if (!isEnvelope(ev.data) || ev.data.type !== 'welcome') return
      if (!isAllowedHostOrigin(ev.origin, env.gameOrigin)) return // dropped silently; keep retrying
      const port = ev.ports[0]
      if (port) finish({ payload: ev.data.payload as WelcomePayload, port })
    })
    const send = () => {
      if (done) return
      env.postToParent(hello)
      retry = env.setTimeout(send, 250)
    }
    const giveUp = env.setTimeout(() => finish(null), 10_000)
    send()
  })
}
```

Notes:
- `Date.now()` in `writeId` is fine here, because the SDK lives outside the sim. Law 5 applies to `automata-sim` only.
- The stub uses Node's `MessagePort` API (`port.on('message')`) because S6 runs under Node. The A2 adapter will use the DOM `MessagePort` (`addEventListener('message')`, then `start()`).

- [ ] **Step 10: Run the S6 tests to see them pass**

Run: `pnpm --filter @spikes/all test:node -- s6-ruken`
Expected: all allowlist and handshake tests PASS.

- [ ] **Step 11: Write the verdict, including the P01 gap list for Ruken**

`docs/spikes/s6-ruken-stub.md`:
```markdown
# S6 — Ruken SDK stub (P01 v1.0)

## Covered
hello retry (250 ms, 10 s give-up) · welcome origin allowlist (P01 §4 cases) · MessagePort transport · session.ready gating · lifecycle.changed · menu.open req/res · saves.set / flush / status / limits · standalone localStorage fallback · UNSUPPORTED for unknown requests.

## Not covered (stub only; the real SDK replaces it)
display/audio/input events, leaderboards, dlc, ads, analytics, links, exit/exiting, host.summon, telemetry.

## P01 gaps and questions to send to Ruken before F1 (2026-10-16)
1. `welcome.saves.snapshot` can hold up to 10 MB in a single postMessage. Is that intended, or should the snapshot be chunked or lazy?
2. Can `menu.open` arrive before `session.ready`? If so, what should the game answer?
3. Can `pauseBehavior` change at runtime (single-player menu vs. online match)? `hello` is the only place it is declared.
4. What do `display.metrics.scale: 1 | 1.333` mean for the game's UI scale: CSS zoom, or a hint?
5. `saves.set.writeId`: what format and uniqueness scope? Is `baseRevision: null` valid for keys that exist in the snapshot?
6. [add anything else found while implementing]

## Verdict
Stub is [usable] as the A2 Ruken-adapter target behind `Hosting`. Contract tests to carry into `automata-host`: [list the test names above].
```

- [ ] **Step 12: Commit**

```bash
git add spikes/s6-ruken docs/spikes/s6-ruken-stub.md
git commit -m "spike(s6): Ruken P01 SDK stub, origin allowlist, mock host — verdict + P01 gap list"
```

---

### Task 9: Close A0 (verdict index, ADR, delete spikes)

**Files:**
- Create: `docs/spikes/README.md`, `docs/adr/0001-ecs-choice.md`
- Modify: `docs/superpowers/specs/2026-10-01-a0-a1-spikes-foundation-design.md` (status line plus a new §11 "Spike outcomes")
- Modify: `pnpm-workspace.yaml` (remove `- spikes`)
- Delete: `spikes/`

**Interfaces:**
- Consumes: all six verdict documents.
- Produces: the inputs Plan 2 (A1 core) is written from: the ECS choice, the ordering rule, the relation encoding, the math allowlist, and the stub contract.

- [ ] **Step 1: Run the whole spike suite one last time and record the summary**

Run: `pnpm --filter @spikes/all test`
Expected: every test PASS in node, chromium, webkit and firefox. Put the final pass/fail summary line in `docs/spikes/README.md`.

- [ ] **Step 2: Write the verdict index**

`docs/spikes/README.md`:
```markdown
# A0 Spike Verdicts

| Spike | Verdict | Blocks A1? | Key consequence |
|---|---|---|---|
| [S1 Koota](./s1-koota.md) | [ ] | yes | [ECS choice + ordering rule] |
| [S2 Rapier](./s2-rapier.md) | [ ] | yes | [package + snapshot section] |
| [S3 Three](./s3-three.md) | [ ] | no (A2/A4) | [ ] |
| [S4 Pixi](./s4-pixi.md) | [ ] | no (A2/A4) | [ ] |
| [S5 Math](./s5-math.md) | [ ] | yes | [Math.* allowlist] |
| [S6 Ruken stub](./s6-ruken-stub.md) | [ ] | no (A2) | [P01 gaps sent to Ruken] |

Final suite run (YYYY-MM-DD): [paste summary line].
```

- [ ] **Step 3: Write ADR 0001**

`docs/adr/0001-ecs-choice.md`:
```markdown
# ADR 0001 — ECS for automata-sim

- Status: Accepted
- Date: [date]

## Context
The overview spec §8 picks Koota pending S1. The sim must be cross-engine deterministic and snapshot/restorable.

## Decision
[Koota 0.6.6 | Miniplex 2.0.0] behind the `automata-sim` facade. Game code never imports the ECS directly.

## Consequences
- Ordering: [rule from S1]
- IDs: own `StableId` counter (Koota recycles IDs).
- Relations: [encoding from S1]
- Perf: [msPerTick at 2k, 4× throttle]
```

- [ ] **Step 4: Update the A0+A1 spec with the outcomes**

In `docs/superpowers/specs/2026-10-01-a0-a1-spikes-foundation-design.md`:
- Change the status line to `- **Status:** A0 complete <date>; A1 pending Plan 2`.
- Append:
```markdown
## 11. Spike outcomes (A0 closed)

See `docs/spikes/README.md`. Changes to A1 from the verdicts:
- [each consequence that changes §4/§5/§6 of this spec, e.g. "§4.4 rule 1: facade sorts by StableId in all queries"]
```

- [ ] **Step 5: Delete the spikes in a single commit**

Run:
```bash
git rm -r -q spikes
sed -i '' '/^  - spikes$/d' pnpm-workspace.yaml
pnpm install
pnpm lint
```
Expected: `pnpm install` succeeds with no `@spikes/all` entry, and lint exits 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs(a0): close spikes — verdict index, ADR 0001, spec outcomes; remove spikes/"
```

---

## Handoff to Plan 2

When Task 9 is committed, write `docs/superpowers/plans/<date>-a1-foundation-core.md` from:
- spec §3.3–§8
- `docs/spikes/README.md`
- ADR 0001

Plan 2 covers: `automata-sim` (facade, scheduling, RNG, commands, events, resources, physics plugins, snapshot v1, render delta), `automata-content`, the `automata-testing` sim half, `check-boundaries`, `check-style`, `examples/blank-game`, and hosted CI with prerelease publishing.
