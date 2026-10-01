# A0: Bootstrap and Spikes Implementation Plan (rev 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the monorepo just far enough to run the six A0 spikes (S1–S6). Each spike runs across Node, Chromium, WebKit and Firefox, ends with a written verdict, and its code is deleted once A0 closes.

**Architecture:**
- **Root tooling** (pnpm, turbo, TS 7, Biome, lefthook) is real and permanent.
- **`spikes/`** is one throwaway workspace package with one folder per spike.
- **Cross-engine harness.** Every `*.parity.test.ts` runs in Node *and* in three Playwright browsers, and asserts against one committed hash. The harness proves two things:
  - each run really is the engine it claims to be;
  - it can detect a difference: plain `Math.*` hashes differ in every engine.
- **Page runner.** `spikes/shared/run-page.ts` (Vite build + preview + Playwright) handles the checks that need a real page: GPU rendering, Ruken's CSP, CPU/device throttling, and the two-origin Ruken host check.
- **Pixel comparisons.** `spikes/shared/compare.ts` reports a diff ratio. It rejects blank or uniform captures, and supports a "must differ" mode for positive controls.

**Tech Stack:** Node 24 · pnpm 10.33.4 · TypeScript 7.0.2 · Biome 2.5.15 · turbo 2.11.6 · lefthook 2.1.16 · Vitest 5.0.3 (+ `@vitest/browser-playwright` 5.0.3) · Playwright 1.63.0 · Vite 8.3.2 · koota 0.6.6 · miniplex 2.0.0 · `@dimforge/rapier{2d,3d}-deterministic-compat` 0.21.0 · three 0.186.1 · pixi.js 8.21.0 · pixelmatch 7.2.0 · pngjs 7.0.0 · jsdom.

**Specs:**
- `docs/superpowers/specs/2026-10-01-a0-a1-spikes-foundation-design.md` (§2 A0; §3.1–3.2 bootstrap).
- Parent spec: `docs/superpowers/specs/2026-10-01-automata-framework-overview-design.md`.
- Ruken protocol, used by S6: `/Users/mcthaydt/Desktop/Business/Ruken/RukenApp/docs/superpowers/specs/2026-10-01-ruken-p01-protocol-sdk-design.md` (§4–§10). It is **not frozen until F1 (2026-10-16)** and was mid-edit on 2026-10-01: `dlc` was renamed to the `store` capability.

**Pre-run status:** Every code block in this plan was run on 2026-10-01 in a scratch copy of this exact layout, on an M1 Mac. Results:
- `pnpm lint` and `pnpm typecheck` exit 0;
- 37 test files and 123 tests pass in all four engines;
- every page check passes;
- the lefthook pre-commit hook passes a clean commit and blocks an unformatted file.

The **Expected** lines quote those pre-run numbers, so deviations stand out. On different hardware, the timing and FPS numbers will differ; the hashes must not.

**Scope note:** A1's core is **Plan 2**, written after Task 9 from the verdicts. The core is `automata-sim`, `automata-content`, `automata-testing`, the checks, and `examples/blank-game`.

## Global Constraints

- **Toolchain:**
  - Node `>=24` (`.nvmrc` = `24`).
  - `turbo.json` sets `"agentGuidance": false`. Without it, turbo 2.11 appends a managed block to `AGENTS.md` whenever it detects an AI agent, and re-adds it if removed; this was verified in the pre-run.
  - `"packageManager": "pnpm@10.33.4"`.
  - pnpm may only run install scripts for packages listed in `onlyBuiltDependencies` (currently lefthook).
- **TypeScript:** strict, ESM only, `moduleResolution: "Bundler"`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `isolatedDeclarations` in the base config. Spikes turn `isolatedDeclarations` off.
- **Biome:** single quotes, no semicolons, 2-space indent, line width 110. The linter uses `"preset": "recommended"`. Biome respects `.gitignore` (`vcs.useIgnoreFile`) and also lints `.html`.
- **Formatting:** run `pnpm format` before **every** commit. The lefthook pre-commit hook runs `biome check` on staged files and rejects anything unformatted.
- **Commits:** Conventional Commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Test commands:**
  - One spike: `pnpm --filter @spikes/all exec vitest run [--project node|browsers] <path-filter>`. Don't use `pnpm test -- <filter>`; the literal `--` stops Vitest from filtering.
  - Everything: `pnpm --filter @spikes/all exec vitest run`.
- **Spike code** is exempt from TDD and from the style rules, but not from lint or typecheck. Every spec §2 pass criterion is **asserted** by a test or a runner exit code. Informational logs (`[S1] …`) record findings; they are never the pass criterion.
- **Expected hashes:** every parity test compares against **one** committed expected constant. Never per engine.
  1. Run once in Node.
  2. Paste the printed hash into `expected.ts`.
  3. Run all engines.
- **CSP under test:** exactly `script-src 'self' 'wasm-unsafe-eval'`, which is Ruken's.
- **A0 close:** `spikes/` is removed (`git rm` + `rm -rf`) in a single commit. `docs/spikes/*.md` stay.

## Review Focus

These are the failure modes most likely to make a spike report a false PASS. Each is guarded by a test in the task that owns it.

1. **A trivially matching hash.** Guards: minimum entity and sample counts; the smoke test checks the engine; the native-`Math` control proves engines *can* differ (Tasks 2–5).
2. **Order-independent work.** Guard: S1's tick folds stable IDs in iteration order and picks victims by index, so any order change changes the hash (Task 3).
3. **Silent backend fallback, or blank captures.** Guards:
   - the page reports its real backend and GPU;
   - `compare.ts` rejects captures with fewer than 8 colours;
   - a dithered vs undithered positive control must differ by 5% or more (Tasks 6–7).
4. **A CSP check that can't fail.** Guards: a negative-control page with an inline script must exit 1; the Rapier page reports `ok` only after bodies actually fell (Tasks 2, 4).
5. **A Ruken stub that trusts the wrong window.** Guards:
   - the P01 §4/§10 allowlist table;
   - a forged welcome (right origin, wrong `source`) is ignored;
   - a second welcome is ignored;
   - a real two-origin iframe check (Task 8).

---

## File Structure

```
(root)  package.json · pnpm-workspace.yaml · turbo.json · tsconfig.base.json · biome.json · lefthook.yml
        .nvmrc · .gitignore · AGENTS.md · CLAUDE.md
docs/spikes/README.md, s1-koota.md … s6-ruken-stub.md   (kept)
docs/adr/0001-ecs-choice.md                              (kept)
spikes/                                                  (deleted at the end of A0)
├─ package.json · tsconfig.json · vitest.config.ts
├─ shared/  hash.ts · prng.ts · engine.ts · smoke.parity.test.ts · run-page.ts · smoke.html · smoke.ts
│           csp-negative.html · compare.ts · gpu-info.ts
├─ s1-koota/  world.ts · snapshot.ts · expected.ts · churn.parity.test.ts · snapshot.parity.test.ts
│             changes.parity.test.ts · miniplex.parity.test.ts · bench.html · bench.ts
├─ s2-rapier/ scene.ts · expected.ts · rapier.parity.test.ts · csp.html · csp.ts
├─ s3-three/  index.html · main.ts
├─ s4-pixi/   dither.ts · index.html · main.ts
├─ s5-math/   dmath.ts · expected.ts · dmath.parity.test.ts · dmath.rules.node.test.ts
│             dmath.accuracy.node.test.ts · dmath.bench.node.test.ts
└─ s6-ruken/  protocol.ts · allowlist.ts · allowlist.node.test.ts · saves-storage.ts · sdk-stub.ts
              mock-host.ts · storage-suite.ts · storage-dom.node.test.ts · handshake.node.test.ts
              requests.node.test.ts · saves.node.test.ts · catalog.node.test.ts
              dom-env.ts · host.html · host.ts · game.html · game.ts
```

---

