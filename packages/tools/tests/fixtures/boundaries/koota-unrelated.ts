// A function of the game's own that happens to be called `trait`: not koota's, so its object argument is fine.
function trait(fields: { readonly x: number }): number {
  return fields.x
}

export const x = trait({ x: 1 })
