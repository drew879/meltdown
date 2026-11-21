# Round 7: the loose pieces for the melt (the miss beat and the loss)

Purpose: Drew chose the melt from the preview page on 2026-11-21 (`BRIEF.md`, "Decisions from the melt preview"; strips in `docs/phase-2/melt/`). A wrong guess is the slump with the flare: the sun flares with a ring of rays behind it, heat wiggles rise, he slumps through every stage in between, wobbles, and sweat drops fly. The loss is "hat left hanging": he melts out from under his hat, it hangs in the air, looks down and drops into the puddle, where it floats, the carrot bobs and the eyes blink. The game is already built with rough stand-ins under the piece names below (`src/paper/melt-standins/`), so each real piece replaces its stand-in as soon as it is in the manifest. These pieces ship.

To be run in one art session with the stage 4 redraw (`round-4b-stage-4-redraw.md`), by Claude in Drew's Chrome, **only after Drew says his computer is free.**

Model and settings: higgsfield.ai, GPT Image 2.6 Sunburst in Unlimited mode (no credits; re-check the UNLIMITED badge and that the Generate button reads UNLIMITED before each run, and ask Drew before any run that would cost credits), 2K, Transparent background on, PNG. Unlimited fixes quality at Medium and runs one image at a time. Run each prompt two or three times so there are versions to choose from. Browser-driving notes are in `CLAUDE.md` (the prompt box needs click, select all and type; read it back before clicking Generate).

Two sheets. Save the chosen version of each in `art/layers/originals/` under the name in its heading, and keep other versions out of that folder.

## 1. The puddle's loose pieces (3:2, transparent) -> `melt-puddle.png`

References to attach from the "+" button, Generations tab (or upload from `art/layers/originals/`), in this order:

1. `snowman-6-8.png`: its right-hand figure is the puddle to take apart (melt stage 8).
2. `snowman-6-7-fix.png`: its two figures are melt stages 6 (left) and 7 (right), whose hats are copied.

```text
A sheet of seven separate cut-paper pieces on a fully transparent background, in two rows with clear space between them so that none touch, each one complete and not cropped, with no ground, no backdrop and no shadow on the background. Every piece is drawn at exactly the same scale as the figures in the reference images, so every hat is the same size as the hats in the references. The pieces are the melted snowman's puddle from the right-hand figure of the first reference image, taken apart. Top row, left to right: (1) the same wide blue felt-paper puddle with the same wavy outline and the same coral and cream striped scarf draped over its right edge, but with nothing else on it: no hat, no carrot, no eyes, only plain blue puddle where they were; (2) the black bowler hat with the coral band from that puddle, alone, lying tilted at exactly the same angle as in the reference, complete, including the part of the brim that the puddle hid; (3) the orange paper carrot nose from that puddle, alone, lying at the same angle. Bottom row, left to right: (4) the two round cream paper eyes with black pupils from that puddle, alone, side by side and touching each other, looking up, exactly as in the reference; (5) the same two eyes closed: two round cream paper discs of the same size, side by side and touching, each with one curved black paper line across it like a closed, smiling eyelid, and no pupils; (6) the bowler hat alone, copied exactly from the left-hand snowman of the second reference image, at the same tilt, with no head under it; (7) the bowler hat alone, copied exactly from the right-hand snowman of the second reference image, at the same tilt, with no head under it. All three hats are the same hat: a small round black felt-paper bowler with a coral band. Handmade cut-paper style matching the attached reference images exactly: pieces cut from coloured paper and card, crisp scissor-cut edges, visible paper fibre, gentle layered depth, soft even studio light. No text, no letters, no numbers, no watermark.
```

Piece names, in the order the cutter finds them (`order: 'grid'`: rows top to bottom, then left to right):