### Task 1: Root bootstrap

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `biome.json`, `lefthook.yml`, `.nvmrc`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`

**Interfaces:**
- Produces: the root scripts `pnpm lint`, `pnpm format`, `pnpm test`, `pnpm typecheck`; `tsconfig.base.json`, which every package extends; and a turbo `test:unit` task that the pre-commit hook runs for packages affected by the change. No package defines `test:unit` until A1, so the hook step is a no-op until then.

- [ ] **Step 1: Write the root config files**

`package.json`:
```json
{
  "name": "automata-framework",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.33.4",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "lint": "biome check .",
    "format": "biome check --write .",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.15",
    "lefthook": "2.1.16",
    "turbo": "2.11.6",
    "typescript": "7.0.2"
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
onlyBuiltDependencies:
  - lefthook
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "agentGuidance": false,
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "test:unit": {
      "dependsOn": ["^build"]
    }
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
    "isolatedDeclarations": true,
    "declaration": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

`biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.15/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "includes": ["**", "!**/dist", "!**/out", "!**/__goldens__"] },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 110 },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" } },
  "linter": { "enabled": true, "rules": { "preset": "recommended" } }
}
```

`lefthook.yml`:
```yaml
pre-commit:
  piped: true
  commands:
    1_biome:
      glob: "*.{ts,js,json,jsonc}"
      run: pnpm exec biome check --no-errors-on-unmatched {staged_files}
    2_affected-unit-tests:
      run: pnpm exec turbo run test:unit --filter="...[HEAD]"
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
# AutomataFramework: Agent Rules

Read `docs/superpowers/specs/2026-10-01-automata-framework-overview-design.md` first, then the spec for the phase you are working on.

- **Strict TDD** in `packages/`, `tooling/` and `examples/`: write a failing test first, then make the minimal change. `spikes/` is exempt (A0+A1 spec §2).
- **The seven laws** (overview spec §2): only the sim changes gameplay state; the sim has no I/O, no wall clock and no `Math.random`; the host is a port.
- **Naming:** role suffixes (`*.component.ts`, `*.system.ts`, `*.command.ts`, `*.event.ts`, `*.resource.ts`, `*.plugin.ts`, `*.manager.ts`, `*.schema.ts`, `*.migration.ts`, `*.test.ts`). Folders group by feature.
- **Determinism is cross-engine:** goldens must match bit-for-bit in Node, Chromium, WebKit and Firefox. Never accept a hash mismatch as "flaky".
- Run `pnpm format` before committing. Use Conventional Commits.
- Packages publish as `@snekprty/automata-<name>` (GitHub Packages, `SNEKPRTY/automata-framework`).
- Heavy GPU, visual and E2E suites run on the Linux GPU runner (from A3), not on the developer's Mac.
```

- [ ] **Step 2: Install the root dev tools and the git hook**

Run: `pnpm add -Dw @biomejs/biome@2.5.15 turbo@2.11.6 typescript@7.0.2 lefthook@2.1.16`
Expected: the install succeeds and its output includes `lefthook postinstall: sync hooks: ✔️(pre-commit)`. If the output instead says `Ignored build scripts: lefthook`, check that `onlyBuiltDependencies` in `pnpm-workspace.yaml` is correct, then run `pnpm install`.

- [ ] **Step 3: Verify lint passes**

Run: `pnpm format && pnpm lint`
Expected: exits 0 with `Checked N files … No fixes applied.`

- [ ] **Step 4: Commit (the pre-commit hook runs now)**

```bash
git add -A
git commit -m "chore: bootstrap monorepo tooling (pnpm, turbo, TS 7, Biome, lefthook)"
```
Expected: lefthook prints `1_biome` and `2_affected-unit-tests` as passing, and the commit succeeds.

---

### Task 2: Spikes package and the cross-engine harness

**Files:**
- Create: `spikes/package.json`, `spikes/tsconfig.json`, `spikes/vitest.config.ts`
- Create: `spikes/shared/hash.ts`, `prng.ts`, `engine.ts`, `smoke.parity.test.ts`, `run-page.ts`, `smoke.html`, `smoke.ts`, `csp-negative.html`, `compare.ts`, `gpu-info.ts`

**Interfaces:**
- Produces:
  - `sha256Hex(bytes: Uint8Array): Promise<string>`
  - `f64Bytes(values: ArrayLike<number>): Uint8Array` (little-endian)
  - `mulberry32(seed): () => number`
  - `nextRand(state: { s: number }): number` (the same generator with serializable state)
  - `detectEngine(): string`
  - `expectedEngine(): string` (from the Vitest `provide`/`inject` value `engine`)
  - `gpuInfo(): Promise<{ webgpu: string | null; webgl: string | null }>`
- Produces the CLIs:
  - `node spikes/shared/run-page.ts --page <path.html> [--also <path.html>]… [--browser chromium|webkit|firefox] [--query k=v&…] [--csp] [--throttle N] [--device "<Playwright device>"] [--origin-host 127.0.0.1] [--headed] [--screenshot file.png] [--timeout ms]`. It prints JSON and exits 1 on a timeout, any CSP violation, or `__result.ok === false`.
  - `node spikes/shared/compare.ts a.png b.png (--max-ratio R | --min-ratio R) [--min-colors 8]`. It prints `{ ok, ratio, diffPixels, colorsA, colorsB }` and exits 0 or 1.

- [ ] **Step 1: Write the package files**

`spikes/package.json`:
```json
{
  "name": "@spikes/all",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p ."
  }
}
```

`spikes/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "types": ["node"], "isolatedDeclarations": false, "declaration": false },
  "include": ["**/*.ts"],
  "exclude": ["out", "node_modules"]
}
```

`spikes/vitest.config.ts`:
```ts
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 120_000,
    silent: false, // spike tests print measurements with console.log; Vitest hides passing-test logs by default
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.parity.test.ts', '**/*.node.test.ts'],
          provide: { engine: 'node' },
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
            instances: [
              { browser: 'chromium', provide: { engine: 'chromium' } },
              { browser: 'webkit', provide: { engine: 'webkit' } },
              { browser: 'firefox', provide: { engine: 'firefox' } },
            ],
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
pnpm --filter @spikes/all add -D vitest@5.0.3 @vitest/browser-playwright@5.0.3 playwright@1.63.0 vite@8.3.2 jsdom \
  koota@0.6.6 miniplex@2.0.0 @dimforge/rapier3d-deterministic-compat@0.21.0 @dimforge/rapier2d-deterministic-compat@0.21.0 \
  three@0.186.1 @types/three pixi.js@8.21.0 pixelmatch@7.2.0 pngjs@7.0.0 @types/pngjs @types/node
pnpm --filter @spikes/all exec playwright install chromium webkit firefox
```
Expected: both commands succeed.

- [ ] **Step 3: Write the shared helpers**

`spikes/shared/hash.ts`:
```ts
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Little-endian Float64 bytes, written explicitly so platform endianness can never matter. */
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
  const state = { s: seed >>> 0 }
  return () => nextRand(state)
}

/** Same generator with explicit, serializable state (for snapshots). */
export function nextRand(state: { s: number }): number {
  state.s = (state.s + 0x6d2b79f5) >>> 0
  let t = state.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
```

`spikes/shared/engine.ts`:
```ts
import { inject } from 'vitest'

declare module 'vitest' {
  export interface ProvidedContext {
    engine: 'node' | 'chromium' | 'webkit' | 'firefox'
  }
}

/** Detects the JS engine actually running this code (independent of what the config claims). */
export function detectEngine(): string {
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) return 'node'
  const ua = navigator.userAgent
  if (ua.includes('Firefox/')) return 'firefox'
  if (ua.includes('Chrome/')) return 'chromium'
  if (ua.includes('AppleWebKit/')) return 'webkit'
  return `unknown:${ua}`
}

export function expectedEngine(): string {
  return inject('engine')
}
```

- [ ] **Step 4: Write the harness self-test (Review Focus #1)**

`spikes/shared/smoke.parity.test.ts`:
```ts
import { expect, test } from 'vitest'
import { detectEngine, expectedEngine } from './engine'
import { f64Bytes, sha256Hex } from './hash'
import { mulberry32 } from './prng'

test('each run is really the engine the project says it is', () => {
  expect(detectEngine()).toBe(expectedEngine())
})

test('mulberry32 + sha256 are identical in every engine', async () => {
  const rand = mulberry32(42)
  const values = Array.from({ length: 10_000 }, () => rand())
  expect(new Set(values).size).toBeGreaterThan(9_990) // not degenerate
  expect(await sha256Hex(f64Bytes(values))).toBe(SMOKE_EXPECTED)
})

test('negative control: native Math.* hashes (informational; shows why S5 exists)', async () => {
  const rand = mulberry32(7)
  const out = new Float64Array(300_000)
  for (let i = 0; i < 100_000; i++) {
    const x = rand() * 2000 - 1000
    out[i * 3] = Math.sin(x)
    out[i * 3 + 1] = Math.exp(x / 15)
    out[i * 3 + 2] = (rand() * 100) ** (rand() * 20 - 10)
  }
  console.log(`[harness] engine=${detectEngine()} native-math-sha=${await sha256Hex(f64Bytes(out))}`)
})

const SMOKE_EXPECTED = 'replace-with-node-hash'
```

- [ ] **Step 5: Run it in Node to get the expected hash**

Run: `pnpm --filter @spikes/all exec vitest run --project node shared`
Expected: one FAIL, with `Received: "<64-hex>"`. Pre-run value: `6dda73d868a3f5f0449b52e4291ed564485e94eb0cd5ee7fc2ef5f482b5ee303`. Paste it into `SMOKE_EXPECTED`.

- [ ] **Step 6: Run all four engines**

Run: `pnpm --filter @spikes/all exec vitest run shared`
Expected: `Tests 12 passed (12)`, and four `[harness] engine=<name> native-math-sha=<hex>` lines, one per engine. On the pre-run, **all four native hashes were different**. Keep these lines for the S5 verdict. If two engines print the same native hash, that's fine: it's information, not a failure.

- [ ] **Step 7: Write the page runner, the CSP pages, the image compare, and the GPU probe**

`spikes/shared/run-page.ts`:
```ts
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium, devices, firefox, webkit } from 'playwright'
import { build, preview } from 'vite'

const spikesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:"

const { values } = parseArgs({
  options: {
    page: { type: 'string' }, // entry page, relative to spikes/
    also: { type: 'string', multiple: true, default: [] }, // extra pages to build (e.g. an iframe)
    browser: { type: 'string', default: 'chromium' },
    query: { type: 'string', default: '' },
    csp: { type: 'boolean', default: false },
    throttle: { type: 'string', default: '1' }, // Chromium CPU throttle factor
    device: { type: 'string' }, // Playwright device descriptor name, e.g. "Pixel 7"
    'origin-host': { type: 'string' }, // open the page via this hostname (e.g. 127.0.0.1) instead of localhost
    headed: { type: 'boolean', default: false },
    screenshot: { type: 'string' },
    timeout: { type: 'string', default: '60000' },
  },
})
if (!values.page) throw new Error('--page is required (path relative to spikes/, e.g. s2-rapier/csp.html)')

const outDir = join(spikesRoot, 'out', values.page.replace(/[/.]/g, '_'))
const input = [values.page, ...values.also].map((p) => join(spikesRoot, p))
await build({
  root: spikesRoot,
  base: './',
  logLevel: 'warn',
  build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 4096, rollupOptions: { input } },
})
const server = await preview({
  root: spikesRoot,
  base: './',
  build: { outDir },
  preview: {
    port: 0,
    host: values['origin-host'] ? true : 'localhost', // two-origin checks need both localhost and 127.0.0.1
    headers: values.csp ? { 'Content-Security-Policy': CSP } : {},
  },
  logLevel: 'warn',
})
const local = server.resolvedUrls?.local[0]
if (!local) throw new Error('preview server did not report a URL')
const origin = values['origin-host'] ? local.replace('localhost', values['origin-host']) : local

const browserType = { chromium, webkit, firefox }[values.browser as 'chromium' | 'webkit' | 'firefox']
const browser = await browserType.launch({
  headless: !values.headed,
  args: values.browser === 'chromium' ? ['--enable-unsafe-webgpu'] : [],
})
const context = await browser.newContext(
  values.device ? { ...devices[values.device] } : { viewport: { width: 480, height: 270 } },
)
const page = await context.newPage()
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
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(values.throttle) })
}

await page.goto(`${origin}${values.page}${values.query ? `?${values.query}` : ''}`)
let result: { ok?: boolean } & Record<string, unknown>
try {
  await page.waitForFunction(
    () => (window as unknown as { __result?: unknown }).__result !== undefined,
    null,
    {
      timeout: Number(values.timeout),
    },
  )
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

const summary = {
  browser: values.browser,
  device: values.device ?? null,
  csp: values.csp,
  violations,
  ...result,
}
console.log(JSON.stringify(summary, null, 2))
if (violations.length > 0 || result.ok === false) process.exit(1)
```

`spikes/shared/smoke.html`:
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8" /></head><body><canvas width="8" height="8"></canvas>
<script type="module" src="./smoke.ts"></script></body></html>
```

`spikes/shared/smoke.ts`:
```ts
;(window as unknown as { __result: unknown }).__result = { ok: true, userAgent: navigator.userAgent }
```

`spikes/shared/csp-negative.html` (an inline script that Ruken's CSP must block):
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8" /></head><body><canvas width="8" height="8"></canvas>
<script>window.__inlineRan = true</script>
<script type="module" src="./smoke.ts"></script></body></html>
```

`spikes/shared/compare.ts`:
```ts
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

// Usage:
//   node shared/compare.ts a.png b.png --max-ratio 0.01    (must match: at most 1% of pixels differ)
//   node shared/compare.ts a.png b.png --min-ratio 0.05    (must differ: positive control)
// Both images must also have >= --min-colors distinct colors, so blank/black captures can never "match".
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'max-ratio': { type: 'string' },
    'min-ratio': { type: 'string' },
    'min-colors': { type: 'string', default: '8' },
  },
})
const [a, b] = positionals
if (!a || !b) throw new Error('usage: node shared/compare.ts a.png b.png (--max-ratio R | --min-ratio R)')
const A = PNG.sync.read(readFileSync(a))
const B = PNG.sync.read(readFileSync(b))
if (A.width !== B.width || A.height !== B.height) {
  throw new Error(`size mismatch ${A.width}x${A.height} vs ${B.width}x${B.height}`)
}
const distinct = (img: PNG) => {
  const set = new Set<number>()
  for (let i = 0; i < img.data.length; i += 4) set.add(img.data.readUInt32BE(i))
  return set.size
}
const colorsA = distinct(A)
const colorsB = distinct(B)
const diffPixels = pixelmatch(A.data, B.data, undefined, A.width, A.height, { threshold: 0.1 })
const ratio = diffPixels / (A.width * A.height)
const minColors = Number(values['min-colors'])
let ok = colorsA >= minColors && colorsB >= minColors
if (values['max-ratio'] !== undefined) ok &&= ratio <= Number(values['max-ratio'])
if (values['min-ratio'] !== undefined) ok &&= ratio >= Number(values['min-ratio'])
console.log(JSON.stringify({ ok, ratio, diffPixels, colorsA, colorsB }))
process.exit(ok ? 0 : 1)
```

`spikes/shared/gpu-info.ts`:
```ts
/** Which GPU/driver actually rendered: lets the verdict tell a real GPU from a software fallback. */
export async function gpuInfo(): Promise<{ webgpu: string | null; webgl: string | null }> {
  let webgpu: string | null = null
  const gpu = (
    navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ info?: Record<string, string> } | null> } }
  ).gpu
  if (gpu) {
    const adapter = await gpu.requestAdapter()
    webgpu = adapter?.info
      ? `${adapter.info.vendor ?? ''} ${adapter.info.architecture ?? ''} ${adapter.info.description ?? ''}`.trim()
      : null
  }
  const gl = document.createElement('canvas').getContext('webgl2')
  const ext = gl?.getExtension('WEBGL_debug_renderer_info')
  const webgl =
    gl && ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : gl
        ? String(gl.getParameter(gl.RENDERER))
        : null
  return { webgpu, webgl }
}
```

- [ ] **Step 8: Prove the CSP check can pass *and* fail (Review Focus #4)**

Run:
```bash
node spikes/shared/run-page.ts --page shared/smoke.html --csp; echo "exit=$?"
node spikes/shared/run-page.ts --page shared/csp-negative.html --csp; echo "exit=$?"
```
Expected:
- The first prints `"ok": true` and `"violations": []`, then `exit=0`.
- The second prints a `script-src-elem inline` violation, then `exit=1`.

- [ ] **Step 9: Typecheck, format and commit**

Run: `pnpm --filter @spikes/all typecheck && pnpm format && pnpm lint`
Expected: all three exit 0.
```bash
git add spikes pnpm-lock.yaml package.json pnpm-workspace.yaml
git commit -m "chore(spikes): cross-engine parity harness, page runner, CSP and image-compare controls"
```

---

### Task 3: S1, Koota determinism, snapshot, change tracking and performance

**Files:**
- Create: `spikes/s1-koota/world.ts`, `snapshot.ts`, `expected.ts`, `churn.parity.test.ts`, `snapshot.parity.test.ts`, `changes.parity.test.ts`, `miniplex.parity.test.ts`, `bench.html`, `bench.ts`, `docs/spikes/s1-koota.md`

**Interfaces:**
- Consumes: `sha256Hex`, `f64Bytes`, `nextRand`, `run-page.ts`.
- Produces:
  - `createSim(seed)`, `populate(sim, n)`, `tick(sim, order: 'native' | 'sorted')`, `live(sim, order)`
  - `takeSnapshot(sim)`, `encode(snap): Uint8Array`, `decode(bytes)`, `restore(snap, into)`
  - the verdict document, which answers:
    - (a) Is native order deterministic across engines?
    - (b) Is it ascending by stable ID?
    - (c) Does it survive a restore?
    - (d) Are IDs recycled?
    - (e) Can relations with data be snapshotted to bytes?
    - (f) Does Added/Changed/Removed tracking agree across engines and after a restore?
    - (g) What does a tick cost, native vs sorted?
    - (h) Does the Miniplex fallback behave the same?

- [ ] **Step 1: Write the world (an order-dependent tick, exact entity counts)**

`spikes/s1-koota/world.ts`:
```ts
import { createWorld, type Entity, relation, trait, type World } from 'koota'
import { nextRand } from '../shared/prng'

export const StableId = trait({ value: 0 })
export const Position = trait({ x: 0, y: 0 })
export const Velocity = trait({ x: 0, y: 0 })
export const Health = trait({ hp: 0 })
export const Contains = relation({ store: { amount: 0 } })

/** Everything a deterministic run depends on, besides the Koota world itself. */
export type Sim = {
  world: World
  nextId: number
  acc: number // order-sensitive fold: changes if iteration order changes
  rng: { s: number }
  destroyedKootaIds: Set<number>
}
export type Order = 'native' | 'sorted'

/** Koota caps the number of live worlds, so tests destroy every world they create. */
const created: World[] = []
export function createSim(seed: number): Sim {
  const world = createWorld()
  created.push(world)
  return { world, nextId: 1, acc: 0, rng: { s: seed >>> 0 }, destroyedKootaIds: new Set() }
}
export function destroyWorlds(): void {
  for (const w of created.splice(0)) w.destroy()
}

const r = (sim: Sim) => nextRand(sim.rng)
export const sidOf = (e: Entity): number => (e.get(StableId) as { value: number }).value

export function spawnBody(sim: Sim): Entity {
  const e = sim.world.spawn(
    StableId({ value: sim.nextId++ }),
    Position({ x: Math.fround(r(sim) * 100), y: Math.fround(r(sim) * 100) }),
    Velocity({ x: Math.fround(r(sim) - 0.5), y: Math.fround(r(sim) - 0.5) }),
  )
  if (r(sim) < 0.35) e.add(Health({ hp: Math.floor(r(sim) * 100) }))
  return e
}

/** Spawns exactly n bodies; every 10th gets a Contains relation (with data) to an earlier body. */
export function populate(sim: Sim, n: number): void {
  const spawned: Entity[] = []
  for (let i = 0; i < n; i++) {
    const e = spawnBody(sim)
    if (i % 10 === 9) {
      const target = spawned[Math.floor(r(sim) * spawned.length)]
      if (target) e.add(Contains(target, { amount: Math.floor(r(sim) * 10) }))
    }
    spawned.push(e)
  }
}

export function live(sim: Sim, order: Order): Entity[] {
  const list = [...sim.world.query(StableId)]
  return order === 'sorted' ? list.sort((a, b) => sidOf(a) - sidOf(b)) : list
}

/**
 * One fixed step whose outcome DEPENDS on iteration order:
 * - fold every live StableId into `acc` in iteration order,
 * - pick entities to destroy / mutate / relate by index into the ordered list,
 * - spawn during the step (exercises ID recycling).
 */
export function tick(sim: Sim, order: Order, dt = 1 / 60): void {
  sim.world.query(Position, Velocity).updateEach(([p, v]) => {
    p.x = Math.fround(p.x + v.x * dt)
    p.y = Math.fround(p.y + v.y * dt)
  })
  const list = live(sim, order)
  for (const e of list) sim.acc = (Math.imul(sim.acc, 31) + sidOf(e)) >>> 0
  const pick = () => list[Math.floor(r(sim) * list.length)]
  const victim = pick()
  if (victim) {
    sim.destroyedKootaIds.add(victim.id())
    victim.destroy()
  }
  spawnBody(sim)
  spawnBody(sim)
  const toggled = pick()
  if (toggled?.isAlive()) {
    if (toggled.has(Health)) toggled.remove(Health)
    else toggled.add(Health({ hp: Math.floor(r(sim) * 100) }))
  }
  const a = pick()
  const b = pick()
  if (a?.isAlive() && b?.isAlive() && a !== b) a.add(Contains(b, { amount: Math.floor(r(sim) * 10) }))
}

/** How many live entities reuse a Koota id that was destroyed earlier in this run. */
export function recycledLive(sim: Sim): number {
  return [...sim.world.query(StableId)].filter((e) => sim.destroyedKootaIds.has(e.id())).length
}
```

- [ ] **Step 2: Write the byte-level snapshot**

`spikes/s1-koota/snapshot.ts`:
```ts
import type { Entity } from 'koota'
import { Contains, Health, Position, type Sim, StableId, sidOf, Velocity } from './world'

export type Row = {
  sid: number
  pos: [number, number] | null
  vel: [number, number] | null
  hp: number | null
  contains: Array<[number, number]> // [target sid, amount], sorted by target sid
}
export type Snapshot = { nextId: number; acc: number; rng: number; rows: Row[] }

/** Canonical snapshot: rows sorted by StableId, relation targets sorted by target StableId. */
export function takeSnapshot(sim: Sim): Snapshot {
  const rows: Row[] = []
  for (const e of sim.world.query(StableId)) {
    const p = e.has(Position) ? e.get(Position) : undefined
    const v = e.has(Velocity) ? e.get(Velocity) : undefined
    const h = e.has(Health) ? e.get(Health) : undefined
    const contains: Array<[number, number]> = e
      .targetsFor(Contains)
      .map((t: Entity) => [sidOf(t), (e.get(Contains(t)) as { amount: number }).amount] as [number, number])
      .sort((x, y) => x[0] - y[0])
    rows.push({
      sid: sidOf(e),
      pos: p ? [p.x, p.y] : null,
      vel: v ? [v.x, v.y] : null,
      hp: h ? h.hp : null,
      contains,
    })
  }
  rows.sort((a, b) => a.sid - b.sid)
  return { nextId: sim.nextId, acc: sim.acc, rng: sim.rng.s, rows }
}

const HAS_POS = 1
const HAS_VEL = 2
const HAS_HP = 4

/** Little-endian binary encoding. Positions/velocities are f32 (they are Math.fround'ed on every write). */
export function encode(s: Snapshot): Uint8Array {
  let size = 16
  for (const row of s.rows)
    size +=
      4 + 1 + (row.pos ? 8 : 0) + (row.vel ? 8 : 0) + (row.hp !== null ? 4 : 0) + 4 + row.contains.length * 8
  const v = new DataView(new ArrayBuffer(size))
  let o = 0
  const u32 = (n: number) => {
    v.setUint32(o, n, true)
    o += 4
  }
  const i32 = (n: number) => {
    v.setInt32(o, n, true)
    o += 4
  }
  const f32 = (n: number) => {
    v.setFloat32(o, n, true)
    o += 4
  }
  u32(s.nextId)
  u32(s.acc)
  u32(s.rng)
  u32(s.rows.length)
  for (const row of s.rows) {
    u32(row.sid)
    v.setUint8(o++, (row.pos ? HAS_POS : 0) | (row.vel ? HAS_VEL : 0) | (row.hp !== null ? HAS_HP : 0))
    if (row.pos) {
      f32(row.pos[0])
      f32(row.pos[1])
    }
    if (row.vel) {
      f32(row.vel[0])
      f32(row.vel[1])
    }
    if (row.hp !== null) i32(row.hp)
    u32(row.contains.length)
    for (const [sid, amount] of row.contains) {
      u32(sid)
      i32(amount)
    }
  }
  if (o !== size) throw new Error(`encode size mismatch ${o} != ${size}`)
  return new Uint8Array(v.buffer)
}

export function decode(bytes: Uint8Array): Snapshot {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let o = 0
  const u32 = () => {
    const n = v.getUint32(o, true)
    o += 4
    return n
  }
  const i32 = () => {
    const n = v.getInt32(o, true)
    o += 4
    return n
  }
  const f32 = () => {
    const n = v.getFloat32(o, true)
    o += 4
    return n
  }
  const nextId = u32(),
    acc = u32(),
    rng = u32(),
    count = u32()
  const rows: Row[] = []
  for (let i = 0; i < count; i++) {
    const sid = u32()
    const flags = v.getUint8(o++)
    const pos: [number, number] | null = flags & HAS_POS ? [f32(), f32()] : null
    const vel: [number, number] | null = flags & HAS_VEL ? [f32(), f32()] : null
    const hp = flags & HAS_HP ? i32() : null
    const n = u32()
    const contains: Array<[number, number]> = []
    for (let j = 0; j < n; j++) contains.push([u32(), i32()])
    rows.push({ sid, pos, vel, hp, contains })
  }
  if (o !== bytes.byteLength) throw new Error(`trailing bytes: read ${o} of ${bytes.byteLength}`)
  return { nextId, acc, rng, rows }
}

/** Rebuild into a fresh world: spawn in StableId order first, then add relations. */
export function restore(s: Snapshot, into: Sim): void {
  into.nextId = s.nextId
  into.acc = s.acc
  into.rng.s = s.rng
  const bySid = new Map<number, Entity>()
  for (const row of s.rows) {
    const e = into.world.spawn(StableId({ value: row.sid }))
    if (row.pos) e.add(Position({ x: row.pos[0], y: row.pos[1] }))
    if (row.vel) e.add(Velocity({ x: row.vel[0], y: row.vel[1] }))
    if (row.hp !== null) e.add(Health({ hp: row.hp }))
    bySid.set(row.sid, e)
  }
  for (const row of s.rows) {
    const src = bySid.get(row.sid) as Entity
    for (const [targetSid, amount] of row.contains)
      src.add(Contains(bySid.get(targetSid) as Entity, { amount }))
  }
}
```

`spikes/s1-koota/expected.ts`:
```ts
export const CHURN_NATIVE_EXPECTED = 'replace-with-node-hash'
export const SNAPSHOT_SORTED_EXPECTED = 'replace-with-node-hash'
export const CHANGES_EXPECTED = 'replace-with-node-hash'
export const MINIPLEX_EXPECTED = 'replace-with-node-hash'
```

- [ ] **Step 3: Write the four parity tests**

`spikes/s1-koota/churn.parity.test.ts`:
```ts
import { afterEach, expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { CHURN_NATIVE_EXPECTED } from './expected'
import {
  createSim,
  destroyWorlds,
  Health,
  live,
  Position,
  populate,
  recycledLive,
  sidOf,
  tick,
} from './world'

afterEach(destroyWorlds)

test('native iteration order (with in-tick churn) is identical in every engine at 10k live entities', async () => {
  const sim = createSim(1234)
  populate(sim, 10_000)
  for (let t = 0; t < 60; t++) tick(sim, 'native')
  const list = live(sim, 'native')
  expect(list.length).toBeGreaterThanOrEqual(10_000) // Review Focus #1: not vacuous
  expect(recycledLive(sim)).toBeGreaterThan(0) // ids really were recycled during the run
  const rows: number[] = [sim.acc]
  for (const e of list)
    rows.push(
      sidOf(e),
      e.id(),
      e.get(Position)?.x ?? Number.NaN,
      e.has(Health) ? (e.get(Health)?.hp ?? -1) : -1,
    )
  expect(await sha256Hex(f64Bytes(rows))).toBe(CHURN_NATIVE_EXPECTED)
})

test('records whether native order is ascending by StableId (informational, for the verdict)', () => {
  const sim = createSim(1234)
  populate(sim, 10_000)
  for (let t = 0; t < 60; t++) tick(sim, 'native')
  const sids = live(sim, 'native').map(sidOf)
  const ascending = sids.every((s, i) => i === 0 || s > (sids[i - 1] as number))
  console.log(
    `[S1] native-ascending-by-stableId=${ascending} live=${sids.length} recycled-live=${recycledLive(sim)}`,
  )
})
```

`spikes/s1-koota/snapshot.parity.test.ts`:
```ts
import { afterEach, expect, test } from 'vitest'
import { sha256Hex } from '../shared/hash'
import { SNAPSHOT_SORTED_EXPECTED } from './expected'
import { decode, encode, restore, takeSnapshot } from './snapshot'
import { createSim, destroyWorlds, type Order, populate, type Sim, tick } from './world'

afterEach(destroyWorlds)

const stateHash = (sim: Sim) => sha256Hex(encode(takeSnapshot(sim)))

/** Runs 300 ticks straight vs. 150 ticks -> encode -> decode -> restore into a fresh world -> 150 more ticks. */
async function compare(order: Order) {
  const straight = createSim(99)
  populate(straight, 3_000)
  for (let t = 0; t < 300; t++) tick(straight, order)

  const first = createSim(99)
  populate(first, 3_000)
  for (let t = 0; t < 150; t++) tick(first, order)
  const snap = takeSnapshot(first)
  const bytes = encode(snap)
  const resumed = createSim(0)
  restore(decode(bytes), resumed)
  for (let t = 150; t < 300; t++) tick(resumed, order)

  return { straight: await stateHash(straight), resumed: await stateHash(resumed), snap, bytes }
}

test('sorted-by-StableId iteration: byte snapshot -> restore -> continue == uninterrupted, in every engine', async () => {
  const { straight, resumed, snap, bytes } = await compare('sorted')
  expect(snap.rows.length).toBeGreaterThan(3_000) // Review Focus #1
  expect(snap.rows.some((row) => row.contains.length > 0)).toBe(true) // Review Focus #4: relations are in the snapshot
  expect(encode(decode(bytes))).toEqual(bytes) // byte round trip is lossless
  expect(resumed).toBe(straight)
  expect(straight).toBe(SNAPSHOT_SORTED_EXPECTED)
})

test('native iteration across restore (finding for the facade ordering rule)', async () => {
  const { straight, resumed } = await compare('native')
  console.log(`[S1] native-order-survives-restore=${straight === resumed}`)
})
```

`spikes/s1-koota/changes.parity.test.ts`:
```ts
import { createAdded, createChanged, createRemoved } from 'koota'
import { afterEach, expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { CHANGES_EXPECTED } from './expected'
import { decode, encode, restore, takeSnapshot } from './snapshot'
import { createSim, destroyWorlds, Position, populate, type Sim, StableId, sidOf, tick } from './world'

afterEach(destroyWorlds)

const Added = createAdded()
const Removed = createRemoved()
const Changed = createChanged()

/** Per tick: sorted StableIds reported by Added/Changed/Removed(Position). This is what a render delta would use. */
function trackTicks(sim: Sim, from: number, to: number): number[][] {
  const out: number[][] = []
  // Removed entities are gone, so their StableId can't be read; record the count instead.
  const ids = (q: Iterable<Parameters<typeof sidOf>[0]>) =>
    [...q]
      .filter((e) => e.has(StableId))
      .map(sidOf)
      .sort((a, b) => a - b)
  for (let t = from; t < to; t++) {
    tick(sim, 'sorted')
    const added = ids(sim.world.query(Added(Position)))
    const changed = ids(sim.world.query(Changed(Position)))
    const removed = sim.world.query(Removed(Position)).length
    out.push([t, added.length, ...added, -1, changed.length, removed])
  }
  return out
}

test('Added/Changed/Removed tracking is identical in every engine', async () => {
  const sim = createSim(5)
  populate(sim, 1_000)
  const ticks = trackTicks(sim, 0, 120)
  expect(ticks.some((row) => (row[1] as number) > 0)).toBe(true)
  expect(await sha256Hex(f64Bytes(ticks.flat()))).toBe(CHANGES_EXPECTED)
})

test('tracking after restore vs uninterrupted (finding: does a restore look like "everything added"?)', async () => {
  const a = createSim(5)
  populate(a, 1_000)
  trackTicks(a, 0, 60)
  const straight = trackTicks(a, 60, 120)

  const b = createSim(5)
  populate(b, 1_000)
  trackTicks(b, 0, 60)
  const c = createSim(0)
  restore(decode(encode(takeSnapshot(b))), c)
  const resumed = trackTicks(c, 60, 120)

  const firstTickEqual = JSON.stringify(straight[0]) === JSON.stringify(resumed[0])
  const laterTicksEqual = JSON.stringify(straight.slice(1)) === JSON.stringify(resumed.slice(1))
  console.log(
    `[S1] tracking-after-restore first-tick-equal=${firstTickEqual} later-ticks-equal=${laterTicksEqual}`,
  )
})
```

`spikes/s1-koota/miniplex.parity.test.ts` (the fallback, measured with the same tick):
```ts
// The S1 fallback, measured with the same order-dependent tick, so ADR 0001 compares two tested options.
import { World } from 'miniplex'
import { expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { nextRand } from '../shared/prng'
import { MINIPLEX_EXPECTED } from './expected'

type E = {
  sid: number
  pos: { x: number; y: number }
  vel: { x: number; y: number }
  hp?: number
  contains?: Array<[number, number]> // Miniplex has no relations: [target sid, amount]
}
type MSim = { world: World<E>; nextId: number; acc: number; rng: { s: number } }
type Order = 'native' | 'sorted'

const create = (seed: number): MSim => ({ world: new World<E>(), nextId: 1, acc: 0, rng: { s: seed >>> 0 } })
const r = (sim: MSim) => nextRand(sim.rng)

function spawn(sim: MSim): E {
  const e: E = {
    sid: sim.nextId++,
    pos: { x: Math.fround(r(sim) * 100), y: Math.fround(r(sim) * 100) },
    vel: { x: Math.fround(r(sim) - 0.5), y: Math.fround(r(sim) - 0.5) },
  }
  if (r(sim) < 0.35) e.hp = Math.floor(r(sim) * 100)
  return sim.world.add(e)
}

const live = (sim: MSim, order: Order): E[] => {
  const list = [...sim.world.with('sid')]
  return order === 'sorted' ? list.sort((a, b) => a.sid - b.sid) : list
}

function tick(sim: MSim, order: Order, dt = 1 / 60): void {
  for (const e of sim.world.with('pos', 'vel')) {
    e.pos.x = Math.fround(e.pos.x + e.vel.x * dt)
    e.pos.y = Math.fround(e.pos.y + e.vel.y * dt)
  }
  const list = live(sim, order)
  for (const e of list) sim.acc = (Math.imul(sim.acc, 31) + e.sid) >>> 0
  const pick = () => list[Math.floor(r(sim) * list.length)]
  const victim = pick()
  if (victim) sim.world.remove(victim)
  spawn(sim)
  spawn(sim)
  const toggled = pick()
  if (toggled && sim.world.has(toggled)) {
    if (toggled.hp !== undefined) sim.world.removeComponent(toggled, 'hp')
    else sim.world.addComponent(toggled, 'hp', Math.floor(r(sim) * 100))
  }
  const a = pick()
  const b = pick()
  if (a && b && a !== b && sim.world.has(a) && sim.world.has(b)) {
    a.contains = [...(a.contains ?? []), [b.sid, Math.floor(r(sim) * 10)]]
  }
}

const stateRows = (sim: MSim): number[] => {
  const rows: number[] = [sim.nextId, sim.acc, sim.rng.s]
  for (const e of live(sim, 'sorted'))
    rows.push(e.sid, e.pos.x, e.pos.y, e.vel.x, e.vel.y, e.hp ?? -1, ...(e.contains ?? []).flat())
  return rows
}

function snapshotRestore(sim: MSim): MSim {
  const json = JSON.stringify({
    nextId: sim.nextId,
    acc: sim.acc,
    rng: sim.rng.s,
    entities: live(sim, 'sorted'),
  })
  const data = JSON.parse(json) as { nextId: number; acc: number; rng: number; entities: E[] }
  const out = create(data.rng)
  out.nextId = data.nextId
  out.acc = data.acc
  for (const e of data.entities) out.world.add(e)
  return out
}

async function run(order: Order, restoreAt?: number): Promise<string> {
  let sim = create(99)
  for (let i = 0; i < 3_000; i++) spawn(sim)
  for (let t = 0; t < 300; t++) {
    if (t === restoreAt) sim = snapshotRestore(sim)
    tick(sim, order)
  }
  expect(sim.world.with('sid').size).toBeGreaterThan(3_000)
  return sha256Hex(f64Bytes(stateRows(sim)))
}

test('Miniplex: sorted iteration survives snapshot/restore and is identical in every engine', async () => {
  const straight = await run('sorted')
  expect(await run('sorted', 150)).toBe(straight)
  expect(straight).toBe(MINIPLEX_EXPECTED)
})

test('Miniplex: native iteration across restore (informational)', async () => {
  console.log(
    `[S1] miniplex native-order-survives-restore=${(await run('native')) === (await run('native', 150))}`,
  )
})
```

- [ ] **Step 4: Get the Node hashes**

Run: `pnpm --filter @spikes/all exec vitest run --project node s1-koota`
Expected: exactly 4 FAILs, one per `*_EXPECTED` constant; every other assertion passes. Paste each `Received` hex into `expected.ts`. Pre-run values:
- `CHURN_NATIVE_EXPECTED` `317b7e9e…`
- `SNAPSHOT_SORTED_EXPECTED` `4ea4aba3…`
- `CHANGES_EXPECTED` `22c26438…`
- `MINIPLEX_EXPECTED` `819681cc…`

Use your own values in full. Don't copy these prefixes.

- [ ] **Step 5: Run all four engines**

Run: `pnpm --filter @spikes/all exec vitest run s1-koota`
Expected: `Tests 32 passed (32)`. Each `[S1]` line prints 4 times with identical content. Pre-run:
- `native-ascending-by-stableId=false live=10060 recycled-live=60`
- `native-order-survives-restore=false`
- `tracking-after-restore first-tick-equal=false later-ticks-equal=true`
- `miniplex native-order-survives-restore=false`

**A failing browser is a finding, not a bug to suppress.** Record which engine failed and how.

- [ ] **Step 6: Write and run the throttled benchmark**

`spikes/s1-koota/bench.html`:
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8" /></head><body><canvas width="8" height="8"></canvas>
<script type="module" src="./bench.ts"></script></body></html>
```

`spikes/s1-koota/bench.ts`:
```ts
import { createSim, type Order, populate, tick } from './world'

function bench(order: Order): { live: number; msPerTick: number } {
  const sim = createSim(5)
  populate(sim, 2_000) // exactly 2k live at start; each tick adds net +1, so ~2.6k by the end
  const TICKS = 600
  const t0 = performance.now()
  for (let t = 0; t < TICKS; t++) tick(sim, order)
  const msPerTick = (performance.now() - t0) / TICKS
  const live = sim.world.query().length
  sim.world.destroy()
  return { live, msPerTick: Math.round(msPerTick * 1000) / 1000 }
}

;(window as unknown as { __result: unknown }).__result = {
  ok: true,
  native: bench('native'),
  sorted: bench('sorted'),
}
```

Run:
```bash
node spikes/shared/run-page.ts --page s1-koota/bench.html
node spikes/shared/run-page.ts --page s1-koota/bench.html --throttle 4
```
Expected: JSON with `native` and `sorted`, each `{ live: 2600, msPerTick }`. Pre-run at 4× throttle: native ≈ 0.62 ms, sorted ≈ 2.39 ms. The budget for comparison: the whole sim gets about 8 ms of a 33 ms frame.

- [ ] **Step 7: Write the verdict**

`docs/spikes/s1-koota.md` (fill in every bracketed field from your outputs):
```markdown
# S1: Koota determinism, snapshot, change tracking

- **Question:** Is Koota 0.6.6 deterministic across engines with structural churn, and can a world be snapshotted to bytes and restored so the continuation is identical?
- **Method:** `spikes/s1-koota/*`. The tick is order-dependent: it folds stable IDs in iteration order, picks victims and relations by index, and spawns during the step. Snapshots go through encode → decode → restore. Miniplex runs the same tick as a comparison.

## Results
| Check | Node | Chromium | WebKit | Firefox |
|---|---|---|---|---|
| Native order + churn hash (10k live) | | | | |
| Sorted: bytes → restore → continue == straight | | | | |
| Added/Changed/Removed tracking hash | | | | |
| Miniplex sorted restore + hash | | | | |

- (b) Native order ascending by stable ID: [ ]
- (c) Native order survives restore: [ ]. Consequence: [e.g. "the facade iterates in StableId order wherever order matters"]
- (d) IDs recycled: [ ] (recycled-live = [n]). Consequence: the facade owns `StableId`; Koota IDs never leave the sim.
- (e) Relations with data snapshot to bytes via `targetsFor` + `get(Contains(t))`: [ ]
- (f) Tracking after restore: first tick [ ], later ticks [ ]. Consequence for the render delta: [e.g. "after a restore, emit a full resync, not a delta"]
- (g) ms/tick at about 2k→2.6k: native [ ] / sorted [ ] at 1×; native [ ] / sorted [ ] at 4×. Consequence: [e.g. "keep an incremental sorted index; don't sort per tick"]
- (h) Miniplex: [same conclusions? differences?]

## Verdict
[KOOTA | MINIPLEX], because [one or two sentences].

## Consequences for Plan 2 (A1)
- Facade ordering rule: [ ]
- Snapshot entity and relation sections: [the encoding used in snapshot.ts, or a change]
- Render-delta rule after restore: [ ]
```

- [ ] **Step 8: Format and commit**

```bash
pnpm format && pnpm lint
git add spikes/s1-koota docs/spikes/s1-koota.md
git commit -m "spike(s1): Koota order/restore/tracking determinism + Miniplex comparison — verdict"
```

---

### Task 4: S2, Rapier deterministic builds (state, snapshot bytes, CSP)

**Files:**
- Create: `spikes/s2-rapier/scene.ts`, `expected.ts`, `rapier.parity.test.ts`, `csp.html`, `csp.ts`, `docs/spikes/s2-rapier.md`

**Interfaces:**
- Produces:
  - `initRapier()`
  - `run3d(ticks, restoreAt?)` and `run2d(ticks, restoreAt?)`, each returning `{ bodies, state, snapshot, roundTripSnapshot }`. `state` holds the translation, rotation, linear velocity and angular velocity of every body.

- [ ] **Step 1: Write the scenes (balls, cuboids, and a revolute-joint chain)**

`spikes/s2-rapier/scene.ts`:
```ts
import R2 from '@dimforge/rapier2d-deterministic-compat'
import R3 from '@dimforge/rapier3d-deterministic-compat'
import { mulberry32 } from '../shared/prng'

let ready: Promise<void> | undefined
export function initRapier(): Promise<void> {
  ready ??= Promise.all([R3.init(), R2.init()]).then(() => undefined)
  return ready
}

/** state: per body [handle, translation, rotation, linvel, angvel]; snapshot: Rapier's own bytes at the end. */
export type RunOut = { bodies: number; state: number[]; snapshot: Uint8Array; roundTripSnapshot: Uint8Array }

/** 40 balls + 20 cuboids + a 6-link revolute-joint chain, falling onto a ground slab. */
export function run3d(ticks: number, restoreAt?: number): RunOut {
  let world = new R3.World({ x: 0, y: -9.81, z: 0 })
  world.createCollider(R3.ColliderDesc.cuboid(50, 0.5, 50).setFriction(0.7))
  const rand = mulberry32(3)
  for (let i = 0; i < 60; i++) {
    const body = world.createRigidBody(
      R3.RigidBodyDesc.dynamic().setTranslation(rand() * 10 - 5, 2 + i * 0.6, rand() * 10 - 5),
    )
    const desc =
      i < 40
        ? R3.ColliderDesc.ball(0.3 + rand() * 0.2)
        : R3.ColliderDesc.cuboid(0.2 + rand() * 0.3, 0.2 + rand() * 0.3, 0.2 + rand() * 0.3)
    world.createCollider(desc.setRestitution(0.4).setFriction(0.5), body)
  }
  let prev = world.createRigidBody(R3.RigidBodyDesc.fixed().setTranslation(0, 12, 0))
  for (let i = 0; i < 6; i++) {
    const link = world.createRigidBody(R3.RigidBodyDesc.dynamic().setTranslation(0.8 * (i + 1), 12, 0))
    world.createCollider(R3.ColliderDesc.cuboid(0.35, 0.1, 0.1), link)
    world.createImpulseJoint(
      R3.JointData.revolute({ x: 0.4, y: 0, z: 0 }, { x: -0.4, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }),
      prev,
      link,
      true,
    )
    prev = link
  }
  for (let t = 0; t < ticks; t++) {
    if (t === restoreAt) world = R3.World.restoreSnapshot(world.takeSnapshot())
    world.step()
  }
  const state: number[] = []
  world.forEachRigidBody((b) => {
    const p = b.translation()
    const q = b.rotation()
    const v = b.linvel()
    const w = b.angvel()
    state.push(b.handle, p.x, p.y, p.z, q.x, q.y, q.z, q.w, v.x, v.y, v.z, w.x, w.y, w.z)
  })
  const snapshot = world.takeSnapshot()
  const roundTripSnapshot = R3.World.restoreSnapshot(snapshot).takeSnapshot()
  return { bodies: state.length / 14, state, snapshot, roundTripSnapshot }
}

export function run2d(ticks: number, restoreAt?: number): RunOut {
  let world = new R2.World({ x: 0, y: -9.81 })
  world.createCollider(R2.ColliderDesc.cuboid(50, 0.5).setFriction(0.7))
  const rand = mulberry32(4)
  for (let i = 0; i < 60; i++) {
    const body = world.createRigidBody(
      R2.RigidBodyDesc.dynamic().setTranslation(rand() * 10 - 5, 2 + i * 0.6),
    )
    const desc =
      i < 40
        ? R2.ColliderDesc.ball(0.3 + rand() * 0.2)
        : R2.ColliderDesc.cuboid(0.2 + rand() * 0.3, 0.2 + rand() * 0.3)
    world.createCollider(desc.setRestitution(0.4).setFriction(0.5), body)
  }
  let prev = world.createRigidBody(R2.RigidBodyDesc.fixed().setTranslation(0, 12))
  for (let i = 0; i < 6; i++) {
    const link = world.createRigidBody(R2.RigidBodyDesc.dynamic().setTranslation(0.8 * (i + 1), 12))
    world.createCollider(R2.ColliderDesc.cuboid(0.35, 0.1), link)
    world.createImpulseJoint(R2.JointData.revolute({ x: 0.4, y: 0 }, { x: -0.4, y: 0 }), prev, link, true)
    prev = link
  }
  for (let t = 0; t < ticks; t++) {
    if (t === restoreAt) world = R2.World.restoreSnapshot(world.takeSnapshot())
    world.step()
  }
  const state: number[] = []
  world.forEachRigidBody((b) => {
    const p = b.translation()
    const v = b.linvel()
    state.push(b.handle, p.x, p.y, b.rotation(), v.x, v.y, b.angvel())
  })
  const snapshot = world.takeSnapshot()
  const roundTripSnapshot = R2.World.restoreSnapshot(snapshot).takeSnapshot()
  return { bodies: state.length / 7, state, snapshot, roundTripSnapshot }
}
```

`spikes/s2-rapier/expected.ts`:
```ts
export const R3_STATE_EXPECTED = 'replace-with-node-hash'
export const R3_SNAPSHOT_EXPECTED = 'replace-with-node-hash'
export const R2_STATE_EXPECTED = 'replace-with-node-hash'
export const R2_SNAPSHOT_EXPECTED = 'replace-with-node-hash'
```

- [ ] **Step 2: Write the parity test**

`spikes/s2-rapier/rapier.parity.test.ts`:
```ts
import { beforeAll, expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { R2_SNAPSHOT_EXPECTED, R2_STATE_EXPECTED, R3_SNAPSHOT_EXPECTED, R3_STATE_EXPECTED } from './expected'
import { initRapier, type RunOut, run2d, run3d } from './scene'

beforeAll(() => initRapier())

async function check(run: (ticks: number, restoreAt?: number) => RunOut, bodies: number) {
  const straight = run(300)
  const restored = run(300, 150)
  expect(straight.bodies).toBe(bodies) // Review Focus #1
  const state = await sha256Hex(f64Bytes(straight.state))
  const snap = await sha256Hex(straight.snapshot)
  expect(await sha256Hex(f64Bytes(restored.state))).toBe(state) // mid-run restore changes nothing
  expect(await sha256Hex(restored.snapshot)).toBe(snap) // ...not even the snapshot bytes
  expect(await sha256Hex(straight.roundTripSnapshot)).toBe(snap) // restore(s).takeSnapshot() == s, byte for byte
  return { state, snap, bytes: straight.snapshot.length }
}

test('3D (balls, cuboids, revolute chain): state and snapshot bytes identical in every engine', async () => {
  const r = await check(run3d, 67)
  console.log(`[S2] 3d state=${r.state} snapshot=${r.snap} snapshot-bytes=${r.bytes}`)
  expect(r.state).toBe(R3_STATE_EXPECTED)
  expect(r.snap).toBe(R3_SNAPSHOT_EXPECTED)
})

test('2D (balls, cuboids, revolute chain): state and snapshot bytes identical in every engine', async () => {
  const r = await check(run2d, 67)
  console.log(`[S2] 2d state=${r.state} snapshot=${r.snap} snapshot-bytes=${r.bytes}`)
  expect(r.state).toBe(R2_STATE_EXPECTED)
  expect(r.snap).toBe(R2_SNAPSHOT_EXPECTED)
})
```

- [ ] **Step 3: Get the Node hashes, then run all engines**

Run: `pnpm --filter @spikes/all exec vitest run --project node s2-rapier`
Expected: the two `[S2] … state=<hex> snapshot=<hex>` lines print before the asserts fail on the placeholders. The restore and round-trip assertions must already pass. Paste the four values into `expected.ts`, then:

Run: `pnpm --filter @spikes/all exec vitest run s2-rapier`
Expected: `Tests 8 passed (8)`. Pre-run snapshot sizes: 3D 104876 bytes, 2D 86524 bytes. **Any engine mismatch is S2's FAIL condition. Escalate it before A1** (spec §2).

- [ ] **Step 4: Write the CSP page (Review Focus #4: ok only after a real step)**

`spikes/s2-rapier/csp.html`:
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8" /></head><body><canvas width="8" height="8"></canvas>
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
  // Review Focus #3: ok only if Rapier really stepped. Body 0 started at y=2 and must have fallen.
  const fell3 = (a.state[2] as number) < 2
  const fell2 = (b.state[2] as number) < 2
  Object.assign(out, { ok: fell3 && fell2, bodies3d: a.bodies, bodies2d: b.bodies })
} catch (err) {
  out.error = String(err)
}
;(window as unknown as { __result: unknown }).__result = out
```

- [ ] **Step 5: Run the CSP check in every browser, then measure the built payload**

Run:
```bash
for b in chromium webkit firefox; do node spikes/shared/run-page.ts --page s2-rapier/csp.html --csp --browser $b; echo "$b exit=$?"; done
for f in $(find spikes/out/s2-rapier_csp_html -name '*.js'); do echo "$(basename $f) raw=$(wc -c <"$f") gzip=$(gzip -c "$f" | wc -c)"; done
```
Expected:
- All three runs report `"ok": true`, `"violations": []` and `exit=0`.
- One JS bundle. Pre-run: raw 7814533 / gzip 2963674 bytes. That is 2D **and** 3D compat together, with the wasm base64-inlined; a game ships only one.

- [ ] **Step 6: Write the verdict**

`docs/spikes/s2-rapier.md`:
```markdown
# S2: Rapier deterministic builds

- **Question:** Do `@dimforge/rapier{2d,3d}-deterministic-compat@0.21.0` give bit-identical state **and snapshot bytes** in all four engines, survive a mid-run restore, round-trip snapshots byte-for-byte, and load under `script-src 'self' 'wasm-unsafe-eval'`?

## Results
| Check | Node | Chromium | WebKit | Firefox |
|---|---|---|---|---|
| 3D state hash (pos/rot/linvel/angvel) | | | | |
| 3D snapshot bytes hash | | | | |
| 2D state hash | | | | |
| 2D snapshot bytes hash | | | | |
| Restore at 150 → identical state and bytes | | | | |
| `restore(s).takeSnapshot() == s` | | | | |
| CSP load + step | n/a | | | |

- Built payload (2D + 3D compat, gzip): [n] bytes.

## Verdict
[PASS | FAIL → escalate], because [reason].

## Consequences for Plan 2
- `sim.hash()` may include Rapier snapshot bytes directly: [yes/no].
- Package: the `-compat` builds are proven under the CSP. Follow-up for A3: measure the non-compat build (separate `.wasm`) to cut the payload by about a third.
```

- [ ] **Step 7: Format and commit**

```bash
pnpm format && pnpm lint
git add spikes/s2-rapier docs/spikes/s2-rapier.md
git commit -m "spike(s2): Rapier 2D/3D state + snapshot-byte parity, restore, CSP — verdict"
```

---

### Task 5: S5, deterministic math

**Files:**
- Create: `spikes/s5-math/dmath.ts`, `expected.ts`, `dmath.parity.test.ts`, `dmath.rules.node.test.ts`, `dmath.accuracy.node.test.ts`, `dmath.bench.node.test.ts`, `docs/spikes/s5-math.md`

**Interfaces:**
- Produces: `sin`, `cos`, `tan`, `atan`, `atan2(y, x)`, `exp`, `log`, `pow(x, y)`, `hypot(x, y)`. Plan 2 copies `dmath.ts` into `automata-sim/math`.

- [ ] **Step 1: Write the module (fdlibm-derived kernels)**

`spikes/s5-math/dmath.ts`:
```ts
// biome-ignore-all lint/correctness/noPrecisionLoss: fdlibm constants are kept verbatim as published; they parse to the intended doubles.
// biome-ignore-all lint/suspicious/noApproximativeNumericConstant: pi-related literals are deliberate (Math.PI is outside the allowlist).
// Deterministic math built from operations IEEE-754 requires to be correctly rounded.
// Kernels and constants are adapted from fdlibm (Sun Microsystems, freely redistributable).

const scratch = new DataView(new ArrayBuffer(8))

// --- sin / cos / tan -------------------------------------------------------
const INV_PIO2 = 6.36619772367581382433e-1
const PIO2_1 = 1.57079632673412561417 // first 33 bits of pi/2
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
const C5 = 2.0875723212981748279e-9
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
  if (x === 0) return x // keeps -0
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
const ATANHI: readonly number[] = [
  4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.570796326794896558,
]
const ATANLO: readonly number[] = [
  2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17,
  6.12323399573676603587e-17,
]
const AT = [
  3.33333333333329318027e-1, -1.99999999998764832476e-1, 1.42857142725034663711e-1, -1.1111110405462355788e-1,
  9.09088713343650656196e-2, -7.69187620504482999495e-2, 6.66107313738753120669e-2,
  -5.83357013379057348645e-2, 4.97687799461593236017e-2, -3.6531572744216915527e-2, 1.62858201153657823623e-2,
] as const
const PI = 3.141592653589793116
const PI_LO = 1.2246467991473531772e-16
const PIO2 = 1.570796326794896558
const PIO2_LO = 6.12323399573676603587e-17 // == ATANLO[3]

export function atan(x0: number): number {
  if (Number.isNaN(x0)) return Number.NaN
  if (x0 === 0) return x0 // keeps -0
  const neg = x0 < 0
  let x = Math.abs(x0)
  if (x >= 4.4e16) return neg ? -(PIO2 + PIO2_LO) : PIO2 + PIO2_LO
  let id: number
  if (x < 0.4375) id = -1
  else if (x < 0.6875) {
    id = 0
    x = (2 * x - 1) / (2 + x)
  } else if (x < 1.1875) {
    id = 1
    x = (x - 1) / (x + 1)
  } else if (x < 2.4375) {
    id = 2
    x = (x - 1.5) / (1 + 1.5 * x)
  } else {
    id = 3
    x = -1 / x
  }
  const z = x * x
  const w = z * z
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))))
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))))
  const hi = ATANHI[id] ?? 0
  const lo = ATANLO[id] ?? 0
  const r = id < 0 ? x - x * (s1 + s2) : hi - (x * (s1 + s2) - lo - x)
  return neg ? -r : r
}

/** Finite inputs only (sim values are finite). Signed zeros follow the built-in atan2. */
export function atan2(y: number, x: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return Number.NaN
  if (y === 0) return x > 0 || Object.is(x, 0) ? y : Object.is(y, -0) ? -PI : PI
  if (x === 0) return y > 0 ? PIO2 : -PIO2
  const z = atan(Math.abs(y / x))
  if (x > 0) return y < 0 ? -z : z
  return y < 0 ? z - PI_LO - PI : PI - (z - PI_LO)
}

// --- exp / log / pow -------------------------------------------------------
const LN2_HI = 6.9314718036912381649e-1
const LN2_LO = 1.90821492927058770002e-10
const INV_LN2 = 1.442695040888963387
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

const LG1 = 6.66666666666673513e-1
const LG2 = 3.999999999940941908e-1
const LG3 = 2.857142874366239149e-1
const LG4 = 2.222219843214978396e-1
const LG5 = 1.818357216161805012e-1
const LG6 = 1.531383769920937332e-1
const LG7 = 1.479819860511658591e-1
const SQRT2 = 1.41421356237309514547

export function log(x0: number): number {
  if (Number.isNaN(x0) || x0 < 0) return Number.NaN
  if (x0 === 0) return Number.NEGATIVE_INFINITY
  if (x0 === Number.POSITIVE_INFINITY) return x0
  let x = x0
  let k = 0
  if (x < 2.2250738585072014e-308) {
    x *= 18014398509481984
    k = -54
  } // scale subnormals by 2^54
  scratch.setFloat64(0, x, false)
  const hx = scratch.getUint32(0, false)
  k += ((hx >>> 20) & 0x7ff) - 1023
  scratch.setUint32(0, ((hx & 0x000fffff) | 0x3ff00000) >>> 0, false)
  let m = scratch.getFloat64(0, false) // in [1, 2)
  if (m > SQRT2) {
    m *= 0.5
    k += 1
  }
  const f = m - 1
  const s = f / (2 + f)
  const z = s * s
  const w = z * z
  const t1 = w * (LG2 + w * (LG4 + w * LG6))
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)))
  const hfsq = 0.5 * f * f
  return k * LN2_HI - (hfsq - (s * (hfsq + t2 + t1) + k * LN2_LO) - f)
}

/** Exact-as-IEEE path for small integer exponents: repeated squaring, so pow(2, 3) === 8. */
function powInt(x: number, n: number): number {
  let result = 1
  let base = x
  let e = Math.abs(n)
  while (e > 0) {
    if (e % 2 === 1) result *= base
    base *= base
    e = Math.floor(e / 2)
  }
  return n < 0 ? 1 / result : result
}

export function pow(x: number, y: number): number {
  if (y === 0) return 1
  if (Number.isNaN(x) || Number.isNaN(y)) return Number.NaN
  if (Number.isInteger(y) && Math.abs(y) <= 64) return powInt(x, y)
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

- [ ] **Step 2: Write the source rule (the pass criterion "only bit-exact operations")**

`spikes/s5-math/dmath.rules.node.test.ts`:
```ts
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// The S5 pass criterion "built only from bit-exact operations", enforced on the source.
// Math.round is an addition to spec §2's list (it is exact: IEEE round-half-up on an exact value).
const ALLOWED = ['sqrt', 'fround', 'round', 'floor', 'ceil', 'trunc', 'abs', 'min', 'max', 'sign']

/** Math members used in code (comments stripped, so prose mentioning Math.PI doesn't count). */
function mathMembers(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  return [...code.matchAll(/\bMath\.([A-Za-z0-9_]+)/g)].map((m) => m[1] as string)
}

test('dmath.ts uses only bit-exact Math members', () => {
  const used = mathMembers(readFileSync(new URL('./dmath.ts', import.meta.url), 'utf8'))
  expect(used.length).toBeGreaterThan(0)
  expect(used.filter((name) => !ALLOWED.includes(name))).toEqual([])
})

test('the rule catches a banned member in code but not in comments (negative control)', () => {
  const sample = '// Math.cos in a comment is fine\nconst y = Math.sin(x) + Math.sqrt(x) /* Math.exp */'
  expect(mathMembers(sample).filter((name) => !ALLOWED.includes(name))).toEqual(['sin'])
})
```

- [ ] **Step 3: Write the parity, accuracy and benchmark tests**

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

const N = 125_000 // x 8 functions = 1,000,000 samples

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

`spikes/s5-math/dmath.accuracy.node.test.ts`:
```ts
import { expect, test } from 'vitest'
import { mulberry32 } from '../shared/prng'
import { atan, atan2, cos, exp, log, pow, sin, tan } from './dmath'

function maxErr(f: (r: () => number) => [number, number], n = 200_000, rel = false): number {
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
    sin: maxErr((q) => {
      const x = q() * 2000 - 1000
      return [sin(x), Math.sin(x)]
    }),
    cos: maxErr((q) => {
      const x = q() * 2000 - 1000
      return [cos(x), Math.cos(x)]
    }),
    tan: maxErr(
      (q) => {
        let x = q() * 2000 - 1000
        while (Math.abs(Math.cos(x)) < 1e-3) x += 0.01
        return [tan(x), Math.tan(x)]
      },
      200_000,
      true,
    ),
    atan2: maxErr((q) => {
      const y = q() * 2000 - 1000
      const x = q() * 2000 - 1000
      return [atan2(y, x), Math.atan2(y, x)]
    }),
    exp: maxErr(
      (q) => {
        const x = q() * 1400 - 700
        return [exp(x), Math.exp(x)]
      },
      200_000,
      true,
    ),
    log: maxErr(
      (q) => {
        const x = 10 ** (q() * 600 - 300)
        return [log(x), Math.log(x)]
      },
      200_000,
      true,
    ),
    pow: maxErr(
      (q) => {
        const x = q() * 100 + 1e-9
        const y = q() * 20 - 10
        return [pow(x, y), x ** y]
      },
      200_000,
      true,
    ),
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

test('edge values and signed zeros match Math.*', () => {
  expect(exp(0)).toBe(1)
  expect(log(1)).toBe(0)
  expect(exp(710)).toBe(Number.POSITIVE_INFINITY)
  expect(exp(-800)).toBe(0)
  expect(log(0)).toBe(Number.NEGATIVE_INFINITY)
  expect(Number.isNaN(log(-1))).toBe(true)
  expect(Math.abs(log(5e-324) - Math.log(5e-324))).toBeLessThan(1e-12)
  expect(Object.is(sin(-0), -0)).toBe(true)
  expect(Object.is(atan(-0), -0)).toBe(true)
  for (const [y, x] of [
    [0, -1],
    [-0, -1],
    [0, 0],
    [-0, 0],
    [0, -0],
    [-0, -0],
    [1, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
  ] as const) {
    expect(Object.is(atan2(y, x), Math.atan2(y, x)) || Math.abs(atan2(y, x) - Math.atan2(y, x)) < 1e-15).toBe(
      true,
    )
  }
  expect(pow(2, 3)).toBe(8)
  expect(pow(-2, 3)).toBe(-8)
  expect(pow(1.5, 2)).toBe(2.25)
  expect(pow(2, -2)).toBe(0.25)
  expect(Object.is(pow(-0, 3), -0)).toBe(true)
})
```

`spikes/s5-math/dmath.bench.node.test.ts`:
```ts
import { test } from 'vitest'
import * as d from './dmath'

test('cost vs Math.* (informational)', () => {
  const xs = Float64Array.from({ length: 1_000_000 }, (_, i) => (i % 2000) - 1000.5)
  const time = (f: (x: number) => number): number => {
    let s = 0
    const t0 = performance.now()
    for (const x of xs) s += f(x)
    if (Number.isNaN(s)) console.log('unreachable')
    return Math.round(performance.now() - t0)
  }
  const rows = {
    sin: [time(d.sin), time(Math.sin)],
    atan: [time(d.atan), time(Math.atan)],
    exp: [time((x) => d.exp(x / 15)), time((x) => Math.exp(x / 15))],
    log: [time((x) => d.log(Math.abs(x))), time((x) => Math.log(Math.abs(x)))],
  }
  console.log('[S5] ms per 1M [dmath, Math]', JSON.stringify(rows))
})
```

- [ ] **Step 4: Get the Node hash, then run all engines**

Run: `pnpm --filter @spikes/all exec vitest run --project node s5-math`
Expected: exactly 1 FAIL, on `DMATH_EXPECTED` (pre-run `2d8c5d2d…`). The rules, accuracy and edge tests pass. Paste the hash in, then:

Run: `pnpm --filter @spikes/all exec vitest run s5-math`
Expected: `Tests 9 passed (9)`. Pre-run `[S5] max error`: sin and cos 1.1e-16, tan 4.4e-16, atan2 4.4e-16, exp 1.9e-16, log 2.2e-16, pow 8.1e-15. If a bound fails, fix the kernel. Never loosen the bound.

- [ ] **Step 5: Write the verdict**

`docs/spikes/s5-math.md`:
```markdown
# S5: Deterministic math

- **Question:** Can `sin/cos/tan/atan2/exp/log/pow/hypot`, built only from bit-exact operations, give identical bits in V8, JSC and SpiderMonkey, with acceptable accuracy and cost?

## Results
- Why it's needed: the native `Math.*` hash differs per engine (Task 2 `[harness]` lines): [paste the four].
- dmath parity, 1M samples: Node [ ], Chromium [ ], WebKit [ ], Firefox [ ]
- Source rule (allowed members only): [pass]
- Max error: [paste `[S5] max error`]
- Cost, ms per 1M [dmath, Math]: [paste]

## Contract (documented limits)
- `sin` and `cos` are accurate for |x| < ~8.2e5; beyond that they are deterministic but less accurate.
- `atan2` and `hypot` take finite inputs only. Signed zeros match the built-ins. `hypot` does no overflow scaling.
- `pow` with an integer |y| ≤ 64 uses repeated squaring, so it is exact where IEEE is (`pow(2, 3) === 8`). Otherwise it computes `exp(y·log x)`.
- `kCos` omits fdlibm's `qx` correction, and `log` always takes the `hfsq` branch. Both are inside the accuracy bounds above.

## Verdict
[PASS | FAIL], because [reason].

## Consequences for Plan 2
- `automata-sim/math` = `dmath.ts`, plus a golden table of committed input/output bit patterns.
- `Math.*` allowlist for `check-boundaries`: `sqrt, fround, round, floor, ceil, trunc, abs, min, max, sign` (and `imul` for the RNG). `round` and `imul` are additions to spec §2's list; record them in the spec's §11.
```

- [ ] **Step 6: Format and commit**

```bash
pnpm format && pnpm lint
git add spikes/s5-math docs/spikes/s5-math.md
git commit -m "spike(s5): deterministic math, source rule, cross-engine parity, accuracy — verdict"
```

---

### Task 6: S3, Three.js WebGPU → WebGL2 with TSL post-processing

**Files:**
- Create: `spikes/s3-three/index.html`, `spikes/s3-three/main.ts`, `docs/spikes/s3-three.md`

**Interfaces:**
- Consumes: `run-page.ts`, `compare.ts`, `gpu-info.ts`.
- Produces: `window.__result = { ok, requested, backend, dither, fps, gpu }`. The query parameter `?backend=webgpu|webgl2` picks the backend, and `?dither=0` renders the plain frame for the positive control.

- [ ] **Step 1: Write the page**

`spikes/s3-three/index.html`:
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><style>body{margin:0;background:#000}</style></head>
<body><script type="module" src="./main.ts"></script></body></html>
```

`spikes/s3-three/main.ts`:
```ts
import { bayerDither } from 'three/addons/tsl/math/Bayer.js'
import { float, pass, vec4 } from 'three/tsl'
import * as THREE from 'three/webgpu'
import { gpuInfo } from '../shared/gpu-info'

const params = new URLSearchParams(location.search)
const requested = params.get('backend') === 'webgl2' ? 'webgl2' : 'webgpu'
const dither = params.get('dither') !== '0' // ?dither=0 renders the plain frame (positive control)
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
const scenePass = pass(scene, camera)
pipeline.outputNode = dither ? vec4(bayerDither(scenePass.rgb, float(8)), 1) : scenePass

const pose = (t: number) => {
  meshes.forEach((m, i) => {
    m.rotation.set(i * 0.3 + t, i * 0.5 + t * 0.7, 0)
  })
}

// Animated FPS measurement over 300 frames (recorded, not gated: rAF caps it at the display rate).
const frames = 300
let count = 0
const t0 = performance.now()
await new Promise<void>((done) => {
  const frame = () => {
    pose(count / 60)
    pipeline.render()
    count += 1
    if (count < frames) requestAnimationFrame(frame)
    else done()
  }
  requestAnimationFrame(frame)
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
  dither,
  fps: Math.round(fps),
  gpu: await gpuInfo(),
}
```

- [ ] **Step 2: Capture both backends and the positive control (all headed: see the note)**

Run:
```bash
node spikes/shared/run-page.ts --page s3-three/index.html --headed --query backend=webgpu --screenshot spikes/out/s3-webgpu.png
node spikes/shared/run-page.ts --page s3-three/index.html --headed --query backend=webgl2 --screenshot spikes/out/s3-webgl2.png
node spikes/shared/run-page.ts --page s3-three/index.html --headed --query "backend=webgpu&dither=0" --screenshot spikes/out/s3-webgpu-plain.png
node spikes/shared/compare.ts spikes/out/s3-webgpu.png spikes/out/s3-webgl2.png --max-ratio 0.01
node spikes/shared/compare.ts spikes/out/s3-webgpu.png spikes/out/s3-webgpu-plain.png --min-ratio 0.05
```
Expected:
- All three runs report `"ok": true`, with `backend` equal to `requested`.
- `gpu` names a real GPU. Pre-run: `apple metal-3` and `ANGLE (Apple, ANGLE Metal Renderer: Apple M1…)`.
- Match: pre-run `ratio: 0`, 429 colours each.
- Positive control: pre-run `ratio: 0.77`.

Both compares exit 0. **Why headed:** in headless Chromium on macOS, WebGPU *renders* (the backend is real) but its canvas screenshots as solid black, so the compare would fail. Running both backends headed keeps the comparison like-for-like.

- [ ] **Step 3: Record FPS on a phone profile and in WebKit**

Run:
```bash
node spikes/shared/run-page.ts --page s3-three/index.html --query backend=webgl2 --device "Pixel 7" --throttle 4
node spikes/shared/run-page.ts --page s3-three/index.html --browser webkit --query backend=webgl2
```
Expected: `"ok": true` for both. Pre-run FPS: 55 for Pixel 7 at 4×, 56 for WebKit. FPS is **recorded, not gated**: rAF caps it at the display rate, and CPU throttling doesn't slow the GPU. The real 30 FPS gate runs on devices in A3.

- [ ] **Step 4: Write the verdict**

`docs/spikes/s3-three.md`:
```markdown
# S3: Three.js r186 WebGPU → WebGL2 with TSL post-processing

## Results
- WebGPU obtained: [ ] · GPU strings: [paste `gpu`]
- Pixel diff, WebGPU vs WebGL2 (dithered): ratio [ ] (pass ≤ 0.01)
- Positive control, dithered vs plain: ratio [ ] (must be ≥ 0.05)
- FPS (recorded): Chromium WebGPU [ ], Chromium WebGL2 [ ], Pixel 7 profile at 4× [ ], WebKit WebGL2 [ ]
- Note: headless Chromium/macOS captures a WebGPU canvas as black, so visual goldens on the A3 Linux runner must be verified for this.

## Verdict
[PASS | PARTIAL | FAIL], because [reason].

## Consequences for A2/A4
- The post-process stack is authored once in TSL for both backends. Typed usage: `vec4(bayerDither(scenePass.rgb, float(8)), 1)`.
- Backend selection: WebGPU by default, `forceWebGL` when [condition].
```

- [ ] **Step 5: Format and commit**

```bash
pnpm format && pnpm lint
git add spikes/s3-three docs/spikes/s3-three.md
git commit -m "spike(s3): Three WebGPU/WebGL2 TSL dither parity with positive control — verdict"
```

---

### Task 7: S4, PixiJS 8 on WebGPU and WebGL

**Files:**
- Create: `spikes/s4-pixi/dither.ts`, `index.html`, `main.ts`, `docs/spikes/s4-pixi.md`

**Interfaces:**
- Produces: `ditherFilter(steps)` and `window.__result = { ok, requested, backend, dither, fps5k, gpu }`.

- [ ] **Step 1: Write the dither filter (GLSL + WGSL, with pixel position from the vertex stage)**

Pixel coordinates come from the vertex stage on purpose. In the fragment stage, `gl_FragCoord` counts y from the bottom while WGSL's `@builtin(position)` counts from the top. On the 270-row canvas that shifts the 4×4 dither pattern, and the pre-run diff with `gl_FragCoord` was **13%**. Computing the position in the vertex stage gave a diff of **0**.

`spikes/s4-pixi/dither.ts`:
```ts
import { Filter, GlProgram, GpuProgram } from 'pixi.js'

const glVertex = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vPixel;
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
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); vPixel = aPosition * uOutputFrame.zw + uOutputFrame.xy; }`

const glFragment = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vPixel;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uSteps;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  vec2 p = floor(vPixel); // from the vertex stage: top-left origin on both backends (gl_FragCoord is bottom-left)
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
struct VSOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, @location(1) pixel: vec2<f32> };
fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32> {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
@vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
  return VSOutput(filterVertexPosition(aPosition), aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw), aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy);
}
@fragment fn mainFragment(@location(0) uv: vec2<f32>, @location(1) pixel: vec2<f32>) -> @location(0) vec4<f32> {
  let c = textureSample(uTexture, uSampler, uv);
  let p = floor(pixel);
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

- [ ] **Step 2: Write the page**

`spikes/s4-pixi/index.html`:
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><style>body{margin:0;background:#000}</style></head>
<body><script type="module" src="./main.ts"></script></body></html>
```

`spikes/s4-pixi/main.ts`:
```ts
import { autoDetectRenderer, Container, Graphics, Sprite, Texture } from 'pixi.js'
import { gpuInfo } from '../shared/gpu-info'
import { mulberry32 } from '../shared/prng'
import { ditherFilter } from './dither'

const params = new URLSearchParams(location.search)
const requested = params.get('backend') === 'webgl' ? 'webgl' : 'webgpu'
const dither = params.get('dither') !== '0' // ?dither=0 renders the plain frame (positive control)
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
  s.width = 4
  s.height = 4
  s.position.set(rand() * 480, rand() * 270)
  stress.addChild(s)
  return s
})
const frames = 300
let n = 0
const t0 = performance.now()
await new Promise<void>((done) => {
  const frame = () => {
    for (const s of sprites) s.x = (s.x + 1) % 480
    renderer.render(stress)
    n += 1
    if (n < frames) requestAnimationFrame(frame)
    else done()
  }
  requestAnimationFrame(frame)
})
const fps5k = frames / ((performance.now() - t0) / 1000)

// Static frame for the screenshot comparison: 16 gradient bars, optionally through the dither filter.
const scene = new Container()
for (let i = 0; i < 16; i++) {
  const color = ((i * 16) << 16) | ((255 - i * 16) << 8) | 128
  scene.addChild(new Graphics().rect(i * 30, 0, 30, 270).fill({ color }))
}
if (dither) scene.filters = [ditherFilter(8)]
renderer.render(scene)
await new Promise((r) => requestAnimationFrame(() => r(null)))
;(window as unknown as { __result: unknown }).__result = {
  ok: backend === requested,
  requested,
  backend,
  dither,
  fps5k: Math.round(fps5k),
  gpu: await gpuInfo(),
}
```

- [ ] **Step 3: Capture, compare, and record FPS**

Run:
```bash
node spikes/shared/run-page.ts --page s4-pixi/index.html --headed --query backend=webgpu --screenshot spikes/out/s4-webgpu.png
node spikes/shared/run-page.ts --page s4-pixi/index.html --headed --query backend=webgl --screenshot spikes/out/s4-webgl.png
node spikes/shared/run-page.ts --page s4-pixi/index.html --headed --query "backend=webgpu&dither=0" --screenshot spikes/out/s4-webgpu-plain.png
node spikes/shared/compare.ts spikes/out/s4-webgpu.png spikes/out/s4-webgl.png --max-ratio 0.01
node spikes/shared/compare.ts spikes/out/s4-webgpu.png spikes/out/s4-webgpu-plain.png --min-ratio 0.05
node spikes/shared/run-page.ts --page s4-pixi/index.html --query backend=webgl --device "Pixel 7" --throttle 4
```
Expected:
- Every run reports `"ok": true`.
- Match: pre-run `ratio: 0`.
- Positive control: pre-run `ratio: 0.38`.
- `fps5k` is recorded; pre-run it was 60.
- A `404` console line for `/favicon.ico` is harmless.

- [ ] **Step 4: Write the verdict**

`docs/spikes/s4-pixi.md`:
```markdown
# S4: PixiJS 8.21 on WebGPU and WebGL

## Results
- WebGPU obtained: [ ] · GPU strings: [ ] · the dither filter compiles on both backends: [ ]
- Pixel diff ratio: [ ] · positive control ratio: [ ]
- fps with 5k sprites: WebGPU [ ], WebGL [ ], Pixel 7 profile at 4× [ ]

## Verdict
[PASS | PARTIAL | FAIL], because [reason].

## Consequences for A2/A4
- Every Pixi post effect ships as a GLSL + WGSL pair. **Screen-space effects take pixel position from the vertex stage**, never from `gl_FragCoord` or `@builtin(position)`.
```

- [ ] **Step 5: Format and commit**

```bash
pnpm format && pnpm lint
git add spikes/s4-pixi docs/spikes/s4-pixi.md
git commit -m "spike(s4): Pixi 8 WebGPU/WebGL dither parity (vertex-stage coords) + stress — verdict"
```

---

### Task 8: S6, Ruken SDK stub against P01

**Files:**
- Create: `spikes/s6-ruken/protocol.ts`, `allowlist.ts`, `allowlist.node.test.ts`, `saves-storage.ts`, `sdk-stub.ts`, `mock-host.ts`, `storage-suite.ts`, `storage-dom.node.test.ts`, `handshake.node.test.ts`, `requests.node.test.ts`, `saves.node.test.ts`, `catalog.node.test.ts`, `dom-env.ts`, `host.html`, `host.ts`, `game.html`, `game.ts`, `docs/spikes/s6-ruken-stub.md`

**Interfaces:**
- Produces:
  - **From `protocol.ts`:** `CATALOG` (P01 §7 as data), `catalogRow(type)`, `type RukenEnv`, `type Envelope`, `RukenError { code, retryable }`, `makeEnvelope`, `isEnvelope`.
  - **SDK:** `isAllowedHostOrigin(host, game)`, and `initRuken(opts, env): Promise<RukenStub>` with `hosted`, `ready`, `granted`, `player`, `entitlements`, `onEntitlements`, `lifecycle`, `saves { storage, status, on, onChanged, flush }` and `request`.
  - **Test hosts:** `createFakeFrame` and `createMockHost` (Node), and `domEnv()` (browser).

  A2's `@snekprty/automata-host` Ruken adapter is built against these shapes until the real `@ruken/sdk` exists.

- [ ] **Step 1: Write the protocol module (P01 §5–§7 as code and data)**

First, open P01 §7 (lines 122–154) and confirm that the catalog below still matches it. It changed on 2026-10-01: `dlc` became `store`. Update any row that differs.

`spikes/s6-ruken/protocol.ts`:
```ts
// Ruken protocol v1.0, transcribed from RukenApp/docs/superpowers/specs/2026-10-01-ruken-p01-protocol-sdk-design.md
// (§5 envelope, §6 capabilities, §7 catalog). Re-check against P01 before A2: it is not frozen until F1 (2026-10-16).

export type ErrorCode =
  | 'UNSUPPORTED'
  | 'NOT_READY'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_PAYLOAD'
  | 'DENIED'
  | 'OFFLINE'
  | 'CANCELLED'
  | 'INTERNAL'

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
  | 'lifecycle'
  | 'input'
  | 'display'
  | 'audio'
  | 'exit'
  | 'menu'
  | 'saves'
  | 'leaderboards'
  | 'entitlements'
  | 'store'
  | 'ads'
  | 'telemetry'
  | 'analytics.custom'
  | 'links'

export const ALWAYS_GRANTED: readonly Capability[] = [
  'lifecycle',
  'input',
  'display',
  'audio',
  'exit',
  'telemetry',
]

export type HelloPayload = {
  sdkVersion: string
  proto: { min: string; max: string }
  gameId: string
  wants: Capability[]
  pauseBehavior: 'pause' | 'continue'
  menu: boolean
}

export type Entitlements = {
  ads: boolean
  items: string[]
  subscriptions: Array<{
    sku: string
    plan: 'monthly' | 'season'
    active: boolean
    seasonId?: string
    endsAt?: string
  }>
  devBuild: boolean
}

export type WelcomePayload = {
  proto: string
  granted: Capability[]
  player: { id: string; displayName: string }
  locale: string
  input: {
    mode: 'touch' | 'keyboard-mouse' | 'gamepad'
    gamepad?: { layout: 'xbox' | 'other'; connected: boolean }
  }
  display: {
    safeArea: { top: number; right: number; bottom: number; left: number }
    hostReserved: { edge: 'right' | 'left'; rect: { x: number; y: number; w: number; h: number } }
    orientation: string
    fullscreen: boolean
    scale: 1 | 1.333
  }
  audio: { focus: 'full' | 'ducked' | 'muted'; master: { volume: number; muted: boolean } }
  entitlements: Entitlements
  saves: { snapshot: Record<string, string>; status: string }
  consent: { analytics: boolean }
  host: { kind: 'web' | 'desktop'; version: string }
}

export type CatalogRow = {
  type: string
  kind: 'req' | 'evt'
  dir: 'G→H' | 'H→G'
  cap: Capability | null
  timeoutMs: number | null
}

/** P01 §7 message catalog (v1.0), one row per message type. */
export const CATALOG: readonly CatalogRow[] = [
  { type: 'hello', kind: 'evt', dir: 'G→H', cap: null, timeoutMs: null },
  { type: 'welcome', kind: 'evt', dir: 'H→G', cap: null, timeoutMs: null },
  { type: 'session.ready', kind: 'evt', dir: 'H→G', cap: null, timeoutMs: null },
  { type: 'lifecycle.changed', kind: 'evt', dir: 'H→G', cap: 'lifecycle', timeoutMs: null },
  { type: 'input.mode', kind: 'evt', dir: 'H→G', cap: 'input', timeoutMs: null },
  { type: 'host.summon', kind: 'evt', dir: 'G→H', cap: 'input', timeoutMs: null },
  { type: 'display.metrics', kind: 'evt', dir: 'H→G', cap: 'display', timeoutMs: null },
  { type: 'display.fullscreen', kind: 'req', dir: 'G→H', cap: 'display', timeoutMs: 3_000 },
  { type: 'audio.focus', kind: 'evt', dir: 'H→G', cap: 'audio', timeoutMs: null },
  { type: 'audio.master', kind: 'evt', dir: 'H→G', cap: 'audio', timeoutMs: null },
  { type: 'session.exit', kind: 'req', dir: 'G→H', cap: 'exit', timeoutMs: 2_000 },
  { type: 'session.exiting', kind: 'evt', dir: 'H→G', cap: 'exit', timeoutMs: null },
  { type: 'session.exitReady', kind: 'evt', dir: 'G→H', cap: 'exit', timeoutMs: null },
  { type: 'menu.open', kind: 'req', dir: 'H→G', cap: 'menu', timeoutMs: 1_000 },
  { type: 'saves.set', kind: 'evt', dir: 'G→H', cap: 'saves', timeoutMs: null },
  { type: 'saves.remove', kind: 'evt', dir: 'G→H', cap: 'saves', timeoutMs: null },
  { type: 'saves.flush', kind: 'req', dir: 'G→H', cap: 'saves', timeoutMs: 5_000 },
  { type: 'saves.status', kind: 'evt', dir: 'H→G', cap: 'saves', timeoutMs: null },
  { type: 'saves.changed', kind: 'evt', dir: 'H→G', cap: 'saves', timeoutMs: null },
  { type: 'leaderboard.submit', kind: 'req', dir: 'G→H', cap: 'leaderboards', timeoutMs: 5_000 },
  { type: 'leaderboard.get', kind: 'req', dir: 'G→H', cap: 'leaderboards', timeoutMs: 5_000 },
  { type: 'entitlements.changed', kind: 'evt', dir: 'H→G', cap: 'entitlements', timeoutMs: null },
  { type: 'store.purchase', kind: 'req', dir: 'G→H', cap: 'store', timeoutMs: 600_000 },
  { type: 'store.manage', kind: 'req', dir: 'G→H', cap: 'store', timeoutMs: 600_000 },
  { type: 'ads.break', kind: 'req', dir: 'G→H', cap: 'ads', timeoutMs: 120_000 },
  { type: 'telemetry.activity', kind: 'evt', dir: 'G→H', cap: 'telemetry', timeoutMs: null },
  { type: 'telemetry.perf', kind: 'evt', dir: 'G→H', cap: 'telemetry', timeoutMs: null },
  { type: 'telemetry.error', kind: 'evt', dir: 'G→H', cap: 'telemetry', timeoutMs: null },
  { type: 'analytics.track', kind: 'evt', dir: 'G→H', cap: 'analytics.custom', timeoutMs: null },
  { type: 'consent.changed', kind: 'evt', dir: 'H→G', cap: null, timeoutMs: null },
  { type: 'links.open', kind: 'req', dir: 'G→H', cap: 'links', timeoutMs: 30_000 },
]

export const catalogRow = (type: string): CatalogRow | undefined => CATALOG.find((r) => r.type === type)

export class RukenError extends Error {
  readonly code: ErrorCode
  readonly retryable: boolean
  constructor(code: ErrorCode, message: string, retryable = false) {
    super(`${code}: ${message}`)
    this.name = code === 'QUOTA_EXCEEDED' ? 'QuotaExceededError' : 'RukenError'
    this.code = code
    this.retryable = retryable
  }
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
  return (
    e.ruken === 1 &&
    typeof e.id === 'string' &&
    typeof e.type === 'string' &&
    (e.kind === 'req' || e.kind === 'res' || e.kind === 'evt')
  )
}

/** Everything the SDK needs from its window. Real browsers use dom-env.ts; Node tests use mock-host.ts. */
export type RukenEnv = {
  isTopLevel: boolean
  parent: unknown // identity only: welcome must come from this source
  gameOrigin: string
  postToParent(msg: unknown): void
  addMessageListener(
    fn: (ev: { data: unknown; origin: string; source: unknown; ports: readonly MessagePort[] }) => void,
  ): () => void
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
  localStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
}
```

- [ ] **Step 2: Write the allowlist test first (P01 §4 rules and the §10 item 3 table; Review Focus #5)**

`spikes/s6-ruken/allowlist.node.test.ts`:
```ts
import { expect, test } from 'vitest'
import { isAllowedHostOrigin } from './allowlist'

const PROD_GAME = 'https://g-abcdefghij.rukengames.com'
const LOCAL_GAMES = ['http://localhost:4400', 'http://g-abcdefghij.localhost:8787', 'http://127.0.0.1:4401']

// Cases copied from P01 §4 rules and the §10 item 3 allowlist table.
test.each([
  ['https://ruken.com', PROD_GAME, true],
  ['https://test.ruken.com', PROD_GAME, true],
  ['https://admin.private.ruken.com', PROD_GAME, true],
  ['https://pr-12.preview.ruken.com', PROD_GAME, true],
  ['https://ruken.com:443', PROD_GAME, true],
  ['https://evilruken.com', PROD_GAME, false],
  ['https://ruken.com.example.net', PROD_GAME, false],
  ['http://test.ruken.com', PROD_GAME, false],
  ['https://ruken.com:8443', PROD_GAME, false],
  ['tauri://localhost', PROD_GAME, true],
  ['http://tauri.localhost', PROD_GAME, true],
  ['https://tauri.localhost', PROD_GAME, true],
  ['http://localhost:5173', PROD_GAME, false],
  ['http://127.0.0.1:4300', PROD_GAME, false],
  ...LOCAL_GAMES.flatMap((g) => [
    ['http://localhost:5173', g, true] as const,
    ['http://127.0.0.1:4300', g, true] as const,
  ]),
  ['http://localhost:5173', 'http://abc.rkg.localhost', true],
  ['http://localhost:5173', 'https://g-x.rukengames-dev.com', false],
  ['https://localhost:5173', 'http://localhost:4400', false], // the local rule requires http:
  ['not a url', PROD_GAME, false],
] as const)('host %s with game %s -> %s', (host, game, allowed) => {
  expect(isAllowedHostOrigin(host, game)).toBe(allowed)
})
```

Run: `pnpm --filter @spikes/all exec vitest run --project node s6-ruken/allowlist`
Expected: the suite FAILs because `./allowlist` can't be resolved.

- [ ] **Step 3: Implement the allowlist and see it pass**

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
  if (host.protocol === 'https:' && host.port === '' && (h === 'ruken.com' || h.endsWith('.ruken.com')))
    return true
  // 2. Desktop.
  if (['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'].includes(hostOrigin))
    return true
  // 3. Local development, only when the game itself is local.
  const game = parse(gameOrigin)
  return (
    host.protocol === 'http:' &&
    (h === 'localhost' || h === '127.0.0.1') &&
    game !== null &&
    isLocalGame(game)
  )
}
```

Run: `pnpm --filter @spikes/all exec vitest run --project node s6-ruken/allowlist`
Expected: PASS, 24 cases.

- [ ] **Step 4: Write the stub's tests first**

`spikes/s6-ruken/mock-host.ts` (the Node fake window pair over real `MessageChannel` ports):
```ts
import {
  ALWAYS_GRANTED,
  type Capability,
  type Envelope,
  type ErrorCode,
  type HelloPayload,
  isEnvelope,
  makeEnvelope,
  type RukenEnv,
  type WelcomePayload,
} from './protocol'

type GameListener = Parameters<RukenEnv['addMessageListener']>[0]
type GameEvent = Parameters<GameListener>[0]

/** A fake game window: `parentWindow` and `selfWindow` are identity tokens for event.source checks. */
export type FakeFrame = {
  gameEnv: RukenEnv
  hostOrigin: string | null
  parentWindow: object
  selfWindow: object
  storage: Map<string, string>
  helloCount(): number
  onHello(fn: (hello: Envelope) => void): void
  deliverToGame(ev: GameEvent): void
}

export function createFakeFrame(o: { gameOrigin: string; hostOrigin: string | null }): FakeFrame {
  const listeners = new Set<GameListener>()
  const parentWindow = {}
  const selfWindow = {}
  let hellos = 0
  let helloHandler: ((h: Envelope) => void) | undefined
  const storage = new Map<string, string>()
  const gameEnv: RukenEnv = {
    isTopLevel: o.hostOrigin === null,
    parent: o.hostOrigin === null ? selfWindow : parentWindow,
    gameOrigin: o.gameOrigin,
    postToParent(msg) {
      if (isEnvelope(msg) && msg.type === 'hello') {
        hellos += 1
        helloHandler?.(msg)
      }
    },
    addMessageListener(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof globalThis.setTimeout>),
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => void storage.set(k, v),
      removeItem: (k) => void storage.delete(k),
      key: (i) => [...storage.keys()][i] ?? null,
      get length() {
        return storage.size
      },
    },
  }
  return {
    gameEnv,
    hostOrigin: o.hostOrigin,
    parentWindow,
    selfWindow,
    storage,
    helloCount: () => hellos,
    onHello: (fn) => {
      helloHandler = fn
    },
    deliverToGame: (ev) => {
      for (const l of listeners) l(ev)
    },
  }
}

export const baseWelcome = (granted: Capability[], snapshot: Record<string, string>): WelcomePayload => ({
  proto: '1.0',
  granted,
  player: { id: 'p_opaque', displayName: 'Tester' },
  locale: 'en',
  input: { mode: 'keyboard-mouse' },
  display: {
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    hostReserved: { edge: 'right', rect: { x: 0, y: 0, w: 48, h: 56 } },
    orientation: 'landscape',
    fullscreen: false,
    scale: 1,
  },
  audio: { focus: 'full', master: { volume: 1, muted: false } },
  entitlements: { ads: false, items: [], subscriptions: [], devBuild: true },
  saves: { snapshot, status: 'saved' },
  consent: { analytics: false },
  host: { kind: 'web', version: 'mock' },
})

export type MockHost = {
  inbox: Envelope[]
  send(env: Envelope): void
  sendEvt(type: string, payload: unknown): void
  request(type: string, payload: unknown): Promise<Envelope>
  received(type: string): unknown[]
  /** Round trip that guarantees every earlier game->host message has been delivered. */
  sync(): Promise<void>
}

export function createMockHost(o: {
  frame: FakeFrame
  offered: Capability[]
  saves: Record<string, string>
  respond?: { [type: string]: { error: ErrorCode; retryable?: boolean } | 'silent' | 'late' }
}): MockHost {
  let port: MessagePort | undefined
  const inbox: Envelope[] = []
  const waiting = new Map<string, (e: Envelope) => void>()
  const syncWaiters: Array<() => void> = []
  o.frame.onHello((hello) => {
    const hostOrigin = o.frame.hostOrigin
    if (port || hostOrigin === null) return
    const channel = new MessageChannel()
    ;(channel.port1 as unknown as { unref?: () => void }).unref?.() // don't keep the test process alive
    ;(channel.port2 as unknown as { unref?: () => void }).unref?.()
    port = channel.port1
    port.addEventListener('message', (ev: MessageEvent) => {
      const msg = ev.data as unknown
      if (!isEnvelope(msg)) return
      inbox.push(msg)
      if (msg.kind === 'res' && msg.re) {
        waiting.get(msg.re)?.(msg)
        waiting.delete(msg.re)
        return
      }
      if (msg.kind !== 'req') return
      const rule = o.respond?.[msg.type]
      if (rule === 'silent') return
      if (rule && rule !== 'late') {
        port?.postMessage({
          ...makeEnvelope('res', msg.type, undefined, msg.id),
          error: { code: rule.error, message: 'mock', retryable: rule.retryable ?? false },
        })
        return
      }
      const reply = () =>
        port?.postMessage(makeEnvelope('res', msg.type, { persisted: 'host-outbox' }, msg.id))
      if (rule === 'late') globalThis.setTimeout(reply, 6_000)
      else reply()
      if (msg.type === 'saves.flush') for (const w of syncWaiters.splice(0)) w()
    })
    port.start()
    const wants = (hello.payload as HelloPayload).wants
    const granted = o.offered.filter((c) => ALWAYS_GRANTED.includes(c) || wants.includes(c))
    o.frame.deliverToGame({
      data: makeEnvelope('evt', 'welcome', baseWelcome(granted, o.saves)),
      origin: hostOrigin,
      source: o.frame.parentWindow,
      ports: [channel.port2],
    })
  })
  const host: MockHost = {
    inbox,
    send: (env) => port?.postMessage(env),
    sendEvt: (type, payload) => port?.postMessage(makeEnvelope('evt', type, payload)),
    request: (type, payload) =>
      new Promise((resolve) => {
        const req = makeEnvelope('req', type, payload)
        waiting.set(req.id, resolve)
        port?.postMessage(req)
      }),
    received: (type) => inbox.filter((m) => m.type === type).map((m) => m.payload),
    sync: async () => {
      // menu.open is H->G, so the game answers it on the same ordered port: everything sent before has arrived.
      await host.request('menu.open', {})
    },
  }
  return host
}
```

`spikes/s6-ruken/storage-suite.ts` (P01 §10.3: one Storage behaviour suite for every backend):
```ts
import { expect, test } from 'vitest'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'clear' | 'length'>

/** P01 §10.3: one behavioral suite, run against real localStorage and against saves.storage. */
export function storageSuite(name: string, make: () => Promise<StorageLike> | StorageLike): void {
  test(`${name}: get/set/overwrite/remove`, async () => {
    const s = await make()
    expect(s.getItem('k1')).toBeNull()
    s.setItem('k1', 'a')
    s.setItem('k1', 'b')
    expect(s.getItem('k1')).toBe('b')
    s.removeItem('k1')
    expect(s.getItem('k1')).toBeNull()
    s.removeItem('missing') // no throw
  })
  test(`${name}: length, key(i) and clear`, async () => {
    const s = await make()
    s.setItem('a', '1')
    s.setItem('b', '2')
    expect(s.length).toBe(2)
    const keys = [s.key(0), s.key(1)].sort()
    expect(keys).toEqual(['a', 'b'])
    expect(s.key(2)).toBeNull()
    s.clear()
    expect(s.length).toBe(0)
  })
  test(`${name}: values are strings`, async () => {
    const s = await make()
    s.setItem('n', 42 as unknown as string)
    expect(s.getItem('n')).toBe('42')
  })
}
```

`spikes/s6-ruken/storage-dom.node.test.ts` (runs the suite against real jsdom `localStorage`, the reference):
```ts
// @vitest-environment jsdom
import { storageSuite } from './storage-suite'

storageSuite('jsdom localStorage (reference)', () => {
  window.localStorage.clear()
  return window.localStorage
})
```

`spikes/s6-ruken/handshake.node.test.ts`:
```ts
import { afterEach, expect, test, vi } from 'vitest'
import { createFakeFrame, createMockHost } from './mock-host'
import { makeEnvelope } from './protocol'
import { initRuken } from './sdk-stub'

afterEach(() => {
  vi.useRealTimers()
})

const OPTS = {
  gameId: 'blank-game',
  wants: ['saves', 'menu'] as const,
  pauseBehavior: 'pause' as const,
  onMenuRequest: () => true,
}
const PROD = { gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' }

test('hosted: hello -> welcome over a MessagePort; ready only after session.ready (R-04)', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ['lifecycle', 'saves', 'menu'], saves: { slot1: 'abc' } })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  expect(ruken.hosted).toBe(true)
  expect(ruken.granted.has('saves')).toBe(true)
  expect(ruken.saves.storage.getItem('slot1')).toBe('abc')
  let ready = false
  void ruken.ready.then(() => {
    ready = true
  })
  await host.sync()
  expect(ready).toBe(false)
  host.sendEvt('session.ready', {})
  await ruken.ready
  expect(ready).toBe(true)
})

test('welcome from a non-allowlisted origin is ignored; standalone after 10 s of hello every 250 ms', async () => {
  vi.useFakeTimers()
  const frame = createFakeFrame({ ...PROD, hostOrigin: 'https://evilruken.com' })
  createMockHost({ frame, offered: ['lifecycle'], saves: {} })
  const p = initRuken(OPTS, frame.gameEnv)
  await vi.advanceTimersByTimeAsync(10_000)
  const ruken = await p
  expect(ruken.hosted).toBe(false)
  expect(frame.helloCount()).toBeGreaterThanOrEqual(40)
})

test('forged welcome (allowlisted origin, wrong source: the game posting to itself) is ignored', async () => {
  vi.useFakeTimers()
  const frame = createFakeFrame({ gameOrigin: 'http://localhost:4400', hostOrigin: null })
  // Make it framed, but with no host answering.
  frame.gameEnv.isTopLevel = false
  frame.gameEnv.parent = frame.parentWindow
  const p = initRuken(OPTS, frame.gameEnv)
  const { port2 } = new MessageChannel()
  frame.deliverToGame({
    data: makeEnvelope('evt', 'welcome', {}),
    origin: 'http://localhost:4400',
    source: frame.selfWindow,
    ports: [port2],
  })
  await vi.advanceTimersByTimeAsync(10_000)
  expect((await p).hosted).toBe(false)
})

test('a second welcome is ignored', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ['saves'], saves: { a: 'first' } })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  const { port2 } = new MessageChannel()
  frame.deliverToGame({
    data: makeEnvelope('evt', 'welcome', { saves: { snapshot: { a: 'second' }, status: 'saved' } }),
    origin: 'https://ruken.com',
    source: frame.parentWindow,
    ports: [port2],
  })
  await host.sync()
  expect(ruken.saves.storage.getItem('a')).toBe('first')
})

test('standalone when top-level: saves go to localStorage under ruken:<gameId>:, ready resolves at once', async () => {
  const frame = createFakeFrame({ gameOrigin: 'http://localhost:5173', hostOrigin: null })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  expect(ruken.hosted).toBe(false)
  ruken.saves.storage.setItem('slot1', 'xyz')
  expect(frame.storage.get('ruken:blank-game:slot1')).toBe('xyz')
  await ruken.ready
})

test('lifecycle.changed reaches the game; menu.open is answered via onMenuRequest', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ['lifecycle', 'menu'], saves: {} })
  const onMenu = vi.fn(() => true)
  const ruken = await initRuken({ ...OPTS, onMenuRequest: onMenu }, frame.gameEnv)
  const states: string[] = []
  ruken.lifecycle.on('change', (e) => states.push(e.state))
  host.sendEvt('lifecycle.changed', { state: 'background', reasons: ['host-overlay'] })
  const res = await host.request('menu.open', {})
  expect(states).toEqual(['background'])
  expect(ruken.lifecycle.state).toBe('background')
  expect(onMenu).toHaveBeenCalledOnce()
  expect(res.payload).toEqual({ opened: true })
})

test('entitlements.changed updates entitlements (store items / subscriptions)', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ['entitlements'], saves: {} })
  const ruken = await initRuken({ ...OPTS, wants: ['entitlements'] }, frame.gameEnv)
  const seen: string[][] = []
  ruken.onEntitlements((e) => seen.push(e.items))
  host.sendEvt('entitlements.changed', {
    ads: false,
    items: ['stage-pack-1'],
    subscriptions: [],
    devBuild: true,
  })
  await host.sync()
  expect(ruken.entitlements.items).toEqual(['stage-pack-1'])
  expect(seen).toEqual([['stage-pack-1']])
})
```

`spikes/s6-ruken/requests.node.test.ts`:
```ts
import { afterEach, expect, test, vi } from 'vitest'
import { createFakeFrame, createMockHost } from './mock-host'
import { RukenError } from './protocol'
import { initRuken } from './sdk-stub'

afterEach(() => {
  vi.useRealTimers()
})

const OPTS = {
  gameId: 'g',
  wants: ['saves', 'menu', 'links'] as const,
  pauseBehavior: 'pause' as const,
  onMenuRequest: () => true,
}
const PROD = { gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' }

test('an error res rejects with RukenError carrying code and retryable', async () => {
  const frame = createFakeFrame(PROD)
  createMockHost({
    frame,
    offered: ['saves'],
    saves: {},
    respond: { 'saves.flush': { error: 'OFFLINE', retryable: true } },
  })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  const err = await ruken.saves.flush().catch((e: unknown) => e)
  expect(err).toBeInstanceOf(RukenError)
  expect((err as RukenError).code).toBe('OFFLINE')
  expect((err as RukenError).retryable).toBe(true)
})

test('a request with no answer rejects with TIMEOUT after the catalog timeout (saves.flush = 5 s)', async () => {
  const frame = createFakeFrame(PROD)
  createMockHost({ frame, offered: ['saves'], saves: {}, respond: { 'saves.flush': 'silent' } })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  vi.useFakeTimers()
  const p = ruken.saves.flush().catch((e: unknown) => e)
  await vi.advanceTimersByTimeAsync(4_999)
  let settled = false
  void p.then(() => {
    settled = true
  })
  await Promise.resolve()
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  const err = await p
  expect((err as RukenError).code).toBe('TIMEOUT')
})

test('a late response after TIMEOUT is dropped (no crash, no double settle)', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ['saves'], saves: {}, respond: { 'saves.flush': 'late' } })
  const ruken = await initRuken(OPTS, frame.gameEnv)
  vi.useFakeTimers()
  const p = ruken.saves.flush().catch((e: unknown) => e)
  await vi.advanceTimersByTimeAsync(6_000)
  expect(((await p) as RukenError).code).toBe('TIMEOUT')
  vi.useRealTimers()
  await host.sync()
  expect(host.received('saves.flush').length).toBe(1)
})

test('an unknown H->G request gets UNSUPPORTED; an unknown evt is ignored (P01 §5)', async () => {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: [], saves: {} })
  await initRuken(OPTS, frame.gameEnv)
  host.sendEvt('future.thing', { x: 1 })
  const res = await host.request('future.query', {})
  expect(res.error?.code).toBe('UNSUPPORTED')
})
```

`spikes/s6-ruken/saves.node.test.ts`:
```ts
import { expect, test } from 'vitest'
import { createFakeFrame, createMockHost } from './mock-host'
import { type Capability, RukenError } from './protocol'
import { initRuken } from './sdk-stub'
import { storageSuite } from './storage-suite'

const PROD = { gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' }

async function hostedRuken(offered: Capability[] = ['saves']) {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered, saves: {} })
  const ruken = await initRuken(
    { gameId: 'g', wants: ['saves'], pauseBehavior: 'pause', onMenuRequest: () => true },
    frame.gameEnv,
  )
  return { ruken, host }
}

storageSuite('saves.storage (hosted)', async () => (await hostedRuken()).ruken.saves.storage)
storageSuite('saves.storage (standalone)', async () => {
  const frame = createFakeFrame({ gameOrigin: 'http://localhost:5173', hostOrigin: null })
  const ruken = await initRuken(
    { gameId: 'g', wants: [], pauseBehavior: 'pause', onMenuRequest: () => true },
    frame.gameEnv,
  )
  return ruken.saves.storage
})

test('setItem is synchronous and emits saves.set with unique writeIds; flush resolves', async () => {
  const { ruken, host } = await hostedRuken()
  ruken.saves.storage.setItem('slot.1', 'data')
  ruken.saves.storage.setItem('slot.1', 'data2')
  expect(ruken.saves.storage.getItem('slot.1')).toBe('data2') // synchronous cache
  expect(await ruken.saves.flush()).toEqual({ persisted: 'host-outbox' })
  const sets = host.received('saves.set') as Array<{ key: string; value: string; writeId: string }>
  expect(sets.map((s) => s.value)).toEqual(['data', 'data2'])
  expect(new Set(sets.map((s) => s.writeId)).size).toBe(2)
})

test('limits throw QuotaExceededError: bad key, > 1 MB value, > 256 keys, > 10 MB total', async () => {
  const { ruken } = await hostedRuken()
  const s = ruken.saves.storage
  const quota = (fn: () => void) => {
    try {
      fn()
    } catch (e) {
      return (e as RukenError).name === 'QuotaExceededError'
    }
    return false
  }
  expect(quota(() => s.setItem('bad key!', 'x'))).toBe(true)
  expect(quota(() => s.setItem('big', 'x'.repeat(1_048_577)))).toBe(true)
  const oneMB = 'x'.repeat(1_048_576) // exactly the per-key limit, which is allowed
  for (let i = 0; i < 9; i++) s.setItem(`chunk${i}`, oneMB)
  expect(quota(() => s.setItem('chunk9', oneMB))).toBe(true) // 10 x (1 MB + key bytes) > 10 MB
  s.clear()
  for (let i = 0; i < 256; i++) s.setItem(`k${i}`, '1')
  expect(quota(() => s.setItem('k256', '1'))).toBe(true)
  s.setItem('k0', 'overwrite is fine at the cap')
})

test('saves.status and saves.changed update the game', async () => {
  const { ruken, host } = await hostedRuken()
  expect(ruken.saves.status).toBe('saved')
  const statuses: string[] = []
  ruken.saves.on('status', (st) => statuses.push(st))
  host.sendEvt('saves.status', { state: 'offline-queued' })
  host.sendEvt('saves.changed', { key: 'slot1', value: 'from-other-device', revision: 7 })
  await host.sync()
  expect(statuses).toEqual(['offline-queued'])
  expect(ruken.saves.storage.getItem('slot1')).toBe('from-other-device')
})

test('writes are DENIED when the saves capability was not granted', async () => {
  const { ruken } = await hostedRuken([])
  expect(() => ruken.saves.storage.setItem('a', '1')).toThrow(RukenError)
})
```

`spikes/s6-ruken/catalog.node.test.ts` (tests generated from `CATALOG`):
```ts
import { expect, test } from 'vitest'
import { createFakeFrame, createMockHost } from './mock-host'
import { CATALOG, type Capability, catalogRow } from './protocol'
import { initRuken } from './sdk-stub'

const PROD = { gameOrigin: 'https://g-x.rukengames.com', hostOrigin: 'https://ruken.com' }
const ALL: Capability[] = [
  'lifecycle',
  'input',
  'display',
  'audio',
  'exit',
  'menu',
  'saves',
  'leaderboards',
  'entitlements',
  'store',
  'ads',
  'telemetry',
  'analytics.custom',
  'links',
]

async function session() {
  const frame = createFakeFrame(PROD)
  const host = createMockHost({ frame, offered: ALL, saves: {} })
  const ruken = await initRuken(
    { gameId: 'g', wants: ALL, pauseBehavior: 'pause', onMenuRequest: () => true },
    frame.gameEnv,
  )
  return { ruken, host }
}

// Generated from the P01 §7 catalog: every host->game event is accepted without the game answering it.
test.each(CATALOG.filter((r) => r.dir === 'H→G' && r.kind === 'evt' && r.type !== 'welcome'))(
  'H->G evt $type is consumed without a response',
  async (row) => {
    const { host } = await session()
    host.sendEvt(row.type, {})
    await host.sync()
    expect(host.inbox.filter((m) => m.kind === 'res' && m.type === row.type)).toEqual([])
  },
)

// Every host->game request gets exactly one res with the matching `re`.
test.each(CATALOG.filter((r) => r.dir === 'H→G' && r.kind === 'req'))(
  'H->G req $type gets one matching res',
  async (row) => {
    const { host } = await session()
    const res = await host.request(row.type, {})
    expect(res.kind).toBe('res')
    expect(host.inbox.filter((m) => m.re === res.re).length).toBe(1)
  },
)

// Everything the game sends in a scripted session has the kind and direction the catalog says.
test('every game->host message in a session matches its catalog kind and direction', async () => {
  const { ruken, host } = await session()
  ruken.saves.storage.setItem('a', '1')
  ruken.saves.storage.removeItem('a')
  await ruken.saves.flush()
  await ruken.request('links.open', { url: 'https://example.com' })
  const sent = host.inbox.filter((m) => m.kind !== 'res')
  expect(sent.length).toBeGreaterThanOrEqual(4)
  for (const m of sent) {
    const row = catalogRow(m.type)
    expect(row, m.type).toBeDefined()
    expect(row?.dir).toBe('G→H')
    expect(row?.kind).toBe(m.kind)
  }
})

test('the game refuses to send a request that is not a G->H req in the catalog', async () => {
  const { ruken } = await session()
  await expect(ruken.request('menu.open', {})).rejects.toMatchObject({ code: 'UNSUPPORTED' })
})
```

Run: `pnpm --filter @spikes/all exec vitest run --project node s6-ruken`
Expected: the allowlist and `storage-dom` suites PASS. Every other suite FAILs because `./sdk-stub` can't be resolved.

- [ ] **Step 5: Implement the saves storage and the stub**

`spikes/s6-ruken/saves-storage.ts`:
```ts
import { RukenError } from './protocol'

// P01 §7 Rules / Saves: string values; 1 MB per key (UTF-8 bytes), 10 MB per game, <= 256 keys; key regex.
export const KEY_RE = /^[A-Za-z0-9._:-]{1,128}$/
export const MAX_VALUE_BYTES = 1_048_576
export const MAX_TOTAL_BYTES = 10 * 1_048_576 // counts key + value bytes (counting rule is on the P01 gap list)
export const MAX_KEYS = 256

const utf8 = (s: string) => new TextEncoder().encode(s).length

/** Backing store for the Storage-like facade: a Map (hosted cache) or prefixed localStorage (standalone). */
export type Backing = {
  get(k: string): string | null
  set(k: string, v: string): void
  delete(k: string): void
  keys(): string[] // sorted, so key(i) is stable
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'clear' | 'length'>

/** Storage semantics + P01 limits. `onWrite` fires after a successful local write (hosted: emit saves.set/remove). */
export function createStorage(
  backing: Backing,
  onWrite: (op: { kind: 'set'; key: string; value: string } | { kind: 'remove'; key: string }) => void,
  guard: () => void = () => {},
): StorageLike {
  const total = () => backing.keys().reduce((n, k) => n + utf8(k) + utf8(backing.get(k) ?? ''), 0)
  return {
    getItem: (k) => backing.get(k),
    setItem(k, v) {
      guard()
      const value = String(v)
      if (!KEY_RE.test(k)) throw new RukenError('QUOTA_EXCEEDED', `invalid key "${k}"`)
      if (utf8(value) > MAX_VALUE_BYTES)
        throw new RukenError('QUOTA_EXCEEDED', `value for "${k}" exceeds 1 MB`)
      const existing = backing.get(k)
      if (existing === null && backing.keys().length >= MAX_KEYS)
        throw new RukenError('QUOTA_EXCEEDED', 'more than 256 keys')
      const after = total() - (existing === null ? 0 : utf8(k) + utf8(existing)) + utf8(k) + utf8(value)
      if (after > MAX_TOTAL_BYTES) throw new RukenError('QUOTA_EXCEEDED', 'game saves exceed 10 MB')
      backing.set(k, value)
      onWrite({ kind: 'set', key: k, value })
    },
    removeItem(k) {
      guard()
      if (backing.get(k) === null) return
      backing.delete(k)
      onWrite({ kind: 'remove', key: k })
    },
    key: (i) => backing.keys()[i] ?? null,
    clear() {
      guard()
      for (const k of backing.keys()) {
        backing.delete(k)
        onWrite({ kind: 'remove', key: k })
      }
    },
    get length() {
      return backing.keys().length
    },
  }
}
```

`spikes/s6-ruken/sdk-stub.ts`:
```ts
import { isAllowedHostOrigin } from './allowlist'
import {
  type Capability,
  catalogRow,
  type Entitlements,
  type Envelope,
  isEnvelope,
  makeEnvelope,
  type RukenEnv,
  RukenError,
  type WelcomePayload,
} from './protocol'
import { type Backing, createStorage, type StorageLike } from './saves-storage'

export type InitOptions = {
  gameId: string
  wants: readonly Capability[]
  pauseBehavior: 'pause' | 'continue'
  onMenuRequest: () => boolean
}

type LifecycleEvent = { state: 'active' | 'background'; reasons: string[] }
type SavesChanged = { key: string; value: string | null; revision: number }

export type RukenStub = {
  hosted: boolean
  ready: Promise<void>
  granted: ReadonlySet<Capability>
  player: { id: string; displayName: string }
  readonly entitlements: Entitlements
  onEntitlements(fn: (e: Entitlements) => void): () => void
  lifecycle: {
    readonly state: LifecycleEvent['state']
    on(e: 'change', fn: (e: LifecycleEvent) => void): () => void
  }
  saves: {
    storage: StorageLike
    readonly status: string
    on(e: 'status', fn: (s: string) => void): () => void
    onChanged(fn: (c: SavesChanged) => void): () => void
    flush(): Promise<unknown>
  }
  request(type: string, payload: unknown): Promise<unknown>
}

const NO_ENTITLEMENTS: Entitlements = { ads: false, items: [], subscriptions: [], devBuild: false }

export async function initRuken(opts: InitOptions, env: RukenEnv): Promise<RukenStub> {
  const welcome = env.isTopLevel ? null : await handshake(opts, env)
  return welcome ? hosted(opts, env, welcome.payload, welcome.port) : standalone(opts, env)
}

function standalone(opts: InitOptions, env: RukenEnv): RukenStub {
  const prefix = `ruken:${opts.gameId}:`
  const backing: Backing = {
    get: (k) => env.localStorage.getItem(prefix + k),
    set: (k, v) => env.localStorage.setItem(prefix + k, v),
    delete: (k) => env.localStorage.removeItem(prefix + k),
    keys: () => {
      const out: string[] = []
      for (let i = 0; i < env.localStorage.length; i++) {
        const k = env.localStorage.key(i)
        if (k?.startsWith(prefix)) out.push(k.slice(prefix.length))
      }
      return out.sort()
    },
  }
  return {
    hosted: false,
    ready: Promise.resolve(), // standalone: session.ready resolves immediately (P01 §4)
    granted: new Set(),
    player: { id: 'local', displayName: 'Player' },
    entitlements: NO_ENTITLEMENTS,
    onEntitlements: () => () => {},
    lifecycle: { state: 'active', on: () => () => {} },
    saves: {
      storage: createStorage(backing, () => {}),
      status: 'saved',
      on: () => () => {},
      onChanged: () => () => {},
      flush: async () => ({ persisted: 'host-outbox' }),
    },
    request: async (type) => {
      throw new RukenError('UNSUPPORTED', `${type} is unavailable standalone`)
    },
  }
}

function hosted(opts: InitOptions, env: RukenEnv, welcome: WelcomePayload, port: MessagePort): RukenStub {
  const granted = new Set<Capability>(welcome.granted)
  const pending = new Map<
    string,
    { resolve: (p: unknown) => void; reject: (e: Error) => void; timer: unknown }
  >()
  const lifecycleListeners = new Set<(e: LifecycleEvent) => void>()
  const statusListeners = new Set<(s: string) => void>()
  const changedListeners = new Set<(c: SavesChanged) => void>()
  const entitlementListeners = new Set<(e: Entitlements) => void>()
  const cache = new Map<string, string>(Object.entries(welcome.saves.snapshot))
  let lifecycleState: LifecycleEvent['state'] = 'active'
  let savesStatus = welcome.saves.status
  let entitlements = welcome.entitlements
  let writeSeq = 0
  let resolveReady: () => void = () => {}
  const ready = new Promise<void>((r) => {
    resolveReady = r
  })

  const send = (env: Envelope) => port.postMessage(env)

  port.addEventListener('message', (ev: MessageEvent) => {
    const msg = ev.data as unknown
    if (!isEnvelope(msg)) return
    if (msg.kind === 'res') {
      const p = msg.re ? pending.get(msg.re) : undefined
      if (!p) return // unknown or late (already timed out): dropped (P01 §5)
      pending.delete(msg.re as string)
      env.clearTimeout(p.timer)
      if (msg.error) p.reject(new RukenError(msg.error.code, msg.error.message, msg.error.retryable))
      else p.resolve(msg.payload)
      return
    }
    if (msg.kind === 'req') {
      if (msg.type === 'menu.open') {
        send(makeEnvelope('res', 'menu.open', { opened: opts.onMenuRequest() !== false }, msg.id))
      } else {
        send({
          ...makeEnvelope('res', msg.type, undefined, msg.id),
          error: { code: 'UNSUPPORTED', message: msg.type, retryable: false },
        })
      }
      return
    }
    switch (msg.type) {
      case 'session.ready':
        resolveReady()
        break
      case 'lifecycle.changed': {
        const e = msg.payload as LifecycleEvent
        lifecycleState = e.state
        for (const l of lifecycleListeners) l(e)
        break
      }
      case 'saves.status':
        savesStatus = (msg.payload as { state: string }).state
        for (const l of statusListeners) l(savesStatus)
        break
      case 'saves.changed': {
        const c = msg.payload as SavesChanged
        if (c.value === null) cache.delete(c.key)
        else cache.set(c.key, c.value)
        for (const l of changedListeners) l(c)
        break
      }
      case 'entitlements.changed':
        entitlements = msg.payload as Entitlements
        for (const l of entitlementListeners) l(entitlements)
        break
      default:
        break // unknown or not-yet-implemented evt: ignored (P01 §5)
    }
  })
  port.start()

  function request(type: string, payload: unknown): Promise<unknown> {
    const row = catalogRow(type)
    if (row?.kind !== 'req' || row.dir !== 'G→H') return Promise.reject(new RukenError('UNSUPPORTED', type))
    const req = makeEnvelope('req', type, payload)
    return new Promise((resolve, reject) => {
      const timer = env.setTimeout(() => {
        pending.delete(req.id)
        reject(new RukenError('TIMEOUT', `${type} after ${row.timeoutMs} ms`, true))
      }, row.timeoutMs ?? 5_000)
      pending.set(req.id, { resolve, reject, timer })
      send(req)
    })
  }

  const backing: Backing = {
    get: (k) => cache.get(k) ?? null,
    set: (k, v) => void cache.set(k, v),
    delete: (k) => void cache.delete(k),
    keys: () => [...cache.keys()].sort(),
  }
  const storage = createStorage(
    backing,
    (op) => {
      writeSeq += 1
      const writeId = `${opts.gameId}-w${writeSeq}` // unique per session; uniqueness scope is a P01 gap item
      if (op.kind === 'set')
        send(makeEnvelope('evt', 'saves.set', { key: op.key, value: op.value, baseRevision: null, writeId }))
      else send(makeEnvelope('evt', 'saves.remove', { key: op.key, baseRevision: null, writeId }))
    },
    () => {
      if (!granted.has('saves')) throw new RukenError('DENIED', 'saves capability not granted')
    },
  )

  return {
    hosted: true,
    ready,
    granted,
    player: welcome.player,
    get entitlements() {
      return entitlements
    },
    onEntitlements: (fn) => {
      entitlementListeners.add(fn)
      return () => entitlementListeners.delete(fn)
    },
    lifecycle: {
      get state() {
        return lifecycleState
      },
      on: (_e, fn) => {
        lifecycleListeners.add(fn)
        return () => lifecycleListeners.delete(fn)
      },
    },
    saves: {
      storage,
      get status() {
        return savesStatus
      },
      on: (_e, fn) => {
        statusListeners.add(fn)
        return () => statusListeners.delete(fn)
      },
      onChanged: (fn) => {
        changedListeners.add(fn)
        return () => changedListeners.delete(fn)
      },
      flush: () => request('saves.flush', {}),
    },
    request,
  }
}

function handshake(
  opts: InitOptions,
  env: RukenEnv,
): Promise<{ payload: WelcomePayload; port: MessagePort } | null> {
  return new Promise((resolve) => {
    const hello = makeEnvelope('evt', 'hello', {
      sdkVersion: '0.0.0-spike',
      proto: { min: '1.0', max: '1.x' },
      gameId: opts.gameId,
      wants: [...opts.wants],
      pauseBehavior: opts.pauseBehavior,
      menu: true,
    })
    let done = false
    let retry: unknown
    const finish = (v: { payload: WelcomePayload; port: MessagePort } | null) => {
      if (done) return // a second welcome is ignored (P01 §4)
      done = true
      env.clearTimeout(retry)
      env.clearTimeout(giveUp)
      off()
      resolve(v)
    }
    const off = env.addMessageListener((ev) => {
      if (!isEnvelope(ev.data) || ev.data.type !== 'welcome') return
      if (ev.source !== env.parent) return // forged welcome (e.g. a game posting to itself): ignored
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

Run: `pnpm --filter @spikes/all exec vitest run --project node s6-ruken`
Expected: `Tests 62 passed (62)`.

- [ ] **Step 6: Write the real two-origin check (host on 127.0.0.1, game iframe on localhost)**

`spikes/s6-ruken/dom-env.ts`:
```ts
import type { RukenEnv } from './protocol'

/** RukenEnv backed by the real window (used by the two-origin browser check). */
export function domEnv(): RukenEnv {
  return {
    isTopLevel: window.parent === window,
    parent: window.parent,
    gameOrigin: location.origin,
    postToParent: (msg) => window.parent.postMessage(msg, '*'),
    addMessageListener: (fn) => {
      const handler = (ev: MessageEvent) =>
        fn({ data: ev.data, origin: ev.origin, source: ev.source, ports: [...ev.ports] })
      window.addEventListener('message', handler)
      return () => window.removeEventListener('message', handler)
    },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id as number),
    localStorage: window.localStorage,
  }
}
```

`spikes/s6-ruken/game.html`:
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8" /></head><body>
<script type="module" src="./game.ts"></script></body></html>
```

`spikes/s6-ruken/game.ts`:
```ts
import { domEnv } from './dom-env'
import { initRuken } from './sdk-stub'

// Runs inside the iframe on http://localhost:<port>. Reports back only through the protocol itself.
const ruken = await initRuken(
  { gameId: 'blank-game', wants: ['saves'], pauseBehavior: 'pause', onMenuRequest: () => true },
  domEnv(),
)
const t0 = performance.now()
await ruken.ready // a real game starts rendering only after this (R-04)
const report = {
  hosted: ruken.hosted,
  granted: [...ruken.granted],
  waitedMs: Math.round(performance.now() - t0),
}
ruken.saves.storage.setItem('probe', JSON.stringify(report))
await ruken.saves.flush()
```

`spikes/s6-ruken/host.html`:
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8" /></head><body><canvas width="8" height="8"></canvas>
<script type="module" src="./host.ts"></script></body></html>
```

`spikes/s6-ruken/host.ts`:
```ts
import { baseWelcome } from './mock-host'
import { isEnvelope, makeEnvelope } from './protocol'

// Served on http://127.0.0.1:<port>; the game iframe is http://localhost:<port> (a different origin).
const gameOrigin = `http://localhost:${location.port}`
const iframe = document.createElement('iframe')
iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock')
iframe.src = `${gameOrigin}${location.pathname.replace('host.html', 'game.html')}`
document.body.append(iframe)

const out: Record<string, unknown> = { ok: false, hellos: 0, droppedWrongSource: 0 }
const finish = () => {
  ;(window as unknown as { __result: unknown }).__result = out
}
let port: MessagePort | undefined
let readyAt = 0

window.addEventListener('message', (ev) => {
  if (!isEnvelope(ev.data) || ev.data.type !== 'hello') return
  if (ev.source !== iframe.contentWindow || ev.origin !== gameOrigin) {
    out.droppedWrongSource = (out.droppedWrongSource as number) + 1
    return
  }
  out.hellos = (out.hellos as number) + 1
  if (port) return
  const channel = new MessageChannel()
  port = channel.port1
  port.onmessage = (e: MessageEvent) => {
    const msg = e.data as unknown
    if (!isEnvelope(msg)) return
    if (msg.type === 'saves.set') {
      const v = JSON.parse((msg.payload as { value: string }).value) as { hosted: boolean; waitedMs: number }
      out.game = v
      out.ok = v.hosted === true && v.waitedMs >= readyAt - 50 // the game waited for session.ready
    }
    if (msg.type === 'saves.flush' && msg.kind === 'req') {
      port?.postMessage(makeEnvelope('res', 'saves.flush', { persisted: 'host-outbox' }, msg.id))
      finish()
    }
  }
  iframe.contentWindow?.postMessage(makeEnvelope('evt', 'welcome', baseWelcome(['saves'], {})), gameOrigin, [
    channel.port2,
  ])
  readyAt = 300
  setTimeout(() => port?.postMessage(makeEnvelope('evt', 'session.ready', {})), readyAt)
})
setTimeout(finish, 15_000)
```

Run:
```bash
for b in chromium webkit firefox; do node spikes/shared/run-page.ts --page s6-ruken/host.html --also s6-ruken/game.html --origin-host 127.0.0.1 --browser $b; echo "$b exit=$?"; done
```
Expected: each run reports `"ok": true`, `"hellos": 1`, `"droppedWrongSource": 0`, `"hosted": true` and `"waitedMs": ~300` (the game waited for `session.ready`), then `exit=0`.

- [ ] **Step 7: Write the verdict, including the P01 gap list for Ruken**

`docs/spikes/s6-ruken-stub.md`:
```markdown
# S6: Ruken SDK stub (P01 v1.0, as of 2026-10-01)

## Covered (asserted)
- Handshake: hello retry (250 ms, 10 s give-up); welcome origin allowlist (P01 §4/§10 table); `event.source` check (forged self-welcome ignored); second welcome ignored.
- Transport: MessagePort, both Node and real DOM across two origins.
- Session: `session.ready` gating.
- Messages: `lifecycle.changed`; `menu.open` req/res; `entitlements.changed` (store items).
- Saves:
  - set, remove, flush, status and changed;
  - the Storage behaviour suite against jsdom `localStorage` and both stub backends;
  - limits (key regex, 1 MB, 10 MB, 256 keys);
  - unique writeIds;
  - writes DENIED without the `saves` capability.
- Errors: error responses become `RukenError {code, retryable}`; catalog timeouts give `TIMEOUT`; late responses are dropped; unknown requests get `UNSUPPORTED`; unknown events are ignored.
- Catalog: tests are generated from the P01 §7 catalog for every host→game message and every game→host message sent.

## Not covered (stub only)
display/audio/input event handling, leaderboards, store.purchase/manage UI flows, ads, analytics, links UI, exit/exiting, host.summon, telemetry, version negotiation.

## P01 gaps and questions to send to Ruken before F1 (2026-10-16)
1. **Forged welcome on local origins.** Rule 3 accepts a `localhost` host for a local game, so a game posting a `welcome` to itself passes the origin check. Only `event.source === parent` stops it. Should P01 require the source check explicitly in §4, not just in the §10 e2e list?
2. **10 MB per game:** are key bytes counted as well as value bytes? Is the limit UTF-8 bytes or UTF-16 length?
3. **Saves without the capability:** if `saves` is not granted, should `storage` throw (`DENIED`), fall back to memory, or fall back to local?
4. **Revisions:** `welcome.saves.snapshot` carries no revisions, yet `saves.set.baseRevision` expects one. Where does the game get it?
5. **Snapshot size:** `welcome.saves.snapshot` can be up to 10 MB in one postMessage. Is that intended, or should it be chunked or lazy?
6. **Timing:** can `menu.open` arrive before `session.ready`, and what should the game answer?
7. **`pauseBehavior`:** can it change at runtime (single-player menu vs online match)? Today it is declared only in `hello`.
8. **`display.metrics.scale` (1 | 1.333):** what does it mean for the game's UI scale?
9. **`saves.set.writeId`:** what format, and what uniqueness scope (per session, or across reloads)?
10. **Spec churn:** `dlc` → `store` changed on 2026-10-01. Please confirm the catalog is final at F1.
11. [anything else found while implementing]

## Verdict
The stub is [usable] as the A2 Ruken-adapter target behind `Hosting`. Contract tests to carry into `automata-host`: allowlist, handshake, requests, saves, the Storage suite, and the catalog generator.
```

- [ ] **Step 8: Typecheck, format and commit**

```bash
pnpm --filter @spikes/all typecheck && pnpm format && pnpm lint
git add spikes/s6-ruken docs/spikes/s6-ruken-stub.md spikes/package.json pnpm-lock.yaml
git commit -m "spike(s6): Ruken P01 SDK stub — catalog-driven contract tests, two-origin check, P01 gap list"
```

---

### Task 9: Close A0 (verdict index, ADR, delete spikes)

**Files:**
- Create: `docs/spikes/README.md`, `docs/adr/0001-ecs-choice.md`
- Modify: `docs/superpowers/specs/2026-10-01-a0-a1-spikes-foundation-design.md` (the status line, plus a new §11)
- Modify: `pnpm-workspace.yaml` (remove `- spikes`)
- Delete: `spikes/`

**Interfaces:**
- Consumes: all six verdicts.
- Produces the inputs Plan 2 is written from: the ECS choice and ordering rule, the snapshot encoding, the render-delta rule after a restore, the `Math.*` allowlist, and the Ruken stub contract.

- [ ] **Step 1: Run everything one last time**

Run:
```bash
pnpm --filter @spikes/all typecheck && pnpm lint
pnpm --filter @spikes/all exec vitest run
```
Expected: the results **match what the verdicts say**. Pre-run: `Test Files 37 passed (37)` and `Tests 123 passed (123)`. A failure is fine only if a verdict already documents it. Paste the summary line into the README below.

- [ ] **Step 2: Write the verdict index**

`docs/spikes/README.md`:
```markdown
# A0 Spike Verdicts

| Spike | Verdict | Blocks A1? | Key consequence |
|---|---|---|---|
| [S1 Koota](./s1-koota.md) | [ ] | yes | [ECS choice; iterate in StableId order; full resync after restore] |
| [S2 Rapier](./s2-rapier.md) | [ ] | yes | [snapshot bytes in sim.hash; package choice] |
| [S3 Three](./s3-three.md) | [ ] | no (A2/A4) | [ ] |
| [S4 Pixi](./s4-pixi.md) | [ ] | no (A2/A4) | [vertex-stage pixel coords for screen-space effects] |
| [S5 Math](./s5-math.md) | [ ] | yes | [Math.* allowlist] |
| [S6 Ruken stub](./s6-ruken-stub.md) | [ ] | no (A2) | [P01 gap list sent to Ruken on <date>] |

Final suite run (YYYY-MM-DD): [paste the summary line].
```

- [ ] **Step 3: Write ADR 0001**

`docs/adr/0001-ecs-choice.md`:
```markdown
# ADR 0001: ECS for automata-sim

- Status: Accepted
- Date: [date]

## Context
The overview spec §8 picked Koota, pending S1. The sim must be deterministic across engines and must snapshot and restore.

## Decision
[Koota 0.6.6 | Miniplex 2.0.0] behind the `automata-sim` facade. Game code never imports the ECS directly.

## Consequences
- Ordering: [rule from S1: e.g. "order-sensitive iteration uses StableId order via an incremental index"]
- IDs: the facade owns its own `StableId` counter (Koota recycles IDs).
- Relations: [encoding from S1]
- Change tracking: [rule after restore]
- Perf: [ms/tick native vs sorted at 4× throttle]
```

- [ ] **Step 4: Update the A0+A1 spec with the outcomes**

In `docs/superpowers/specs/2026-10-01-a0-a1-spikes-foundation-design.md`:
- Change the status line to `- **Status:** A0 complete <date>; A1 pending Plan 2`.
- Append:
```markdown
## 11. Spike outcomes (A0 closed)

See `docs/spikes/README.md`. Changes to A1 from the verdicts:
- [each consequence that changes §4–§6. For example:
  - "§4.4 rule 1: the facade iterates in StableId order everywhere; native order does not survive restore";
  - "§4.7: the first render delta after a restore is a full resync";
  - "§4.4 rule 3: the Math allowlist adds round and imul";
  - "§4.5: the Rapier snapshot bytes are hashed directly"]
```

- [ ] **Step 5: Delete the spikes in one commit**

Run:
```bash
git rm -r -q spikes
rm -rf spikes   # removes ignored leftovers too: spikes/out, spikes/node_modules
sed -i '' '/^  - spikes$/d' pnpm-workspace.yaml
pnpm install
pnpm lint
```
Expected: `pnpm install` succeeds with no `@spikes/all`, `ls spikes` fails with "No such file or directory", and lint exits 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs(a0): close spikes — verdict index, ADR 0001, spec outcomes; remove spikes/"
```

---

## Handoff to Plan 2

When Task 9 is committed, write `docs/superpowers/plans/<date>-a1-foundation-core.md` from spec §3.3–§8, `docs/spikes/README.md` and ADR 0001. Its scope:
- **`automata-sim`:** the facade with StableId ordering, scheduling, RNG, commands, events, resources, the physics plugins, snapshot v1, and the render delta (with a resync after restore).
- **`automata-content`.**
- **`automata-testing`:** the sim half.
- **`check-boundaries`**, using S5's allowlist.
- **`check-style`.**
- **`examples/blank-game`.**
- **Hosted CI**, with prerelease publishing.
