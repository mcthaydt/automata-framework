// The numbers the retro shader reads, from a profile. The shaders take plain uniforms (no constants baked in), so one
// compiled pass serves any profile and a game can retune it while it runs.

import { fadeBlack } from './retro-colour.ts'
import type { RetroProfile } from './retro-profile.schema.ts'

export const RETRO_UNIFORMS = [
  'uSharpness',
  'uGain',
  'uWarmR',
  'uWarmB',
  'uTintG',
  'uBrilliance',
  'uContrast',
  'uHighlights',
  'uShadows',
  'uSaturation',
  'uVibrance',
  'uBlackCrush',
  'uMood',
  'uVignette',
  'uFadeR',
  'uFadeG',
  'uFadeB',
  'uFadeWhite',
  'uGrain',
  'uFps',
  'uSpeck',
  'uSpecks',
  'uScratch',
  'uQuantise',
  'uLumaWeight',
  'uCell',
  'uFilmTime',
] as const

export type RetroUniformValues = Record<(typeof RETRO_UNIFORMS)[number], number>

/** The shader's numbers for a profile and a time (seconds). */
export function retroUniformValues(profile: RetroProfile, time = 0): RetroUniformValues {
  const g = profile.grade
  const black = fadeBlack(profile)
  return {
    uSharpness: profile.sharpness,
    uGain: 2 ** g.exposure,
    uWarmR: g.warmth * 0.1 - g.tint * 0.05,
    uWarmB: -(g.warmth * 0.1 + g.tint * 0.05),
    uTintG: g.tint * 0.1,
    uBrilliance: g.brilliance * 0.5,
    uContrast: g.contrast,
    uHighlights: g.highlights * 0.5,
    uShadows: g.shadows * 0.5,
    uSaturation: g.saturation,
    uVibrance: g.vibrance,
    uBlackCrush: g.blackCrush,
    uMood: g.moodBlend,
    uVignette: profile.vignette,
    uFadeR: black[0],
    uFadeG: black[1],
    uFadeB: black[2],
    uFadeWhite: profile.fade.white,
    uGrain: profile.fade.grain,
    uFps: profile.fade.fps,
    uSpeck: profile.fade.speck,
    uSpecks: profile.fade.specks,
    uScratch: profile.fade.scratch,
    uQuantise: profile.quantise?.levels ?? 0,
    uLumaWeight: profile.quantise?.lumaWeight ?? 0,
    uCell: profile.cell,
    uFilmTime: time,
  }
}
