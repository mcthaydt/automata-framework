import { describe, expect, it } from 'vitest'
import { adaMoving, adaYaw, stepped, walkedYaw } from '#src/features/figures/figure-view.ts'

// What the sim says a character is doing, as the painted figure shows it: the way she faces, and whether she walks (her legs move)
// or stands.

const at = (x: number, z: number) => ({ 'sectors.in-sector': { x, z } })

describe('which way a figure faces', () => {
  it('Ada faces the heading of her last step', () => {
    expect(adaYaw({ ...at(0, 0), ada: { yaw: 1.5 } }, undefined, 0)).toBe(1.5)
  })

  it('a figure with no heading of its own faces the way it last moved, and keeps it standing still', () => {
    expect(walkedYaw(at(1, 0), at(0, 0), 0)).toBeCloseTo(Math.PI / 2)
    expect(walkedYaw(at(1, 0), at(1, 0), 2)).toBe(2)
  })
})

describe('whether a figure walks', () => {
  it('Ada walks while her component says so', () => {
    expect(adaMoving({ ...at(0, 0), ada: { walking: true } }, undefined)).toBe(true)
    expect(adaMoving({ ...at(0, 0), ada: { walking: false } }, undefined)).toBe(false)
  })

  it('the figure walks when its place changed since the frame before, and stands otherwise', () => {
    expect(stepped(at(1, 0), at(0, 0))).toBe(true)
    expect(stepped(at(1, 0), at(1, 0))).toBe(false)
    expect(stepped(at(1, 0), undefined)).toBe(false)
  })
})
