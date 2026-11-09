// The starter sheets' colours: a small warm set of our own. The DUEL palette is the framework's, but its licence for
// this use is still open, so the starter art does not use it; swapping this one table recolours every sheet.

/** The player's shirt: the colour the stranger test looks for to find the player on the canvas. */
export const SHIRT = '#22c55e'

export const PALETTE: Readonly<Record<string, string>> = {
  k: '#1c1b2e', // outline
  h: '#5a3826', // hair
  s: '#f1c79b', // skin
  S: '#d29a6a', // skin shadow
  w: '#ffffff', // eye white
  g: SHIRT, // shirt
  G: '#14803c', // shirt shadow
  b: '#3b5bdb', // trousers
  B: '#2a3f9c', // trousers shadow
  y: '#facc15', // coin
  Y: '#b8860b', // coin edge
  l: '#fff3a3', // coin shine
  m: '#a855f7', // slime
  M: '#6d28d9', // slime shadow
  p: '#e9d5ff', // slime shine
  d: '#8a5a38', // soil
  D: '#6a4228', // soil shadow
  e: '#a8744a', // soil light
  r: '#69c23d', // grass
  R: '#3f8f2a', // grass shadow
  q: '#a6e36b', // grass light
  a: '#b4bcc8', // spike
  A: '#6b7280', // spike shadow
  W: '#38a9e8', // water
  x: '#bae6fd', // water ripple
  f: '#ffffff', // flower
  F: '#f472b6', // flower petal
}
