# Meltdown: handoff notes

A pass-and-play word-guessing game for two people on one phone. Wrong guesses melt a snowman. Built for Drew and his young son, a new reader.

Read `BRIEF.md` before doing anything. It is the source of truth: the original brief, then three dated sections of decisions that override it. This file only says where things stand and how to work here.

**One orchestrator session runs the project (since 2026-11-21).** Drew talks mainly to a single Opus session, titled "Meltdown orchestrator" in the app's sidebar. It plans the work, starts a sub-session for each task (model per "Which model does what" below), checks what each one did, and reports to Drew. **The orchestrator alone updates "Where things stand" below**, so parallel sessions never edit this file at once. A sub-session does not edit this file: it ends with a report (what changed, what was and was not checked, open questions for Drew) and the orchestrator folds that in. A session Drew opens directly, with no orchestrator around, updates "Where things stand" itself as before, so the next session, on any model, can pick up without the conversation.

## Where things stand (updated 2026-11-21, melt and stage 4 live)

**Now: the melt beats, the loss sequence and the new stage 4 are live (pushed 2026-11-21 at `a99266a`, deploy succeeded); not yet on Drew's phone.** Drew approved them from frame strips and asked to push without a code review first, so **the melt code has had no independent review yet**; do one before Phase 2 is approved. Also live (`2ee8c12`, deploy succeeded): on a loss, the answer and missed letters on the sign wait until the melt ends and appear with the loss heading (Drew, 2026-11-21); while the melt plays, the sign and its screen-reader label keep the round as it was before the last miss.

