import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SectionOne from '../testing/SectionOne.svelte'
import SectionTwo from '../testing/SectionTwo.svelte'
import SettingsScreen from './SettingsScreen.svelte'

// PRODUCT.6: the kit's Settings maps core's `settings.screen` copy onto core's SettingsScreen and takes the game's tabs, so the game
// adds a tab or a section here without touching core. The sections themselves (audio, display, controls) are the game's wiring.

afterEach(cleanup)
const COPY = {
  title: 'Settings',
  back: 'Back',
  tabs: 'Settings tabs',
  settingsTab: 'Settings',
  controlsTab: 'Controls',
  more: (n: number) => `+${n} more`,
}
const TABS = [
  { id: 'settings', label: 'Settings', sections: [{ component: SectionOne }] },
  { id: 'controls', label: 'Controls', sections: [{ component: SectionTwo }] },
]
const props = (over: Record<string, unknown> = {}) => ({ copy: COPY, tabs: TABS, onBack: () => {}, ...over })

describe('SettingsScreen', () => {
  it('shows the title, the tabs and the first tab’s sections', () => {
    render(SettingsScreen, props())
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Settings tabs' })).toBeInTheDocument()
    expect(screen.getByText('Volume')).toBeInTheDocument()
    expect(screen.queryByText('Rebind keys')).toBeNull()
  })

  it('switches tabs', async () => {
    render(SettingsScreen, props())
    await fireEvent.click(screen.getByRole('tab', { name: 'Controls' }))
    expect(screen.getByText('Rebind keys')).toBeInTheDocument()
  })

  it('goes back from Back and from Escape', async () => {
    const onBack = vi.fn()
    render(SettingsScreen, props({ onBack }))
    await fireEvent.click(screen.getByTestId('settings-back'))
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(onBack.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
