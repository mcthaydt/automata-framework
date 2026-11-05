/** Colour helpers shared by the generators. */
/** A colour (0xrrggbb) as `#rrggbb`. */
export const hexOf = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
