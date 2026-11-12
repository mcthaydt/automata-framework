import '@testing-library/jest-dom/vitest'

// jsdom has no layout, so a `ResizeObserver` has nothing to report: this one never does, and a component that sizes itself
// from its area keeps its first answer (the wide one), as it would before it is first measured.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
