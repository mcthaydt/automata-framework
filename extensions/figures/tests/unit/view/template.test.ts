import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CELL_TEMPLATE } from '#src/features/view/cell-template.ts'

/**
 * FigureBuilder's WGSL template for a depth-writing quad is a copy of `@pixi/3d`'s default material template with four edits
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
    groups: /const template = \{\s*bindGroups: \[([^\]]*)\]/.exec(source)?.[1],
  }
})()

describe('the depth-writing template', () => {
  it('finds @pixi/3d’s own template in the installed package', () => {
    expect(
      installed.gpu,
      `no gpuTemplate in ${installed.file}: @pixi/3d changed, so FigureBuilder's copy must be redone`,
    ).toBeTypeOf('string')
  })
  it('binds the groups the installed template binds', () => {
    const groups = (installed.groups ?? '')
      .split(',')
      .map((s) => s.trim().replace(/"/g, ''))
      .filter(Boolean)
    expect([...CELL_TEMPLATE.bindGroups]).toEqual(groups)
  })
  it('is the installed template but for the fragment entry’s return type, its cellDepth declaration, its return and its texel snap', () => {
    const ours = CELL_TEMPLATE.gpu!
    expect(ours).not.toBe(installed.gpu)
    // Undo the four edits; what is left must be the installed text exactly.
    const undone = ours
      .replace(
        'struct CellFragment { @location(0) color: vec4<f32>, @builtin(frag_depth) depth: f32 }\n\n@fragment\nfn mainFragment(inputIn: FragmentInput) -> CellFragment {\n  var input = inputIn;',
        'fn mainFragment(input: FragmentInput) -> @location(0) vec4<f32> {',
      )
      .replace('  var cellDepth: f32 = 1.0;\n', '')
      .replace(/\n {2}\/\/ Nearest sampling, by hand[\s\S]*?material\.texSize\.xy;\n/, '')
      .replace(
        '  return CellFragment(vec4<f32>(finalColor * alpha, alpha), cellDepth);',
        '  return vec4<f32>(finalColor * alpha, alpha);',
      )
      .replace(
        'fn mainFragment(input: FragmentInput) -> @location(0)',
        '@fragment\nfn mainFragment(input: FragmentInput) -> @location(0)',
      )
    expect(undone).toBe(installed.gpu)
  })
})
