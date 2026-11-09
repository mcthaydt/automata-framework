// Every number the site's motion uses, in one place. The Owner asked for "super subtle", so the limits are a test's
// (motion-tokens.test.ts): no duration over 0.48 s, no travel over 8 px, no scale under 0.98. Seconds for time and
// pixels for travel, which is what GSAP takes; tokens.css repeats the CSS-side ones, and the test holds them equal.
export const MOTION = {
  press: 0.14,
  hover: 0.18,
  ui: 0.2,
  page: 0.22,
  reveal: 0.48,
  stagger: 0.06,
  /** Parts of one section beyond this many arrive together, so a long list never trails. */
  staggerCap: 6,
  rise: 8,
  settle: 6,
  nudge: 4,
  scaleFrom: 0.98,
  productScaleFrom: 0.985,
  /** GSAP's name for the kit's `--ease-out` (cubic-bezier(0.22, 1, 0.36, 1)); within 0.011 of it. */
  ease: 'power4.out',
  /** Lenis's smoothing: a wheel notch is 90% done in about 270 ms, close to a native one. */
  lerp: 0.14,
  /** A section arrives when its top is 15% of the window above the bottom edge. */
  revealMargin: '0px 0px -15% 0px',
} as const
