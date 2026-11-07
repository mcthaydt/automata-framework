// The determinism row's state and words: it says only what this browser checked.

export type DeterminismView =
  | { readonly kind: 'checking'; readonly ticks: number }
  | { readonly kind: 'pass'; readonly ticks: number; readonly hash: string; readonly framework: string }
  | { readonly kind: 'diverged'; readonly tick: number }
  | { readonly kind: 'edited'; readonly ticks: number; readonly hash: string }

/** The row's text. `framework` is the 40-hex commit the frame booted, shown short. */
export function determinismText(view: DeterminismView, exampleId: string): string {
  switch (view.kind) {
    case 'checking':
      return `Determinism: checking ${view.ticks} ticks in this browser…`
    case 'pass':
      return `Determinism: these ${view.ticks} ticks replay in this browser to the golden recorded in the framework (examples/__goldens__/${exampleId}.replay, framework ${view.framework.slice(0, 7)}). Hash ${view.hash}.`
    case 'diverged':
      return `Determinism: this browser diverged from the golden at tick ${view.tick}.`
    case 'edited':
      return `Your edit: ${view.ticks} ticks hash to ${view.hash} in this browser. The golden belongs to the original code; agreement across engines is checked in the framework's CI.`
  }
}