- **How it was made:** a throwaway preview page (deleted) showed three wrong-guess beats and three losses (strips in `docs/phase-2/melt/`; notes for the builder in `docs/phase-2/melt/notes.md`). Drew chose B's slump with A's flare for a miss and B, "hat left hanging", for the loss, timing as previewed (decisions in `BRIEF.md`).
- **Code:** `src/paper/melt-timeline.ts` (the miss beat and the loss as pure functions of time, with tests; `MELT_PIECES` lists the pieces, left out of `preloadArt()`; `REST` holds where the puddle's loose pieces lie) and `src/paper/melt.ts` (drawing), wired into `src/paper/play.ts`. Tap to skip, reduced motion (end state only), `?still` and a refresh on a lost round all show the end state. `check-game` covers it; `npm test` 135 and `npm run check` in WebKit at 320, 393 and 440 px passed before the push. Strips from the real game: `docs/phase-2/melt/game-miss-*.jpg`, `game-loss-*.jpg`.
- **Art, round 4b and round 7** (GPT Image 2.6, Unlimited, no credits; run by Claude in Drew's Chrome): stage 4 is redrawn as a slumped figure with both arms down, and stages 2 to 6 now stand 780, 755, 639, 528 and 493 px tall (no `TWEAK`). Round 7 added `puddle`, `puddle-hat`, `puddle-carrot`, `puddle-eyes`, `puddle-eyes-closed`, `hat-6`, `hat-7`, `sun-flare`, `heat-1`, `heat-2` and `drop`. The puddle pieces came from three sheets (`melt-puddle.png`, `melt-hats.png`, `melt-puddle-base.png`) because no single run got every piece right, and the carrot, eyes and loose hats each have a size `TWEAK`. Lineups: `docs/phase-2/stage-4-redraw.png`, `stage-3-4-5-in-game.png`, `melt-pieces.png`, `melt-hats-on-stages.png`, `melt-heat-pieces.png`. Known weak spots Drew accepted: the sweat drops are faint against the sky, the heat wiggles are slim, and `hat-7` is a little flatter than stage 7's hat.

**Also waiting: the welcome screen is rebuilt from paper pieces (2026-11-21) and live on `dev` (deployed 2026-11-21 14:33 UTC), waiting for Drew to look at it on his phone.** Drew picked mock-up **A3** (the sign on two little feet with snow along its top; `art/concepts/round-5/a3-feet.jpg`) from round 5b. Round 6 generated the pieces as transparent sheets (GPT Image 2.6, Unlimited, so no credits; prompts in `art/prompts/round-6-welcome-layers.md`, originals `art/layers/originals/welcome-ui.png` and `flowers.png`) and the screen was rebuilt in code. Side by side with the mock-up: `docs/phase-2/welcome-a3-vs-built.jpg`; WebKit screenshots at 440, 393 and 320 px: `docs/phase-2/welcome-built-*.png`; the cut pieces: `welcome-pieces.png` and `spring-flowers.png` in the same folder.

- **Pieces** (cut by `npm run art`, listed in `SHEETS` in `scripts/cut-art.mjs`; `maxSides` there gives one piece its own size cap): `welcome-sign` (the board on its feet with the dripping MELTDOWN, the only drawn lettering), blank `tag-blank`, `tab-coral`, `strip-kraft`, `chip-cream`, `chip-yellow`, `button-yellow`, and eight flowers: `snowdrop-1/2`, `primrose-1/2`, `hyacinth-1/2`, `tulip-1/2`. All new art is about 0.35 MB.
- **Code:** `namesScreen` in `src/app/screens.ts` (replaces the cream card) and `src/app/welcome.css` (scoped to `.welcome`, so the setup, handoff and match-over screens keep their plain cards). The title is a hidden live `<h1>` plus the drawn sign. Every other word is live type on a blank piece: the tagline on the cream tag, `FIRST PLAYER` and `SECOND PLAYER` on coral tabs over two name tags with a real input and a writing line, the four match-length chips (cream, yellow when chosen, with a tick as well) on the kraft strip with the live hint under them, and `LET'S PLAY` on the stitched button. The pieces' addresses reach the stylesheet as `--w-*` variables set on the screen's root in `namesScreen`.
- **Stretching:** the tag, tab, strip and chips stretch whole (`background-size: 100% 100%`). Cutting them in nine slices with `border-image` left hairline seams in the paper at fractional sizes, so that was dropped; their corners distort a little but only by a few pixels. The button keeps its drawn shape (`aspect-ratio`).
- **Flowers** are placed by class name in `welcome.css`: snowdrop and primrose at the left foot of the fence, hyacinth and tulip at the right, and the rest at the sign's two feet, never in front of the fields. The backyard plate still has its own purple and yellow crocuses at the fence line, so a few show behind the new flowers; if Drew still finds them repetitive, regenerate the plate without flowers (it is shared by every screen).
- **Checked:** `tsc`, `npm test` (111), `check-game` (all sizes, including a WebKit run on the Mac), `check-play` and `check-sign` pass; screenshots read in WebKit at 440, 393 and 320 px. **Not checked:** a real phone (the keyboard over the name fields on iOS especially), VoiceOver, tap size of the chips on a small phone. At 320x568 the chips go two by two and the button is below the fold (the screen scrolls); the 24-letter names case is covered by `check-game`.
- **Left as it was:** the unused `.pp-title`, `.pp-card` rules for the names screen are still in `screens.css`; delete them once Drew approves the look. The Chrome download of each sheet left a hidden temp file (`.com.google.Chrome.*`) in `~/Downloads`; Drew can delete those two.
- **Pushed (2026-11-21):** two commits on `dev`, the pieces (art, prompts, cutter, manifest) and then the screen (code, screenshots, notes); the deploy succeeded, so it is live. Another session (the win celebration, already pushed) shares this folder, so always stage by explicit path and never `git add -A` or `git add public/art`. The stray `art/layers/originals/Pasted 2026-11-20 at 11.16.08 PM.png` is still untracked and is not art; Drew can delete it.

Background on round 5 and 5b: Drew found the names-and-match-length screen flat beside the rest of the game (one cream card of web-form parts, the title as plain type, nothing overlapping it). Mock-ups first, a drawn title allowed, Claude runs the generations in Drew's Chrome. Round 5 made three options (A sign-led, B notepaper and tape, C scene first; `art/prompts/round-5-welcome.md`, `docs/phase-2/welcome-options.jpg`); Drew picked A with four fixes (no post through the sign, no brass pins on the name tags, a varied mix of spring flowers, no flowers in front of the name tags) and round 5b made A2 stakes, A3 little feet and A4 one post below (`docs/phase-2/welcome-a-fixes.jpg`); he chose A3. Browser-driving notes for next time: in Higgsfield's prompt box the form tool and a scripted paste do not work; click it, select all and type, and the call times out after 30 s while the page keeps typing, so wait about a minute and read the box back with JavaScript before clicking Generate; the "+" button opens the Uploads and Generations panel, where earlier references can be picked (Generations tab, newest first). The viewer's Download button saves a full-size PNG, but Chrome leaves it as a hidden `.com.google.Chrome.*` file in `~/Downloads`; `file` shows what it is. Do not send two tool calls in one batch when the second depends on a file the first is writing (a page reload raced a CSS edit once).

## Earlier in this stretch (art round 4 cut and pushed)

**The game goes live from `dev`.** Every push to `dev` publishes to https://drew879.github.io/meltdown/ (decided 2026-11-20; see `BRIEF.md`). Drew changed the Pages settings on 2026-11-20 so `dev` can publish. Cloud sessions cannot re-run or start the workflow by hand (the Claude GitHub App gets a 403), so redeploy by pushing to `dev`.

- Live now (once the Step 2 push deploys): the whole game, playable on one phone. Names and match length, setup, handoff, play, result and match over, all driven by the engine and saved after every action. Nothing has been on a real phone yet except the earlier stand-in screen. The demo link `?a=Polar Bear&c=Animal&limit=6&g=ARE` still shows a round without saving (built with the real engine).
- The answer limit is 45 characters (engine, sign and checks). At the limit, letters are 22 px at Drew's phone size (440x956).
- The four engine calls are confirmed (`BRIEF.md`, 2026-11-20).
- **Home Screen icon: done (2026-11-20, local session on the Mac).** It is the nervous-face tile Drew chose from the round 2 sheet (top left of `art/concepts/round-2/5-app-icons.jpg`), used as drawn, not redrawn. `index.html` links `apple-touch-icon.png` (180 px), a 32 px favicon and `manifest.webmanifest` (name, standalone, theme colours, icons). Preview with the iOS corner mask: `docs/icon/home-screen-preview.png`. Not yet seen on Drew's phone: iOS caches the icon when a page is added, so he needs to remove any old Home Screen shortcut and add the page again. The manifest is a basic one; offline play and the update prompt are still Phase 5.
- **Fixed (2026-11-21): focus after "Keep playing" in Safari and iOS.** `check-game` had failed in the Mac's WebKit with "focus should go back to the New game button" (it passed in Chromium; `PW_CHROMIUM= node --import ./scripts/use-chromium.mjs scripts/check-game.mjs` runs it there, an empty `PW_CHROMIUM` makes the shim use Playwright's own Chromium). It was a real bug: `askNewGame` in `src/app/app.ts` returned focus to `document.activeElement`, but Safari and iOS do not focus a button when it is tapped, so that was the page itself (`BODY`) and focus was lost for VoiceOver and keyboard users. It now returns focus to the tapped button (the click event's `currentTarget`), falling back to the focused element for keyboard use. `npm run check` passes in WebKit at 320, 393 and 440 px. Rule of thumb: never read `document.activeElement` in a click handler to find the button that was clicked.

**Art round 4: cut and pushed to `dev` (2026-11-21); Drew has answered, and Phase 2 started with its win celebration.** Drew generated the four sheets (GPT Image 2.6, Unlimited, so no credits) and a local session on the Mac cut them. Lineups are in `docs/phase-2/`: `stage-3-redraw.png`, `stage-3-as-drawn.png`, `win-backflip.png`, `win-dance.png`, `cloud-and-flakes.png`, and `game-stages-2-3-4-easy.png` (the real game on Easy). Stage 3 is live in the melt; the backflip poses, cloud and flakes are used by the win celebration (below).

- **Stage 3 (`snowman-3`)** is the middle figure of `snowman-3-redraw.png`. Its hat sits straight, where every earlier stage's hat is tilted, and the cutter measures a hat by its widest row, so the sheet was cut 9.6% too small (689 px tall, shorter than stage 4's 729). `TWEAK` in `cut-art.mjs` scales it by 1.096 to correct that. Checked on Fable (2026-11-21): the hat's area is then within 1% of stage 2's (it only looks wider, 215 px against 205, because it is not tilted), the heights run 780, 755, 729, and the snow body runs 499, 487, 476 px across, so stage 3 steps evenly between its neighbours. It is 2% narrower than stage 2 where Drew asked for at least as wide; stage 4 is narrower again, so the run is consistent. The sheet's left figure is not a copy of stage 2 and its right figure is stage 5, not stage 4; neither is used.
- **Win poses** (`win-backflip-1..4`; read top left, top right, bottom left, bottom right): drawn 6 to 12% smaller than the fresh snowman by hat area, so `TWEAK` scales them by 1.10, putting every hat at 96 to 104% of stage 0's. Heights as a share of stage 0 (912 px): 65, 69, 74 and 91%. Backflip 1 (crouch) has a fierce frown and backflip 2 is upside down with the hat under the head. The dance (`win-dance.png`) was drawn, previewed and not chosen: its sheet stays in `art/layers/originals/` but is no longer cut, so its pieces are gone from `public/art/` (re-add its `SHEETS` entry and a 1.19 `TWEAK` to bring it back).
- **Cloud and six snowflakes** (`cloud` 900x416, `flake-1..6` about 330x370) cut cleanly and are used by the win celebration. Drew kept them (cloud and snow on).
- **Cutting changes:** the redraw sheet needs `join: 10` (at 12 or more the middle and right puddles merge into one piece). Crops now drop pixels that belong to a neighbouring island: stage 3 had 856 pixels of the left figure's arm tip in it. Only stage 3 was affected; every other piece re-cuts byte for byte.
- **Drew's replies (2026-11-21):** (1) The new stage 3 fixes the melt order, but **stages 3 and 4 look very similar**: the same face, body and scarf, and only the raised arm and one sweat bead set them apart (`docs/phase-2/stage-3-4-options.png` shows the options). **Drew chose to redraw stage 4, to be run by Claude with computer use in his Chrome, but not until he says he is done with his computer.** Wait for his word; do not start before. The prompt, references, settings and cutting steps are ready in `art/prompts/round-4b-stage-4-redraw.md`. Nothing in the game has changed for this yet. (2, 3) After watching a preview page he chose **the backflip, with the cloud and snow on and slow motion off** (his son's favorite), and said to go with it. He noticed the flip is not a true backflip: upside down he still faces us, where a real backflip seen from the front would show his back, and he goes from the squat to upside down in one frame. He called it good enough and chose to **keep it as it is**. A more convincing flip would need new poses (a rising stretch, a back view upside down, a tuck on the way down) or a side view; that is only needed if he changes his mind. He also said yes to dropping the dance pieces and to **starting Phase 2 with the win celebration**.
- **Phase 2, the win celebration, is built (2026-11-21) and pushed to `dev`; not yet on Drew's phone.** `src/paper/celebration-timeline.ts` holds it as data: the pose held at each moment (fresh, crouch at 0.25 s, three air frames from 0.7 s with the tucked pose turned about its middle, land at 1.3 s, finish with a hop at 1.7 s, a little bounce, rest at 4.25 s), the cloud rolling in over the sun from 0.3 to 1.7 s, and 30 flakes falling in 14 held steps from 1.3 s (two in three behind him so his face stays clear); everything is a pure function of the time since the celebration began, ends at 9.3 s, and the snow is seeded so it falls the same way every time. `src/paper/celebration.ts` draws one frame at a time (rAF) into a clipped box over the scene, standing where the plain snowman stands, at the same scale, with a shadow on the grass that shrinks as he rises. Wired in `src/paper/play.ts`: a live win starts it once the snowman's squash and spring back to full size has finished (`showStage` returns a promise for that; at once if he was already at full size), and the plain snowman is not faded out until the win pictures have loaded; a won round that is only on screen (a refresh, `?still`, reduced motion) shows how it ends (arms up, under the cloud, no snow); a round that is not won shows the plain snowman. The plain `#snowman` img stays in the DOM, faded out while the celebration plays, so its alt text is still read. The jump is clamped so he never goes through the top of a short screen (at 320x568 it is smaller). `check-game` covers the pose, the cloud, the end state, a refresh on a won round and a lost round; `celebration-timeline.test.ts` has 20 tests, including the lift clamp (`clampedLift`). Frames from the real game are in `docs/phase-2/celebration-live-440.png` and `-320.png` (a burst after a live win) and `docs/phase-2/celebration/`. It was first mocked up as a preview page (`celebrate.html`, deleted); `docs/phase-2/backflip-frames.png`, `dance-frames.png` and `snow-frames.png` came from that. Not done: the other Phase 2 pieces (melt beats between stages, the loss sequence), sound, and a more convincing flip (see above). Reduced motion shows the end state only. An independent review on Opus (2026-11-21) found nothing serious; its minor points were fixed (the start now waits for the spring-back, the snowman waits for the pictures, the clamp counts the squash and is tested, `stepped` copes with one step), except two it did not count as bugs of this change: at 568x320 landscape the play scene is 0 px tall, so everything in it is invisible, and the cloud passes over the thermometer on narrow screens (a design question).
- **Weight:** art is 2.09 MB (it was 1.46 MB before round 4; 2.54 MB until the dance was dropped). The win celebration's pictures (4 poses, cloud, 6 flakes, about 0.65 MB) are left out of `preloadArt()` in `src/paper/art.ts` and load when the play screen is made, so the first screen no longer waits for them. Every other piece, including all nine melt stages, is still fetched on every load.
- A stray Finder screenshot, `art/layers/originals/Pasted 2026-11-20 at 11.16.08 PM.png`, is untracked in the originals folder. It is not art and was not committed; Drew can delete it.

