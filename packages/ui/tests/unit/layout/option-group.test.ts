import { fireEvent } from '@testing-library/svelte'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OptionGroup from '#src/layout/OptionGroup.svelte'

// The cases of FloorFifty tests/client/ui/layout/option-group.test.ts at ac72660, on native radios (plan decision:
// M4.5's `adjust` cycles a named radio group, and the browser gives arrow keys).
let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

const OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High', ariaLabel: 'High quality' },
]

function open(props: { value: string | undefined; onchange?: (value: string) => void; disabled?: boolean }) {
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(OptionGroup, {
    target: host,
    props: { label: 'Quality', options: OPTIONS, onchange: () => {}, ...props },
  })
  flushSync()
  const radios = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
  return { host, radios }
}

describe('OptionGroup', () => {
  it('is a fieldset named by its legend, with one named radio per option', () => {
    const { host, radios } = open({ value: 'low' })
    const fieldset = host.querySelector('fieldset')
    expect(fieldset?.querySelector('legend')?.textContent).toBe('Quality')
    expect(radios.map((radio) => radio.value)).toEqual(['low', 'medium', 'high'])
    const names = new Set(radios.map((radio) => radio.name))
    expect(names.size).toBe(1)
    expect([...names][0]).not.toBe('')
  })

  it('checks the radio for its value, and marks it as well as filling it', () => {
    const { radios } = open({ value: 'medium' })
    expect(radios.map((radio) => radio.checked)).toEqual([false, true, false])
    const chosen = radios[1]?.closest('label')
    expect(chosen?.dataset.selected).toBe('true')
    expect(chosen?.querySelector('[data-option-mark]')).not.toBeNull()
  })

  it('checks nothing while the value is unknown', () => {
    const { radios } = open({ value: undefined })
    expect(radios.some((radio) => radio.checked)).toBe(false)
  })

  it('reports a choice and leaves the value to its owner', async () => {
    const onchange = vi.fn()
    const { radios } = open({ value: 'low', onchange })
    await fireEvent.click(radios[2] as HTMLInputElement)
    flushSync()
    expect(onchange).toHaveBeenCalledWith('high')
    expect(radios.map((radio) => radio.checked)).toEqual([true, false, false])
  })

  it('disables every option together', () => {
    const { radios } = open({ value: 'low', disabled: true })
    expect(radios.every((radio) => radio.disabled)).toBe(true)
  })

  it('names an option by its ariaLabel where one is given', () => {
    const { radios } = open({ value: 'low' })
    expect(radios[2]?.getAttribute('aria-label')).toBe('High quality')
    expect(radios[0]?.hasAttribute('aria-label')).toBe(false)
  })
})
