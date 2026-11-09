import { describe, expect, it } from 'vitest'
import {
  ALPHA,
  alphaCodeGlsl,
  alphaCodeWgsl,
  codeOfAlpha,
  packDepth,
  packedDepthBytes,
  unpackDepth,
} from '#src/shared/render/alpha/alpha-codes.ts'

describe('the alpha codes', () => {
  it('codes sit half a byte apart or more', () => {
    const codes = [ALPHA.none, ALPHA.sky, ALPHA.painted, ALPHA.glowing, ALPHA.world].map((a) =>
      Math.round(a * 255),
    )
    expect(codes).toEqual([0, 160, 192, 224, 255])
  })

  it('reads a byte as the code it is nearest, within half a byte, and anything else non-zero as world', () => {
    expect(codeOfAlpha(0)).toBe('none')
    expect(codeOfAlpha(160)).toBe('sky')
    expect(codeOfAlpha(192)).toBe('painted')
    expect(codeOfAlpha(224)).toBe('glowing')
    expect(codeOfAlpha(255)).toBe('world')
    // a faded wall over the sky leaves a + dst * (1 - a): no code, so world
    expect(codeOfAlpha(Math.round(0.4 * 255 + 160 * 0.6))).toBe('world')
    expect(codeOfAlpha(100)).toBe('world')
    expect(codeOfAlpha(1)).toBe('world')
  })

  it('writes the same constants into the GLSL and the WGSL', () => {
    for (const source of [alphaCodeGlsl(), alphaCodeWgsl()]) {
      for (const name of ['isPainted', 'isGlowing', 'isSky', 'isWorld', 'isDrawn'])
        expect(source).toContain(name)
      expect(source).toContain('192.0')
      expect(source).toContain('224.0')
      expect(source).toContain('160.0')
    }
  })

  it('a cell depth survives its packing to within a millimetre', () => {
    for (const d of [-3.9, -0.25, 0, 0.0004, 1.37, 3.9])
      expect(Math.abs(unpackDepth(packDepth(d)) - d)).toBeLessThan(1e-3)
  })

  it('packs a depth into two bytes, high byte first, and clamps past four metres', () => {
    const [hi, lo] = packedDepthBytes(packDepth(0))
    expect(hi * 256 + lo).toBe(packDepth(0))
    expect(packDepth(-9)).toBe(0)
    expect(packDepth(9)).toBe(65535)
  })
})
