// A stand-in for a game's anchors, so the four converted scenes play without a level: every anchor name settles to a
// fixed point made from its letters. It only has to be the same on every call.
export const anchorFor = (name: string): { readonly x: number; readonly z: number } => {
  let h = 7
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 9973
  return { x: (h % 40) / 4, z: (Math.floor(h / 40) % 40) / 4 }
}
