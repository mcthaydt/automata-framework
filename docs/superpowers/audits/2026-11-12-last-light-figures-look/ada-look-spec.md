# Ada's look, from the generated images

Read off `ref-board.png` and the turnaround (`ada-3d/turnaround.png`, 1536 by 1024, the old game's character pipeline's image model),
nothing copied into the game. The numbers are in [`ref-spec-numbers.txt`](ref-spec-numbers.txt), made by
`pnpm --filter @automata/character-kit reference` from the picture (the top, the floor and the crotch are found; the other landmarks are
read by eye and drawn on [`ref-turnaround-marked.png`](ref-turnaround-marked.png) so they can be checked). Where the shipped sprites
disagree with these images, the images win.

## Body

| | the reference | in our painter's terms |
| --- | --- | --- |
| height in heads | **6.8** with her hair on (head top to chin 14.8 % of her); about 7.3 to the crown | head about 14.8 % of H; at density 1 (62 rows) 9 rows, at density 2 (125 rows) 18-19 rows |
| build | slim, adult, lightly athletic; not skinny, not heavy | `fat` low, `muscle` low-mid |
| age | late 20s | `age` about .3 |
| posture | upright, shoulders level and back, chin level, in an A-pose (arms 15 to 20 degrees off the body) | `posture` .8-.9; in play the arms hang near the body |
| neck | visible, slender; chin to shoulder line 5.3 % of H | `neck` thin, `neckLength` mid |
| trunk | shoulder line to vest hem 20.4 % of H; to the crotch 29.4 % | |
| legs | crotch to the floor **50.6 %** of H (hip joint at 51 %); knee at 29 % | `legs` mid; legs as the picture shows, **no hips trick** |
| arms | elbow 62 %, wrist 49 %, fingertips 44 % of H (as held out) | arms close to the body in play, upper arm 1 head |
| widths | hair 17.8 % of H (1.2 heads), sleeve caps 23.8 % (1.6 heads), waistcoat hem 15.3 %, jeans across the hips 20.0 % (1.35 heads) | hip about shoulder (not wider), waist 0.73 of the hip |
| leg width | thigh about 9.7 % of H each, knee 7 %, ankle 5.3 % (slim straight jeans, cropped at the ankle) | `taper` about .6 |
| feet | boots 15.5 % of H tall (a short ankle boot, jeans end at its top, a few rows of ankle), about 1 head long in profile, chunky sole and a low block heel | `boots` on, sole and heel |

## Face (front, side)

- Oval, soft chin, small, neutral. The eyes sit low in the head: **69 % of the way down from the top of the hair**, 42 rows (of 140)
  above the chin. A fringe and the hair frame them.
- **Large almond eyes**, dark brown irises with a catch-light, a dark upper lash line with a small flick at the outer corner. One eye
  is about 30 % of the face's width, the gap between them about the width of one eye (`eyeSize` large, `eyeSpacing` mid, `eyeTilt` a
  touch up at the outer corner, `liner` on).
- **Brows** thin and soft, auburn-dark, a gentle arch, mostly under the fringe (`brows` thin, `crease` none).
- **Nose** small, a light shadow under the tip and a pale bridge; in profile a short straight nose with a soft tip.
- **Mouth** small, closed, neutral, a little darker than the skin; the lower lip catches a light (`mouth` closed).
- **Skin** warm light peach, `#ebbd9d` mid (the DUEL fair step exactly), shade `#c58267`, light `#f9ceb0`; a faint blush on the cheek.
- The portraits (nurse uniform, 1024 by 1024) give the same face older and harder: an angular jaw, heavier brows, a firm mouth. The
  turnaround's face is the softer reading and is the target; the portraits are the expression range (neutral, firm, afraid, worried,
  sad, surprised, inner) for the cutscene close shots.

## Hair

- A chin-length bob, **auburn-copper**: mean `#805244`, shade `#4c271d`, light highlights; the old swatch (`auburn`: `#885041`,
  `#662b29`, `#49251c`) is the DUEL match.
- **Front:** a thick, straight, brow-length fringe, parted a little off centre with a soft sweep over the forehead; strands at the temples
  fall in front of the ears. The hair is wide: **1.2 heads** across at the eye row, 2 times the face's width. Soft outward flip at the ends.
- **Side:** the fringe cuts to the brow; the mass is rounded and deep from the forehead to the back of the skull; the hem lies at the
  jawline and a touch under, ends curling under; the ear is hidden; layered, slightly wispy edges.
- **Back:** a smooth dome from the crown to the nape, widest at the ears (about shoulder width), the hem a gentle curve at the nape-top,
  ends flicking out, no tail, a faint central parting line at the crown.

## Clothes

| garment | reference | nearest DUEL colour (swatch it is today) |
| --- | --- | --- |
| shirt | ivory linen, long sleeves **rolled to mid forearm** (a thick cuff), collar open and spread, two buttons visible, a V of skin at the throat | `#eadbc9`, shade `#ccc3b1`, light `#fff3d6` (`cream`) |
| waistcoat | deep oxblood, dark (`#502520` mean, `#632e26` light, `#3c1d19` shade), **V-neck, double-breasted, two rows of two brass buttons**, a pointed double V hem, a small slanted welt pocket each side; the back plain with a small brass buckle strap at the waist; fitted, ends at the waist | `#662b29`, shade `#49251c`; the old `maroon` (`#904647`, `#6e2434`) is brighter and redder than the reference |
| buttons | brass, `#bd9159` light | `#b29062` |
| jeans | faded mid-wash blue-grey denim (`#47555d` mean, `#58656b` light, `#33414c` shade), slim straight leg, front waist with a button and a fly, patch pockets at the back, **cropped at the ankle**, no belt | `#626871` / `#2e3d47` shade; the old `denim` (`#366b8a`) is bluer and brighter than the reference |
| boots | tan-brown leather, **ankle high with a low block heel and a rounded toe**, a crease at the ankle, a lighter toe cap, dark sole | `#885041` light, `#583126` mid, `#49251c` shade (`bootBrown`) |
| outline | none in the concept art; the pixel versions use a warm near-black | the DUEL teal outline (`#002219`) in the old game; the painter's black today |

Nothing in the references is costume, stereotype or nudity; the open collar shows the throat and a little of the collarbone only, as the
reference does.
