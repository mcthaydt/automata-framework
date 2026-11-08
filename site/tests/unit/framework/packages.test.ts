// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { publishedPackages } from '../../../src/shared/framework/packages.ts'

// The API pages cover what a visitor can install (W4): the published packages, not every package in the repository.
describe('publishedPackages', () => {
  it('are the four packages a game author installs', () => {
    expect(publishedPackages().map((pkg) => pkg.name)).toEqual([
      '@mcthaydt/automata',
      '@mcthaydt/automata-content',
      '@mcthaydt/automata-sim',
      '@mcthaydt/automata-tools',
    ])
  })
})