**Step 2, make it playable: built and pushed to `dev` on 2026-11-21; waiting for Drew to play it on his phone.** It ran in its own cloud session alongside art round 4. While both ran they split the files (this session: `index.html`, `src/` except the manifest, `scripts/check-*.mjs`, tests; the art round: `art/`, `public/art/`, the manifest, `cut-art.mjs`). That split ends when Step 2 is approved; fetch and merge `origin/dev` before every push regardless.

- **Shape:** `src/app/main.ts` starts `src/app/app.ts`, which holds the `GameState`, runs every tap through `reduce`, saves with `createSaveStore`, and shows the screen for `state.phase`. `play` and `result` share the play screen (`src/paper/play.ts`, the keys give way to a result panel a second after the last guess); the other phases are in `src/app/screens.ts`. `src/app/copy.ts` holds the wording (the seven loss headings, picked by round so a refresh shows the same one). The sign-fitting maths is `src/paper/sign-fit.ts`, the yard painting is `src/paper/yard.ts`, piece names are `src/paper/art.ts`.
- **Screens are plain on purpose** (cream cards, kraft chips, the snowman and sun in the yard). Designed versions come later, after mock-up options.
- **The setup draft** (typed answer, category, difficulty, hide) lives in memory only, never in the save. "Change the answer" on the handoff screen brings it back with the answer **hidden**, because the guesser may be holding the phone.
- **New game** is a small button between the name tags on every screen once a game has started, always behind a confirmation. The names screen has none (nothing to clear). A calm notice shows if storage is unavailable or a save could not be read.
- **Checks:** `npm run check` now also runs `scripts/check-game.mjs`, which plays whole games (win, loss, refresh at each phase, new game, a "1 game" match to its winner and a rematch, long names, storage trouble) at 320, 393 and 440 px with no console errors. Screenshots from it are in `docs/step-2/`. Reviewed on Opus; its findings (secret reappearing on the way back, category tag covering letters, focus and screen-reader gaps) are fixed.
- **Not tested, needs Drew's phone:** the on-screen keyboard over the setup form on iOS (whether Done stays reachable and how the page pans), WebKit itself (cloud sessions only have Chromium), the Home Screen app, and whether the screens feel right to a young reader.
- **Known rough edges:** at 320 px a name tag shows only about 60 px of the name (full names show on the setup and handoff headings, and the setting/guessing labels tell players apart); a very long custom category (up to 60 characters) wraps to two lines above the sign and touches the snowman's feet; no animated transitions between screens yet (Phase 2).

