export function usedHelper(): number {
  return 42
}

// Planted dead code: nothing imports this export.
export function unusedHelper(): number {
  return 0
}
