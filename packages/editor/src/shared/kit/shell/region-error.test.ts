import { describe, expect, it } from 'vitest'
import { REGION_LABEL, regionErrorDetails } from './region-error'

describe('regionErrorDetails', () => {
  it('names the region, the error and its stack', () => {
    const error = new TypeError('cannot read layers')
    error.stack = 'TypeError: cannot read layers\n    at LayerList (layer-list.svelte:12:4)'
    expect(regionErrorDetails('panel', error)).toBe(
      [
        'Region: panel',
        'Error: TypeError: cannot read layers',
        '',
        'TypeError: cannot read layers\n    at LayerList (layer-list.svelte:12:4)',
      ].join('\n'),
    )
  })

  it('leaves the stack out when the error has none', () => {
    const error = new RangeError('depth out of range')
    delete error.stack
    expect(regionErrorDetails('inspector', error)).toBe(
      'Region: inspector\nError: RangeError: depth out of range',
    )
  })

  it('shows a thrown value that is not an Error as text', () => {
    expect(regionErrorDetails('status', 'broken')).toBe('Region: status\nError: broken')
  })
})

describe('REGION_LABEL', () => {
  it('names every region the shell renders from a snippet', () => {
    expect(Object.keys(REGION_LABEL).sort()).toEqual([
      'canvas',
      'dock',
      'inspector',
      'panel',
      'rail',
      'status',
      'topbar',
    ])
  })
})