**Still open from Phase 1** (none of it blocks Step 2)

- Drew's sign change, done: the nail heads at the board's ends looked odd with nothing behind them, so `scripts/cut-art.mjs` paints them out (2026-11-20). The category tag's two nails, which sat above the board's top edge, are gone too (2026-11-21).
- Approval of Phase 1.
- First real-phone look (2026-11-20): the live page loads and looks good on Drew's iPhone.
- **Melt stage 3 ran backwards**, so it was redrawn in round 4 (cut and pushed 2026-11-21; see above). Drew saw the snowman get taller going into the arm-lift pose: the old stage 3 (`snowman-3-5.png`) had its hat above stage 2's (786 vs 780 px) and was slimmer and more upright; see `docs/phase-1/11-melt-stage-3.jpg`. The redraw is live and the heights now step down, but Drew has not yet confirmed it looks right on his phone.

**After Step 2:** the rest of Phase 2 (the win, the melt beats and the loss are built; the brief's idle animation, such as blinking, breathing and glancing at the sun, is not; then a code review and Drew's approval of the phase), designed versions of the new screens (mock-up options first), Phase 4 audio, the rest of Phase 5 (offline play, update prompt, README, moving the live site to `main`), and Phase 6 QA.

**Phase 3 engine:** built on Sonnet, reviewed on Fable and pushed (2026-11-19). Pure, UI-free TypeScript in `src/engine/` with 89 Vitest tests (`npm test`). Import everything from `src/engine/index.ts`; the flow is `reduce(state, action)` in `flow.ts`, saving is `createSaveStore` in `save.ts`. Not wired into any screen yet. The match rules are in `match.ts`.

