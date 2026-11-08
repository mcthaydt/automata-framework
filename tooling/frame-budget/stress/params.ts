// The scene's size, from the page's query: `?entities=N&systems=M`, and `&hudLabels=K` for K canvas text labels that change
// every frame (the probe's projects pass them). A value
// that is missing, not a whole number or out of range keeps the default, so a typo cannot shrink the scene.

export interface StressParams {
  readonly entities: number
  readonly systems: number
  readonly seed: number
  /** Lines of canvas text redrawn every frame; 0 draws none. */
  readonly hudLabels: number
}

export const DEFAULT_PARAMS: StressParams = { entities: 2000, systems: 8, seed: 1, hudLabels: 0 }

const LIMITS = { entities: 20_000, systems: 64, hudLabels: 100 } as const

function whole(value: string | null, max: number, fallback: number): number {
  const parsed = Number(value ?? Number.NaN)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : fallback
}

export function stressParams(search: string): StressParams {
  const query = new URLSearchParams(search)
  return {
    entities: whole(query.get('entities'), LIMITS.entities, DEFAULT_PARAMS.entities),
    systems: whole(query.get('systems'), LIMITS.systems, DEFAULT_PARAMS.systems),
    seed: DEFAULT_PARAMS.seed,
    hudLabels: whole(query.get('hudLabels'), LIMITS.hudLabels, DEFAULT_PARAMS.hudLabels),
  }
}
