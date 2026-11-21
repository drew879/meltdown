# The melt (Phase 2): notes

What a wrong guess and a lost round look like, how it is built, and what is left. Decisions are in `BRIEF.md` ("Decisions from the melt preview", 2026-11-21); the art prompts are in `art/prompts/round-7-melt-pieces.md`.

## What Drew chose

From a preview page of three options each (2026-11-21):

- **A wrong guess:** B's slump with A's flare. The sun flares with a ring of rays behind it and heat wiggles rise; he shivers, slumps through every stage in between (so on Normal and Hard the skipped stages are seen), wobbles, and two drops of sweat fly off. 1.1 to 1.2 s.
- **The last wrong guess:** B, "hat left hanging". He melts out from under his hat; it jumps, hangs in the air, looks down and drops into the puddle. 2.3 s, then the heading. The puddle then rests: the hat floats and bobs, the carrot bobs, the eyes blink.
- Timing as previewed: the loss takes 2 to 3 s and the heading waits for it.

The options he did not choose (C sunbeam for a miss; A sploosh and C sink-and-bloop for the loss) are in the strips `miss-*.jpg` and `loss-*.jpg` in this folder, with `stages-*.jpg` showing where each miss lands at each difficulty. The preview page itself (`melt.html`, `src/preview/`) is deleted; it is in the history at commit 4ac40d6.

## How it is built

The same shape as the win celebration.

| File | What it does |
| --- | --- |
| `src/paper/melt-timeline.ts` | The melt as pure functions of the time since the guess: `missFrame(from, to, t)`, `lossFrame(from, t)`, `restFrame(t)`. Units are pixels of the cut art (the fresh snowman is 912 tall), from the middle of his feet. Also the piece names (`MELT_PIECES`) and where the loose pieces lie (`REST`, `HAT_ON`). |
| `src/paper/melt-timeline.test.ts` | 17 tests: every miss at every difficulty starts and ends on the right stage and passes through each one in between; the hat hangs clear of the puddle and drops straight into its place; the loss ends in the puddle at rest; nothing is held for under 40 ms. |
| `src/paper/melt.ts`, `melt.css` | Draws one frame at a time over the play screen's scene. While it plays, the plain `#snowman` is faded out (class `aside`), not removed, so its alt text is still read. |
| `src/paper/play.ts` | Starts the beat on a wrong guess and the loss on the last one; holds the result back until the loss has played or been skipped. |

Rules it follows:

- **The plain snowman takes the new stage at once**, hidden behind the beat. Whatever cuts a beat short (another guess, a resize, a new screen) finds him where he should be, so quick taps cannot leave anything half done. A wrong key is switched off the moment it is tapped.
- **Skip:** during the loss, a tap anywhere but the name tags, or Enter, Space or Escape, jumps to the puddle at rest and brings the result up. It listens for the press (`pointerdown`), so the tap on the last wrong key cannot skip its own melt.
- **Reduced motion and `?still`:** no beat (the new stage simply shows), and a lost round is the puddle as a still picture, with the result up at once.
- **A refresh** mid-round shows the stage with no beat; on a lost round it shows the puddle at rest (bobbing and blinking, unless motion is reduced), with no replay.
- **The hat** jumps across to above where it will land and hangs with its middle at 0.6 of his height, whichever stage it came off. Higher than that and, on Hard on a 320 px phone, it ran into the sun.
- **WebKit:** every picture is a direct child of the melt's actor. Pictures nested in a second zero-size box inside the actor's drop shadow were not painted at all in WebKit.
- The loose pieces are left out of the first-load preload (`src/paper/art.ts`), like the win celebration's.

## The art

Eleven loose pieces, by the names they have in `public/art/` (`art/prompts/round-7-melt-pieces.md` has the prompts, sizes and cutting steps):

- Sheet `melt-puddle.png`: `puddle`, `puddle-hat`, `puddle-carrot`, `puddle-eyes`, `puddle-eyes-closed`, `hat-6`, `hat-7`.
- Sheet `melt-heat.png`: `sun-flare`, `heat-1`, `heat-2`, `drop`.

All eleven were generated and cut on 2026-11-21 (commit 6b077ad; the prompts file has the results, including why the puddle's pieces come from three sheets). The game was first built with rough stand-ins cut from the existing stages; they were deleted once the real pieces were in (their cutter is in the history at commit 1b2edb6, `src/paper/melt-standins/make-standins.mjs`). `REST` and `HAT_ON` in `melt-timeline.ts`, the places the pieces lie, were measured from the drawn stages 6, 7 and 8 by that cutter.

The puddle has no eyes drawn on it: the open and closed eyes are two pieces that are swapped, so they never have to line up with a drawing underneath. The drawn stage 8 (`snowman-8`) is still what the plain `#snowman` holds on a lost round, for its alt text, but it is not seen: the puddle and its loose pieces stand in front of it.

## Checking it

- `npm test`: the timeline's tests run with the engine's.
- `npm run check`: `scripts/check-game.mjs` plays the beat, quick wrong taps, the loss and how long it takes, a tap to skip, a refresh on a lost round and a reduced-motion phone, at 320, 393 and 440 px in WebKit; `check-play.mjs` skips the loss with Escape.
- `node scripts/melt-frames.mjs [folder] [width] [height]` saves frame strips of the real game at exact moments (it drives the page's clock): `game-miss-easy/normal/hard.jpg`, `game-loss-normal/hard.jpg` in this folder.
- While another session is cutting art, `src/paper/art-manifest.json` changes on disk and the dev server reloads the page, which fails whichever check is running at that moment. Run the checks again once the cutting is done.

## Not done

- Nothing has been on a real phone, and VoiceOver has not been tried.
- Sound (Phase 4): the beat and the loss have clear moments to hang sounds on (the flare at 0, each stage of the slump, the splat at 360 ms, the hat landing at 1730 ms).
- On a 320 px phone the sun at its biggest overlaps his head on the stage before a loss. That is the play screen's layout, not the melt, and was there before.
- The answer's missed letters appear on the sign the moment the round is lost, while the melt plays. They could wait for the melt to finish, with the heading; that is a call for Drew.