**Known gaps**

- No landscape layout: at 568x320 the play scene is 0 px tall, so the snowman, sun and celebration are invisible (found in review, 2026-11-21; not new). The game is meant to be played upright.
- No iPad layout yet. Screens 320 px wide work but are cramped; a 24-letter single word there gets 9.5 px letters.
- Art is 2.68 MB in `public/art/` (2026-11-21; the welcome pieces added about 0.35 MB and round 7 0.18 MB), still over the target of well under 2 MB for the first load. The later melt stages should load after the first screen: `preloadArt()` in `src/paper/art.ts` fetches every piece in the manifest on every load except the win celebration's and the melt's loose pieces. Preload only what the current screen needs.
- The first direction (a beach, drawn in code) is still in the repo: `src/art/`, `src/ui/`, `direction/index.html`, `direction/play.html`, `direction/board.*`. It was replaced by the paper look and is not in the build. Delete it once Phase 1 is approved; ask first.

## How we work

- **The orchestrator session is Drew's main contact** (see the top of this file). Sub-sessions work one task each, report back to it, and push to `dev` only when the orchestrator says Drew has approved it. Two sub-sessions never edit the same files at once; one that may overlap another gets its own worktree.
- **Drew can't answer a sub-session.** He follows only the orchestrator, over Remote Control from his phone. A sub-session never uses question cards and never stops to wait for him. It makes sensible calls and lists them in its report for him to overrule. If it is truly blocked, it messages the orchestrator. The orchestrator turns Remote Control on for each sub-session it starts, so permission prompts can reach Drew, but nobody should count on that.
- **Sub-sessions sharing this folder commit with a pathspec** (`git commit -m "..." -- <paths>`; for new files, `git add <paths> && git commit -m "..." -- <paths>` in one command). A bare `git commit` would sweep in files another session has staged.
- **Running a sub-session on Fable:** `start_session` ignores a model above the orchestrator's (Opus), and a session's first turn runs on the model it started with. So start it, switch it with `set_session_model`, and give it the real work in its next turn.
- **Check in at the end of each phase and wait.** Do not start the next phase until Drew says so. If a question is open in either direction, confirm before building.
- **Push work in progress to `dev`; every push to `dev` goes live**, so keep it working. **Never push to `main`** without Drew's approval of that milestone. GitHub's default branch is `dev` only because the repo started empty; switch it to `main` at the first approved push.
- **Commit in small steps** with clear messages.
- **Never commit the son's name or age**, and never send them to an outside service. Mock-ups and test data use "Sam" and "Dad".
- **Look at your own work.** Take screenshots and read them before showing Drew. Run `npm run check` before every commit that touches the play screen.
- **Show Drew options before building a look.** For visual direction he wants several generated alternatives to choose from first.
- **The quality bar** is "stylized, professional, and polished", never "AI slop cartoons". Do not trade quality for convenience.
- If you fail twice at the same problem, stop and say so. Drew may move the task to a more capable model.

