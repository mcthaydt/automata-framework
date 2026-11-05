import { describe, expect, it } from 'vitest'
import { scanForEval } from './no-eval-scan.ts'

// Bundles are written here as strings: a checked-in fixture with `eval` would fail `biome`'s noGlobalEval.

describe('scanForEval', () => {
  it('passes code that only looks like eval', () => {
    const clean = [
      // Effect's fiber primitives are objects with an `eval` method (seen in the base-2d build).
      'const Success = make({ op: `Success`, eval(e) { return e.next() } })',
      'Success.eval(fiber); obj["eval"](1)',
      'const message = "do not call eval( here"',
      'setTimeout(() => tick(), 16); setInterval(step, 100); window.setTimeout(run)',
      'if (r instanceof Function) r = r(1)',
      'const evaluate = (x) => x; evaluate("1+1")',
    ].join('\n')
    expect(scanForEval('assets/clean.js', clean)).toEqual([])
  })

  it('reports each dynamic-evaluation form with its line and column', () => {
    const dirty = [
      'eval("1+1")',
      '(0, eval)("2")',
      'globalThis.eval("3")',
      'new Function("a", "return a")',
      'Function("return this")()',
      'setTimeout("tick()", 10)',
      'window.setInterval(`step()`, 10)',
    ].join(';\n')
    expect(scanForEval('assets/dirty.js', dirty).map((f) => [f.line, f.col, f.rule])).toEqual([
      [1, 1, 'eval'],
      [2, 1, 'eval'],
      [3, 1, 'eval'],
      [4, 1, 'function-constructor'],
      [5, 1, 'function-constructor'],
      [6, 1, 'string-timer'],
      [7, 1, 'string-timer'],
    ])
    expect(scanForEval('assets/dirty.js', dirty)[0]).toMatchObject({ file: 'assets/dirty.js' })
  })

  it('allows the documented vendor probes inside try, and only there', () => {
    // pixi.js 8 `unsafeEvalSupported` and Zod 4 `allowsEval`, as Rolldown minified them in the base-2d build.
    const probes = [
      'function pe(){if(typeof k==`boolean`)return k;try{k=Function(`param1`,`param2`,`param3`,`return param1[param2] === param3;`)({a:`b`},`a`,`b`)===!0}catch{k=!1}return k}',
      'const ae=c(()=>{if(navigator?.userAgent?.includes(`Cloudflare`))return!1;try{return Function(``),!0}catch{return!1}})',
    ].join('\n')
    expect(scanForEval('assets/vendor.js', probes)).toEqual([])

    const unguarded = 'k=Function(`param1`,`param2`,`param3`,`return param1[param2] === param3;`)'
    expect(scanForEval('assets/vendor.js', unguarded).map((f) => f.rule)).toEqual(['function-constructor'])
    // Inside try, but not a documented probe.
    expect(scanForEval('assets/x.js', 'try{Function(`return 1`)}catch{}').map((f) => f.rule)).toEqual([
      'function-constructor',
    ])
  })

  it('allows the documented vendor code generators, which no-eval or AF never runs', () => {
    // pixi.js 8 generators that pixi.js/unsafe-eval replaces, and koota's SoA accessors (AF's traits are AoS).
    const generators = [
      'function a(n){return Function(`uv`,`data`,`dataInt32`,`offset`,n)}',
      'function b(c){return Function(`r`,`s`,`sD`,c)}',
      'function d(n){return Function(`ud`,`uv`,`renderer`,`syncData`,n.join(`\\n`))}',
      'function e(i){return Function(`ps`,`f32v`,`u32v`,i)}',
      'function f(t){return Function(`index`,`store`,`value`,`\\n `+t)}',
      'function g(t){return Function(`index`,`store`,`return `+t)}',
    ].join('\n')
    expect(scanForEval('assets/vendor.js', generators)).toEqual([])
    // The same body with other parameter names is not a vendor generator.
    expect(scanForEval('assets/x.js', 'Function(`a`,`b`,body)').map((f) => f.rule)).toEqual([
      'function-constructor',
    ])
  })

  it('reports a bundle it cannot parse instead of passing it', () => {
    expect(scanForEval('assets/broken.js', 'function (').map((f) => f.rule)).toEqual(['parse-error'])
  })
})