| # | Name | What it is | Size it must come out at, in cut pixels |
| --- | --- | --- | --- |
| 1 | `puddle` | the bare puddle with its scarf; no hat, carrot or eyes | about 615 wide and 285 tall (stage 8 is 615 wide; its puddle and scarf fill the lower 285 px) |
| 2 | `puddle-hat` | the hat lying in the puddle | about 250 x 177, as in stage 8 |
| 3 | `puddle-carrot` | the carrot lying in the puddle | about 129 x 75, as in stage 8 |
| 4 | `puddle-eyes` | the two open eyes, touching, as one piece | about 147 x 75, as in stage 8 |
| 5 | `puddle-eyes-closed` | the same eyes closed | the same size as `puddle-eyes` |
| 6 | `hat-6` | stage 6's hat, alone | about 239 x 212, as on `snowman-6` |
| 7 | `hat-7` | stage 7's hat, alone | about 224 x 193, as on `snowman-7` |

How they must line up with the existing art:

- **One scale for the whole sheet, the melt's own.** Every melt stage is cut so that the fresh snowman stands 912 px tall. The sizes in the table are what the stand-ins measure at that scale (`src/paper/melt-standins/standins.json`); a piece within about 5% is fine.
- **`hat-6` and `hat-7` must match the hats on `snowman-6` and `snowman-7`:** the same size and the same tilt (both lean to the left, brim low on the left). On the last miss the picture changes from the stage, with its hat on, to the puddle with the loose hat hanging where the stage's hat was, so a hat of a different size or tilt would jump. The hat pops up in the same frame, so it does not have to match pixel for pixel.
- **`puddle` must match stage 8's puddle** in outline, width and scarf, because it takes stage 8's place whenever a lost round is on screen. `puddle-hat`, `puddle-carrot` and `puddle-eyes` are laid on it by the game at the places they have in stage 8 (the offsets are `REST` in `src/paper/melt.ts`); check the rest frame against `public/art/snowman-8.webp` and nudge the offsets if the new puddle's outline differs.
- **The two eye pieces are swapped, not overlaid,** so they only need to be the same size as each other. They must each come out as one piece: if the eyes do not touch, raise `join` for this sheet until the pair counts as one, without merging neighbours.
- Each eye piece and the puddle is cut on its own, so nothing on the sheet has to sit at any particular spot; only the order (two rows: three pieces, then four) matters.

Cutting it. Add to `SHEETS` in `scripts/cut-art.mjs`:

```js
// Round 7 (art/prompts/round-7-melt-pieces.md): the puddle taken apart for the loss, and the hats of stages 6 and 7.
{ src: 'melt-puddle.png', order: 'grid', join: 14, names: ['puddle', 'puddle-hat', 'puddle-carrot', 'puddle-eyes', 'puddle-eyes-closed', 'hat-6', 'hat-7'], hat: true },
```

1. `npm run art -- --list` must show 7 pieces on the sheet, in the table's order. If the grid sort puts them in another order (a small piece counted into the wrong row), reorder `names` to match what the list prints; do not move pixels.
2. `npm run art`, then `git status`: only the sheet, the seven new files in `public/art/` and the manifest should change.
3. Size check. `hat: true` scales the sheet by its widest hat row, which reads a straight hat wider than a tilted one (see `CLAUDE.md`, "How the art is made"). Compare by size and area with `node scripts/lineup.mjs docs/phase-2/melt/pieces.png snowman-6 hat-6 snowman-7 hat-7 snowman-8 puddle puddle-hat`, and correct with one `TWEAK` for the sheet's pieces (the same factor for all seven, since they share a scale), with a comment saying why.
4. In the game, lose a round on Hard (the hat hangs from stage 6) and on Normal (from stage 7): `?a=Polar%20Bear&c=Animal&limit=4&g=QXZ` and `limit=6&g=QXZJK`, then one more wrong letter. Read the frames before showing Drew.