## How a check-in looks

Drew reviews on his iPhone, on the same Wi-Fi as the Mac. A check-in gives him:

- Screenshots sent as files, saved in `docs/phase-<n>/`. Where a mock-up exists, a side-by-side of the mock-up and the real screen.
- The phone link: https://drew879.github.io/meltdown/ once the work is pushed to `dev` (a few minutes after the push). For work not yet pushed, `http://<the Mac's Wi-Fi address>:5173/meltdown/<page>` (find the address with `ipconfig getifaddr en0`); start the dev server first, it is not left running between sessions.
- What changed, what falls short or is not done, and what was and was not tested. Say plainly when something has not been on a real phone.
- Any cost in Higgsfield credits.
- His open questions as a numbered plaintext block he can copy, fill in and send back.

Keep sessions short: one phase or one task each. A long session costs more on every message.

When another session's work is reviewed, the reviewer runs its tests and also writes a few checks of its own without reading the existing tests.

## Commands

```bash
npm run dev      # dev server on the local network, http://localhost:5173/meltdown/
npm run check    # type-check, tap through a round, fit-test the sign, and play whole games (needs the dev server running)
npm run art      # cut the generated sheets into the pieces in public/art/
npm run icon     # resize art/icon/icon-master.png into the Home Screen icon files in public/
npm run build    # type-check and build
npm test         # engine unit tests (Vitest)
```

