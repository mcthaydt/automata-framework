// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fieldPosition } from '#src/shared/kit/widgets/field-position.ts'

/** A screen with three rows that each hold a field with the same label, under a region. */
function rows(region = 'canvas') {
  document.body.innerHTML = `
    <aside data-region="panel"><div><input id="panel-first" /></div></aside>
    <main data-region="${region}">
      <section>
        ${[1, 2, 3].map((n) => `<article><label>What it says</label><textarea id="line-${String(n)}"></textarea></article>`).join('')}
      </section>
    </main>`
  const find = (id: string) => document.getElementById(id) as HTMLElement
  return { find }
}

describe('fieldPosition', () => {
  it('tells apart fields that share a label', () => {
    const { find } = rows()
    const positions = ['line-1', 'line-2', 'line-3'].map((id) => fieldPosition(find(id)))
    expect(new Set(positions).size).toBe(3)
  })

  it('gives the same field the same position when the screen is drawn again', () => {
    const before = fieldPosition(rows().find('line-3'))
    const after = fieldPosition(rows().find('line-3'))
    expect(after).toBe(before)
  })

  it('names the region the field sits in, so the panel and the canvas never meet', () => {
    const { find } = rows()
    expect(fieldPosition(find('panel-first')).startsWith('panel')).toBe(true)
    expect(fieldPosition(find('line-1')).startsWith('canvas')).toBe(true)
  })

  it('does not depend on what sits above the region', () => {
    const { find } = rows()
    const before = fieldPosition(find('line-2'))
    document.body.prepend(document.createElement('header'))
    expect(fieldPosition(find('line-2'))).toBe(before)
  })

  it('has a position for a field outside any region', () => {
    document.body.innerHTML = '<div><input id="lone" /></div>'
    expect(fieldPosition(document.getElementById('lone') as HTMLElement)).not.toBe('')
  })
})
