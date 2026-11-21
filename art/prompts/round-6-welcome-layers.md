# Round 6: the welcome screen as separate paper layers

Purpose: Drew picked option A3 (little feet) from round 5b (`art/concepts/round-5/a3-feet.jpg`). These are the separate transparent pieces the welcome screen is rebuilt from. Unlike rounds 1, 2 and 5 they ship. The names, the chips and the button's words are live type placed over blank pieces; the only drawn lettering is MELTDOWN on the sign.

Model and settings: higgsfield.ai, GPT Image 2.6 Sunburst in Unlimited mode (no credits; confirm the Generate button reads UNLIMITED before each run), Transparent background on, PNG. Unlimited fixes quality at Medium and 2K and runs one image at a time. References, in this order: the round 5 option A3 mock-up (`a3-feet.jpg`, in the Generations tab), then the round 2 play screen. Originals go in `art/layers/originals/`; `npm run art` cuts them into `public/art/`.

Ends every prompt with the shared style sentence from round 3: Handmade cut-paper style matching the attached reference images exactly: pieces cut from coloured paper and card, crisp scissor-cut edges, visible paper fibre, gentle layered depth, soft even studio light. No shadow on the background, no ground, no backdrop. No text, no letters and no numbers except the word MELTDOWN where it is asked for. No watermark.

## 1. Welcome pieces (9:16, transparent) -> `welcome-ui.png`

A sheet of separate cut-paper pieces for a mobile game screen on a fully transparent background, stacked in one column with clear space between them so that none touch, each one complete and not cropped and seen flat and straight on. From top to bottom: (1) a big wooden garden sign exactly like the one in the first reference image: a thick board of warm mid-brown wood-grain paper with rough ragged ends, standing on two small square wooden feet at its bottom edge, with a long thick cap of white melting snow along its whole top edge, and across it the word MELTDOWN in large chunky cream handmade-paper capital letters, each letter a slightly different size and tilt, each with a little melted drip hanging from its bottom edge. It fills almost the full width of the picture. (2) A blank cream paper tag, a wide rounded rectangle about two and a half times as wide as it is tall, completely empty, with no writing, no pin and no line. (3) A small blank coral paper label tab, a short rounded rectangle about three times as wide as it is tall. (4) A wide blank brown kraft card strip, a rounded rectangle about five times as wide as it is tall, flat and empty like a tray. (5) A small blank cream paper chip, a rounded rectangle about two and a quarter times as wide as it is tall. (6) The same chip in sun yellow. (7) A large blank sun-yellow paper button, a pill shape about three and a half times as wide as it is tall, with a dashed stitched edge sewn just inside its border. The pieces (2) to (7) are completely blank.

## 2. Spring flowers (3:2, transparent) -> `flowers.png`

A sheet of separate small cut-paper garden flower clumps on a fully transparent background, laid out in two rows of four, well spaced so that none touch, each one complete and not cropped. Every clump is seen from the front, has a flat bottom edge so it can stand on the ground, and is drawn at about the same size as the crocuses in the reference images. Top row: two clumps of white snowdrops with drooping bell flowers and slim green leaves, each clump a little different; then two clumps of pink primroses with round five-petal flowers and crinkled green leaves, each a little different. Bottom row: two upright spikes of blue grape hyacinths with narrow green leaves, each a little different; then two clumps of small orange tulips with green leaves, each a little different. There are no crocuses, no ground and no backdrop.

## Results (2026-11-21)

Both sheets came out right on the first run, in Unlimited mode (no credits). References: `a3-feet.jpg`, then a play screen from the Uploads tab.

- `welcome-ui.png` (1520x2688): the seven pieces came out stacked and separate, all blank except the sign, so `npm run art` found exactly 7 islands with `join: 12`. The cream tag came out about 3.6 times as wide as tall (asked for 2.5), the tab 4.2, the strip 5.2, the chip 2.8, the button 3.6. The screen stretches each whole over its box, so those ratios only matter a little.
- `flowers.png` (2048x1360): 8 clumps, two of each kind, found with `join: 20`. Cut at 260 px on the long side (the crocuses are 220).
- Cut pieces: `docs/phase-2/welcome-pieces.png` and `spring-flowers.png`. The built screen: `docs/phase-2/welcome-a3-vs-built.jpg`.