`node scripts/shot.mjs <url> <out.png> [width] [height] [scale] [chromium|webkit] [selector]` takes a screenshot and fails on console errors. Add `?still` to a page's URL to freeze animation for screenshots.

Cloud sessions have Chromium but no WebKit. Preload `scripts/use-chromium.mjs` to run the checks there: `node --import ./scripts/use-chromium.mjs scripts/check-play.mjs`. Set `MELTDOWN_URL` to check another server, such as `npx vite preview` at `http://localhost:4173/meltdown/`.

The site is served under `/meltdown/` in development too, to match `https://drew879.github.io/meltdown/`.

## Map

| Path | What it is |
| --- | --- |
| `BRIEF.md` | The brief and every decision since. Add new decisions there, dated. |
| `BACKLOG.md` | Feature ideas and feedback to pick up later. Add new ones there; move built ones to "Done". |
| `index.html`, `src/app/` | The front page and the app: `app.ts` (state, saving, confirmation, notices), `screens.ts` + `screens.css` (names, setup, handoff, match over), `header.ts`, `copy.ts`, `dom.ts`. Demo link, never saved: `?a=answer&c=category&limit=4,6 or 8&g=letters already guessed`. |
| `src/paper/play.ts` | The play and result screen, reading the engine's round. `sign-fit.ts`, `yard.ts` and `art.ts` sit beside it. |
| `src/paper/celebration.ts`, `celebration-timeline.ts`, `celebration.css` | The win celebration: the timeline as pure functions of time (with tests), and the drawing of it over the play screen's scene. |
| `.github/workflows/deploy.yml` | Tests, builds and publishes every push to `dev` to GitHub Pages. |
| `src/paper/paper.css` | The paper look: name tags, sign, keys, tray, thermometer. |
| `src/paper/art-manifest.json` | Sizes of the cut pieces. Written by `npm run art`; do not edit by hand. |
| `public/art/` | The cut pieces the game loads (WebP). Written by `npm run art`. |
| `public/apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `favicon-32.png`, `manifest.webmanifest` | The Home Screen icon and web app manifest. The PNGs are written by `npm run icon`. |
| `art/icon/icon-master.png` | The icon at full size, square with no transparency. Cut from the round 2 concept sheet with `node scripts/make-icon.mjs --from-sheet` (needs that local original). |
| `art/layers/originals/` | Full-size generated sheets, stored with Git LFS. |
| `art/prompts/` | Every image prompt, with which model, settings and reference images. |
| `art/concepts/` | Mock-ups from the direction rounds. Reference only; they never ship. |
| `docs/phase-1/`, `docs/phase-2/` | Screenshots and lineups shown to Drew at check-ins (`phase-2` holds the round 4 art). |
| `scripts/` | `cut-art.mjs`, `make-icon.mjs`, `lineup.mjs` (cut pieces side by side on one baseline), `shot.mjs`, `check-play.mjs`, `check-sign.mjs`, `check-game.mjs`, `use-chromium.mjs`. |

## How the art is made

1. A sheet of several pieces is generated on a transparent background (prompts in `art/prompts/round-3-layers.md`).
2. The PNG goes in `art/layers/originals/`.
3. `scripts/cut-art.mjs` finds each piece as an island of opaque pixels, names them from its `SHEETS` list, scales them and writes WebP files plus the manifest.
4. The page positions and swaps the pieces in code. Text is always live type, never baked into art.

Rules of thumb that cost time to learn:

- **Melt stages:** nine pictures, 0 (fresh) to 8 (puddle), shared by all difficulties. A round with N misses allowed shows stage `round(misses * 8 / N)`. All nine are cut to one scale, taken from the hat's width.
- **Check a new sheet before trusting its names:** `npm run art -- --list` must show the expected count. Two figures whose edges touch within `join` pixels come out as one piece (round 4's stage 3 sheet needed `join: 10`); lower `join` until they split. A crop drops pixels of any neighbouring piece, so a close neighbour's arm tip cannot leak in.
- **Sizes are judged against the neighbouring stage, not the sheet.** A sheet's scale comes from its widest hat, measured as the most black pixels on one row, so a hat that sits straight reads wider than a tilted one and its sheet is cut about 10% small (round 4's stage 3 and win poses). Compare hats by area, not width. Check with `node scripts/lineup.mjs out.png <pieces...>` (heights are printed under each) and correct with `TWEAK` in `cut-art.mjs`, with a comment saying why.
- **The sign:** one board holding one to three rows. Three board pictures exist (long, medium, tall); the script picks the closest shape, keeps the ragged ends as drawn and stretches only the middle. Rows are split so the longest is as short as possible. The cutting script paints out the nail heads drawn at the board's ends.
- **Motion** is stop-motion: stepped poses (`steps()`), not smooth glides. Honour `prefers-reduced-motion`.

## Generating images (Higgsfield)

Use models that are unlimited on Drew's plan first, so nothing costs credits. State the credit cost before any paid run.

- The Higgsfield connector refuses unlimited generations from Claude Code. The free route is the website in Drew's Chrome: `https://higgsfield.ai/ai/image`, pick a model with the UNLIMITED badge, turn on the Unlimited switch, and confirm the Generate button reads UNLIMITED before each click. A page reload turns the switch off.
- Unlimited mode fixes quality at Medium and 2K and runs one image at a time. Medium has been good enough to ship. The Transparent background option gives real transparency.
- Earlier generations can be attached as style references from the "+" button, Generations tab. Always attach one, or pieces drift from the look.
- GPT Image 2.6 was unlimited on a 7-day grant ending 2026-11-26. Re-check the badges; the list changes.
- If the website gives trouble, ask Drew to run the generation himself; do not fall back to credits silently.

