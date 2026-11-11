# Vendored fonts

## Fusion Pixel Font, 12 px proportional (`fusion-pixel-12/`)

The pixel font every game on the framework draws its words in: one face per language flavour, so a shared Han
character takes each language's own shape. Every flavour holds the same full Latin, so English, Latin American
Spanish and Brazilian Portuguese use the `ja` file.

- **Font:** Fusion Pixel Font v2024.05.12 by TakWolf (<https://github.com/TakWolf/fusion-pixel-font>), the
  12 px proportional build.
- **Licence:** SIL Open Font License 1.1 (`fusion-pixel-12/OFL.txt`, copied from the npm packages below, which
  agree byte for byte). **Reserved Font Name: "Fusion Pixel".** A subset is a Modified Version and may not keep
  that name, so the font build renames a subset's family (`fonts.toml`'s `reserved_name`) and ships `OFL.txt` beside
  the subsets. The unmodified files here keep the name.
- **Source:** Fontsource's npm copies, because `github.com` is not reachable from the build containers and npm is.
  Each file is the package's whole font (`files/*-latin-400-normal.woff2`; Fontsource's "latin" is only a name here).

| File | Package (all `5.3.0`) | npm integrity | sha256 | Bytes |
|---|---|---|---|---|
| `ja.woff2` | `@fontsource/fusion-pixel-12px-proportional-jp` | `sha512-IBO66dSy3i1+RXHGXYb3m2XL/79xlTyyU3VRYjjrHwRNOZmw3cjLy2rDypdcF+/kpPt2EQjXK9UePKxMKWpYMA==` | `dd52d6fa0eb8100ee3a4bee142f2c03b3480a815cf0d53722bd208a7f3bd316b` | 610,640 |
| `ko.woff2` | `@fontsource/fusion-pixel-12px-proportional-kr` | `sha512-ALFVoz0Zl/oGjSrk78ZZy6FHpIi00bev41jNElS/j5Mt2XPn0VQ9e56I8NB0jddiKdZRfWxJHtHAmBckHSRRdQ==` | `f7527814ee81f89ac4596d292c627e4dda645f6b22f5120aaa968ff3ed7d0833` | 618,900 |
| `zh_hans.woff2` | `@fontsource/fusion-pixel-12px-proportional-sc` | `sha512-PDgfCunZbVgPM5/HSaP29KjQaxLUsVAng6urpSQXww87e9AOfA7j/PDzWYO/Q8yhPyaw6oUGh5s2eGln1HSgPw==` | `043eae5e616b0d1e75dc746d3d687b4413f9f1c70c1a09bc4ebb705ef1cc8e32` | 602,304 |
| `OFL.txt` | (the packages' `LICENSE`, line endings made LF as every text file in this repository is) | | `3cf5b566d96ac5c3328f23d9ac50750f9b7e921b23f54d60270f13dc90df73fc` | 18,805 |

What the font does not hold: the check mark ✓, the cross ✕ and the arrow ⟳. Core draws those as inline SVG, so no
game's font has to hold an icon.

A game names these files in its `content/fonts.toml` (`file`, the sha256 above, `license = "OFL-1.1"`,
`reserved_name = "Fusion Pixel"`, `license_file`) and the font build cuts them to the characters the game shows.
Switching the font set is a change to this folder and to those `fonts.toml` files, and nothing else.
