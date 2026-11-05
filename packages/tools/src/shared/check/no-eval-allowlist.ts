// Dynamic-evaluation calls the `no-eval` step accepts in a game's bundle (DX spec §3.6: "any match outside an
// allowlisted, documented vendor location"). A minified bundle keeps no file names, but it keeps string
// literals, so an entry is matched by the `Function(...)` call's exact parameter-name literals and its body:
// an exact literal, or any expression for a code generator. A probe must also sit inside a `try` block.
//
// Each entry is code that compiles under Ruken's CSP but never runs in an AF game:
// - Pixi's and Zod's probes catch the CSP's EvalError and fall back;
// - Pixi's generators are replaced by `pixi.js/unsafe-eval`, which `no-eval` imports first (AGENTS.md);
// - Zod's JIT is off, because `no-eval` sets `jitless` (and Zod's own JIT reaches `Function` by an alias the
//   syntactic scan does not see);
// - koota builds its SoA accessors with `Function`, but AF's `defineComponent` makes AoS traits
//   (packages/sim/src/define/definitions.ts). A game that calls koota's `trait({ ... })` directly reaches them,
//   which this scan cannot tell apart: the `boundaries` step's `koota-soa` rule fails that call in the sim, and the
//   `csp` step fails it at runtime.
//
// Measured on the `examples/emberwick` production build at 71c3410: pixi.js 8.21.0, zod 4.6.5, koota 0.6.6; zod's probe
// matches unchanged in 4.6.6 (`automata check games/emberwick --csp` passes on it). The five pixi.js files are byte
// for byte the same in 8.22.0 and the same check passes on it (M3.2). A new entry needs the package,
// version, source location and why the call never runs under Ruken's CSP.

export interface AllowedEvalCall {
  readonly id: string
  /** The leading arguments: the generated function's parameter names, as string literals. */
  readonly params: readonly string[]
  /** The last argument: an exact string literal, or `dynamic` for a generator's computed body. */
  readonly body: string | { readonly dynamic: true }
  /** A probe is accepted only inside a `try` block. */
  readonly insideTry: boolean
  readonly vendor: string
  readonly reason: string
}

const DYNAMIC = { dynamic: true } as const

export const ALLOWED_EVAL_CALLS: readonly AllowedEvalCall[] = [
  {
    id: 'pixi-unsafe-eval-probe',
    params: ['param1', 'param2', 'param3'],
    body: 'return param1[param2] === param3;',
    insideTry: true,
    vendor: 'pixi.js 8.22.0 lib/utils/browser/unsafeEvalSupported.mjs',
    reason: 'probe; returns false under the CSP',
  },
  {
    id: 'zod-allows-eval-probe',
    params: [],
    body: '',
    insideTry: true,
    vendor: 'zod 4.6.6 v4/core/util.ts allowsEval',
    reason: 'probe; read only when jitless is off',
  },
  {
    id: 'pixi-ubo-sync',
    params: ['uv', 'data', 'dataInt32', 'offset'],
    body: DYNAMIC,
    insideTry: false,
    vendor: 'pixi.js 8.22.0 lib/rendering/renderers/shared/shader/utils/compileBufferSync.mjs',
    reason: 'replaced by pixi.js/unsafe-eval',
  },
  {
    id: 'pixi-shader-sync',
    params: ['r', 's', 'sD'],
    body: DYNAMIC,
    insideTry: false,
    vendor: 'pixi.js 8.22.0 lib/rendering/renderers/gl/shader/GenerateShaderSyncCode.mjs',
    reason: 'replaced by pixi.js/unsafe-eval',
  },
  {
    id: 'pixi-uniforms-sync',
    params: ['ud', 'uv', 'renderer', 'syncData'],
    body: DYNAMIC,
    insideTry: false,
    vendor: 'pixi.js 8.22.0 lib/rendering/renderers/gl/shader/utils/generateUniformsSync.mjs',
    reason: 'replaced by pixi.js/unsafe-eval',
  },
  {
    id: 'pixi-particle-update',
    params: ['ps', 'f32v', 'u32v'],
    body: DYNAMIC,
    insideTry: false,
    vendor: 'pixi.js 8.22.0 lib/scene/particle-container/shared/utils/generateParticleUpdateFunction.mjs',
    reason: 'replaced by pixi.js/unsafe-eval',
  },
  {
    id: 'koota-soa-set',
    params: ['index', 'store', 'value'],
    body: DYNAMIC,
    insideTry: false,
    vendor: 'koota 0.6.6 dist createSoASetFunction, createSoAFastSetFunction, createSoAFastSetChangeFunction',
    reason: 'SoA traits only; AF components are AoS',
  },
  {
    id: 'koota-soa-get',
    params: ['index', 'store'],
    body: DYNAMIC,
    insideTry: false,
    vendor: 'koota 0.6.6 dist createSoAGetFunction',
    reason: 'SoA traits only; AF components are AoS',
  },
]