## Things that will bite later

- **Deploy:** changing `.github/workflows/` from the Mac needs `gh auth refresh -s workflow` first, because Drew's `gh` token lacks that scope. Pushes from cloud sessions through the Claude GitHub App could add the workflow (2026-11-20).
- **Pages branch rule:** Pages deploys only from branches its `github-pages` environment allows (Settings > Environments > github-pages). On 2026-11-20 it did not allow `dev`, even though `dev` is the default branch, and the first deploy was refused. Keep `dev` on that list, including when the default branch moves to `main`.
- **Pages build:** it needs only `public/art/`, so its checkout does not fetch LFS files.
- **Checking the live site:** the first successful deploy was run 3 on 2026-11-20. Cloud sessions cannot load `drew879.github.io` (the network policy blocks it), so they confirm a deploy from the Actions run and Drew checks the page on his phone.
- **Git LFS** is turned on for this clone only (`git lfs install --local`).
- **Re-cutting art in a fresh clone:** the originals arrive as LFS pointer files. Run `git lfs pull` before `npm run art`, or every sheet it cannot read is skipped and its pieces drop out of the manifest. With the originals present, a re-cut reproduces the committed pieces byte for byte (checked 2026-11-20), so `git status` shows exactly what a change touched.
- **Audio (Phase 4):** sound must play with the iPhone silent switch on. Music is written as MIDI, then rebuilt in Ableton Live 12 and exported as stems; Claude controls Live only when Drew says he is free. Claude cannot hear, so Drew's ears are the test.
- **Devices:** iPhone 16 Pro Max opened from a Home Screen icon is the main target; a 2018 iPad Pro is the performance floor. Support iOS 17 and later.

## Which model does what

Drew's plan, to be adjusted as results come in:

| Work | Model | Effort |
| --- | --- | --- |
| Art direction, judging screenshots and generated art, image prompts, check-ins | Fable | high |
| Animation feel (Phase 2) | Fable | high |
| Design decisions: engine shape, screen flow, save format | Opus | high |
| Engine, validation, save and load, unit tests | Sonnet | medium |
| Building screens from the approved look | Sonnet, Opus if layouts drift | medium to high |
| Music, Ableton set files, seamless loops | Opus, Fable if it stalls | high |
| Home Screen app, offline, icons, deploy workflow, README | Sonnet | medium |
| Browser tests and bug fixes | Sonnet, then an Opus review | medium |
| Mechanical jobs: re-cutting art, retaking screenshots | Sonnet or Haiku | low |

Only one session edits a given set of files at a time. Each finished phase gets a `/code-review high` on Opus or Fable before Drew approves it.
