# S5: Deterministic math

- **Question:** Can `sin/cos/tan/atan2/exp/log/pow/hypot`, built only from bit-exact operations, give identical bits in V8, JSC and SpiderMonkey, with acceptable accuracy and cost?
- **Method:** `spikes/s5-math/*`.
  - fdlibm-derived kernels: Cody–Waite reduction, then minimax polynomials.
  - `exp` and `log` exponent handling uses DataView bit manipulation.
  - A source rule bans any `Math.*` member outside the allowlist; comments are stripped before scanning.
- **Run:** 2026-10-01, M1 Mac. `Tests 9 passed (9)` across Node, Chromium, WebKit and Firefox.

## Results
- **Why it's needed.** The native `Math.sin/exp/pow` hash over 300k samples **differs in every engine**, Node vs Chromium included, even though both are V8 (Task 2 harness):

  | Engine | Native-math hash |
  |---|---|
  | Node | `dff7763e7f7f8353…` |
  | Chromium | `956edd0459a28f61…` |
  | WebKit | `6307d6ba66ae74d6…` |
  | Firefox | `9f2f36f202e75835…` |

- **dmath parity over 1M samples:** Node PASS, Chromium PASS, WebKit PASS, Firefox PASS (`2d8c5d2d…`).
- **Source rule:** PASS. The only `Math.*` members used are allowlisted, and the negative control catches `Math.sin` in code but not in comments.
- **Max error vs the built-ins:**

  | Function | Error | Kind |
  |---|---|---|
  | sin, cos | 1.1e-16 | absolute |
  | tan | 4.4e-16 | relative |
  | atan2 | 4.4e-16 | absolute |
  | exp | 1.9e-16 | relative |
  | log | 2.2e-16 | relative |
  | pow | 8.1e-15 | relative |

  Edge cases pass: signed zeros match the built-ins, and `pow(2, 3) === 8`.
- **Cost, ms per 1M calls in Node** [dmath, Math]:

  | Function | dmath | Math |
  |---|---|---|
  | sin | 43 | 28 |
  | atan | 30 | 26 |
  | exp | 36 | 25 |
  | log | 37 | 23 |

  dmath is about 1.2–1.6× slower, roughly 40 ns per call: negligible at sim scale.

## Contract (documented limits)
- `sin` and `cos` are accurate for |x| < ~8.2e5. Beyond that they stay deterministic but get less accurate.
- `atan2` and `hypot` take finite inputs only. Signed zeros match the built-ins. `hypot` does no overflow scaling (inputs must satisfy x²+y² < 1.7e308).
- `pow` with an integer |y| ≤ 64 uses repeated squaring, so it is exact where IEEE is. Otherwise it computes `exp(y·log x)`, whose relative error grows with |y·log x|.
- `kCos` omits fdlibm's `qx` correction, and `log` always takes the `hfsq` branch. Both are within the bounds above.

## Verdict
**PASS.** It is bit-identical in all four engines, within ~1 ulp of the built-ins (pow within 8e-15), at negligible cost. Native `Math.*` demonstrably diverges between engines, so this module is required for laws 5 and 6.

## Consequences for Plan 2
- `automata-sim/math` = `dmath.ts`, plus a golden table of committed input/output bit patterns.
- `Math.*` allowlist for `check-boundaries`: `sqrt, fround, round, floor, ceil, trunc, abs, min, max, sign`, plus `imul` for the RNG. `round` and `imul` are additions to spec §2's list; record them in the spec's §11.
- The boundary checker must strip comments before scanning. The source rule tripped on prose twice during the pre-run.
