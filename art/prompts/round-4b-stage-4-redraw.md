# Round 4b: melt stage 4 redrawn, so it no longer looks like stage 3

Purpose: after round 4, Drew found melt stages 3 and 4 "very similar" (2026-11-21). Stage 3 is now the redrawn waving snowman; stage 4 is still the old one from `snowman-4-5-fix.png`. They share a face, body and scarf, and only a raised arm and a sweat bead tell them apart (`docs/phase-2/stage-3-4-options.png`). Swapping or resizing them cannot fix that, so stage 4 gets redrawn as a clearly more melted figure that sits between the new stage 3 and stage 5.

Agreed with Drew on 2026-11-21: redraw stage 4. **Claude runs it with computer use in Drew's Chrome, but only after Drew says he is done with his computer** (he asked to be left alone while he is using it). Do not start before he says so.

Model and settings: higgsfield.ai, GPT Image 2.6 Sunburst in Unlimited mode (no credits; the free grant was due to end on 2026-11-26, so re-check the UNLIMITED badge, and ask Drew before any run that would cost credits), 3:2, 2K, Transparent background, PNG. Unlimited fixes quality at Medium and runs one image at a time. Run the prompt two or three times so there are versions to choose from.

References to attach from the "+" button, Generations tab (or upload the files from `art/layers/originals/`), in this order:

1. `snowman-3-redraw.png`: its middle figure is the stage 3 to copy (waving, one arm on the ground, small puddle).
2. `snowman-4-5-fix.png`: its right-hand figure is the stage 5 to copy (half sunk, both arms on the ground).

Do not attach `snowman-3-5.png` (the old stage 3). Browser-driving notes from round 5: in Higgsfield's prompt box the form tool and a scripted paste do not work; click the box, select all and type, and the call times out after 30 s while the page keeps typing, so wait about a minute and read the box back with JavaScript before clicking Generate.

Save the version Drew likes best in `art/layers/originals/` as `snowman-4-redraw.png`. Keep other versions out of that folder.

## Prompt (3:2, transparent)

```text
Three versions of the same paper snowman from the reference images, side by side with clear space between them so that their puddles do not touch, on a fully transparent background, with no ground and no backdrop. Each one is complete and not cropped, and all three are drawn at the same scale as the snowmen in the references, with the hat the same size every time. Left: an exact copy of the middle snowman of the first reference image, the one with a worried frown, a bead of sweat, one twig arm raised and waving, the other arm lying in a small blue puddle. Right: an exact copy of the right-hand snowman of the second reference image, the half-sunk one whose head rests on a low wide body, with both twig arms lying in a blue puddle. Middle: the step between them, clearly more melted than the left one and clearly less melted than the right one. He is about 85 percent of the left one's height and noticeably wider and lower, still three soft snowballs but now slumping into one wide mound, with the top snowball starting to sink into the middle one so his head sits lower and tilts to one side. His hat has slipped and sits tilted. Neither arm is raised any more: one twig arm has fallen and lies in his puddle, and the other droops, bent downwards, with its tip touching the puddle. The puddle is clearly bigger than the left one's. He is past sweating, so there is no sweat bead. His eyes are wide and look down at his puddle, his carrot nose droops a little, and his mouth is a small wobbly frown, so his face is different from both of the others. His scarf hangs lower than the left one's. The same character every time: a small round black bowler hat with a coral band, a coral and cream striped scarf, a carrot nose, round cream paper eyes with black pupils, black hexagonal paper buttons, brown twig arms and textured white paper snow. Handmade cut-paper style matching the attached reference images exactly: pieces cut from coloured paper and card, crisp scissor-cut edges, visible paper fibre, gentle layered depth, soft even studio light. No text, no letters, no numbers, no watermark.
```

Only the middle figure is used, as `snowman-4`. The two copies are there so the model judges the in-between size; they are skipped when cutting.

## Cutting it

Add this line to `SHEETS` in `scripts/cut-art.mjs`, after the `snowman-4-5-fix.png` entry, so the redraw replaces that stage 4 when the sheet is present (the same way `snowman-3-redraw.png` replaces stage 3):

```js
{ src: 'snowman-4-redraw.png', order: 'x', join: 10, names: [null, 'snowman-4', null], hat: true },
```

Then:

1. `npm run art -- --list`: it must show 3 pieces on the new sheet. If two figures merged (touching puddles), lower `join` until they split; if the count is still off, say so and do not cut.
2. `npm run art`: `git status` should show only the sheet, `public/art/snowman-4.webp` and the manifest changed.
3. Size check, which is what went wrong last time. The cutter scales a sheet by its widest hat row, so a hat that sits straight reads wider than a tilted one and the whole sheet is cut too small. Compare the stages by hat area and height with `node scripts/lineup.mjs docs/phase-2/stage-3-4-redraw.png snowman-2 snowman-3 snowman-4 snowman-5`. Stage 4 should come out at about 640 px tall (stage 3 is 755, stage 5 is 528, so the steps are about equal) with its hat the same size as its neighbours'; correct it with `TWEAK`, with a comment saying why.
4. Look at stages 3, 4 and 5 in the game on Easy (8 misses allowed): `?a=Polar%20Bear&c=Animal&limit=8&g=QXZ`, `QXZJ` and `QXZJK` (3, 4 and 5 misses). Read every picture before showing Drew.

## Result (2026-11-21)

Run by Claude in Drew's Chrome with the prompt above unchanged, both references uploaded from `art/layers/originals/`, GPT Image 2.6 Sunburst on Unlimited (no credits). Three versions were generated and the second was kept as `snowman-4-redraw.png`.

- All three cut into 3 pieces at `join: 10`.
- Version 1's middle figure came out at 584 px tall with a hat a little small (area 13,400): a big drop after stage 3 (755) and a small one before stage 5 (528). Version 3 was like version 2, with the left and middle puddles almost touching. Neither is kept.
- Version 2 needs no `TWEAK`: stage 4 is 639 px tall (stages 3 and 5 are 755 and 528, so the steps are 116 and 111), its hat's area is 14,440 against stage 3's 14,300, and the snow is 505 px across between 480 and 521.
- Lineup of stages 2 to 6: `docs/phase-2/stage-4-redraw.png`. In the game on Easy at 3, 4 and 5 misses: `docs/phase-2/stage-3-4-5-in-game.png`.
