// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until the strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) replace each with a check
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CELL_TEMPLATE } from '#src/features/view/cell-template.ts'

/**
 * The painter's WGSL template for a depth-writing quad is a copy of `@pixi/3d`'s default material template with three edits
 * (src/features/view/cell-template.ts). This reads the installed `@pixi/3d` and checks that, so an upgrade that moves the
 * original fails here, in words, before a frame is wrong.
 */
const installed = (() => {
  const entry = createRequire(import.meta.url).resolve('@pixi/3d')
  const file = resolve(dirname(entry), 'core/gpu/shader/MaterialSystemGpu.mjs')
  const source = readFileSync(file, 'utf8')
  return {
    file,
    source,
    gpu: /const gpuTemplate = `([\s\S]*?)`;/.exec(source)?.[1],
    groups: /const template = \{\s*bindGroups: (\[[\s\S]*?\n\t\]),\s*gpu: gpuTemplate/.exec(source)?.[1],
  }
})()

/** A bind-group list as text without the quoting and spacing that differ between the package's build and `JSON.stringify`. */
const bare = (text: string): string => text.replace(/["\s]/g, '').replace(/,([\]}])/g, '$1')

describe('the depth-writing template', () => {
  it('finds @pixi/3d’s own template in the installed package', () => {
    expect(
      installed.gpu,
      `no gpuTemplate in ${installed.file}: @pixi/3d changed, so the painter's copy must be redone`,
    ).toBeTypeOf('string')
  })
  it('binds the groups the installed template binds, the global one as a uniform buffer', () => {
    expect(installed.groups, `no bindGroups in ${installed.file}`).toBeTypeOf('string')
    expect(bare(JSON.stringify(CELL_TEMPLATE.bindGroups))).toBe(bare(installed.groups ?? ''))
  })
  it('is the installed template but for the fragment entry’s return type, its cellDepth declaration and its return', () => {
    const ours = CELL_TEMPLATE.gpu!
    expect(ours).not.toBe(installed.gpu)
    // Undo the three edits; what is left must be the installed text exactly.
    const undone = ours
      .replace(
        'struct CellFragment { @location(0) color: vec4<f32>, @builtin(frag_depth) depth: f32 }\n\n@fragment\nfn mainFragment(input: FragmentInput) -> CellFragment {',
        '@fragment\nfn mainFragment(input: FragmentInput) -> FragmentOutput {',
      )
      .replace('  var cellDepth: f32 = 1.0;\n', '  {{fragmentDeclareOutputs}}\n')
      .replace(
        '  return CellFragment(vec4<f32>(finalColor * alpha, alpha), cellDepth);',
        '  outputs.color = vec4<f32>(finalColor * alpha, alpha);\n\n  {{fragmentWriteOutputs}}',
      )
    expect(undone).toBe(installed.gpu)
  })
})