Fallback if the hats will not match: the stand-ins for `hat-6` and `hat-7` are cut straight from the stage pictures (`src/paper/melt-standins/make-standins.mjs`), so they match by construction and are close to final quality. Say so to Drew and offer them, rather than shipping a hat that jumps.

## 2. The sun's flare, heat and a drop (3:2, transparent) -> `melt-heat.png`

References to attach, in this order:

1. `sun.png`: the four suns, for the flare's paper, colour and ray shapes.
2. `snowman-0-2.png`: its middle and right figures have the blue bead of sweat the drop must match.

```text
A sheet of four separate cut-paper pieces on a fully transparent background, in one row with clear space between them so that none touch, each one complete and not cropped, with no ground, no backdrop and no shadow on the background. From left to right: (1) a big sunburst flare to go behind the paper sun from the first reference image: a flat ring of twelve long pointed rays cut from orange paper, a deeper, hotter orange than the sun's own yellow rays, all joined at the middle into one piece, with a plain round orange middle and no face. It is one and a half times as wide as the sun in the reference. (2) A heat wiggle: one wavy vertical strip of orange paper with a thinner pale yellow strip glued down its middle, with three soft bends, like heat rising, about a quarter as tall as the flare. (3) A second heat wiggle of the same size, bending the other way and a little different. (4) One drop of water: a single teardrop cut from light blue paper with a small white paper highlight, exactly like the bead of sweat on the snowman's forehead in the second reference image but drawn much bigger, about half as tall as a heat wiggle, with its point at the top. Handmade cut-paper style matching the attached reference images exactly: pieces cut from coloured paper and card, crisp scissor-cut edges, visible paper fibre, gentle layered depth, soft even studio light. No text, no letters, no numbers, no watermark.
```

Piece names, in the order the cutter finds them (`order: 'x'`, left to right):

| # | Name | What it is | Cut size |
| --- | --- | --- | --- |
| 1 | `sun-flare` | the ring of rays that bursts behind the sun | 640 on its long side (the suns are 460) |
| 2 | `heat-1` | a heat wiggle | 200 tall |
| 3 | `heat-2` | another, bending the other way | 200 tall |
| 4 | `drop` | the sweat and splash drop | 120 tall |

How they must line up with the existing art:

- **`sun-flare`** sits centred behind the sun and is drawn 1.3 to 1.75 times the sun's width, so only its rays show around the sun. It must be round (as wide as it is tall, within a few percent), with its rays evenly spaced so that it can be turned in steps, and its middle must be plain, because the sun covers it. Its orange has to read against both the sky and the sun's yellow rays.
- **`heat-1` and `heat-2`** rise beside and above him and are drawn about 0.15 of his height wide; nothing has to match exactly. They are upright: the bottom is where the heat comes from.
- **`drop`** points up (the tip at the top), since the game turns it as it flies. It is used small, for sweat and for the splash, so it needs a clear outline and one highlight, not fine detail.

Cutting it. Add to `SHEETS`:

```js
// Round 7: the flare ring behind the sun, two heat wiggles and the sweat and splash drop, for the miss beat.
{ src: 'melt-heat.png', order: 'x', join: 12, maxSide: 640, maxSides: { 'heat-1': 200, 'heat-2': 200, drop: 120 }, names: ['sun-flare', 'heat-1', 'heat-2', 'drop'] },
```

1. `npm run art -- --list` must show 4 pieces, in that order.
2. `npm run art`, then `git status`: only the sheet, four new files in `public/art/` and the manifest should change.
3. In the game, miss once on each difficulty and read the frames: the flare must sit centred behind the sun at every heat, and the wiggles must not cover his face.

## Weight

The stand-ins weigh about 0.35 MB as PNG. As WebP the eleven pieces should add about 0.15 MB. None of them is needed for the first screen: `src/paper/art.ts` leaves the win celebration's pictures out of `preloadArt()`, and these should be left out the same way (the list is `MELT_PIECES` in `src/paper/melt-timeline.ts`).
