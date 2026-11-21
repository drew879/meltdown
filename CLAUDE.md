# Meltdown: handoff notes

A pass-and-play word-guessing game for two people on one phone. Wrong guesses melt a snowman. Built for Drew and his young son, a new reader.

Read `BRIEF.md` before doing anything. It is the source of truth: the original brief, then three dated sections of decisions that override it. This file only says where things stand and how to work here.

**Every session ends by updating "Where things stand" below**, so the next session, on any model, can pick up without the conversation.

## Where things stand (updated 2026-11-21, art round 4 cut and pushed)

**The game goes live from `dev`.** Every push to `dev` publishes to https://drew879.github.io/meltdown/ (decided 2026-11-20; see `BRIEF.md`). Drew changed the Pages settings on 2026-11-20 so `dev` can publish. Cloud sessions cannot re-run or start the workflow by hand (the Claude GitHub App gets a 403), so redeploy by pushing to `dev`.

- Live now (once the Step 2 push deploys): the whole game, playable on one phone. Names and match length, setup, handoff, play, result and match over, all driven by the engine and saved after every action. Nothing has been on a real phone yet except the earlier stand-in screen. The demo link `?a=Polar Bear&c=Animal&limit=6&g=ARE` still shows a round without saving (built with the real engine).
- The answer limit is 45 characters (engine, sign and checks). At the limit, letters are 22 px at Drew's phone size (440x956).
- The four engine calls are confirmed (`BRIEF.md`, 2026-11-20).
- **Home Screen icon: done (2026-11-20, local session on the Mac).** It is the nervous-face tile Drew chose from the round 2 sheet (top left of `art/concepts/round-2/5-app-icons.jpg`), used as drawn, not redrawn. `index.html` links `apple-touch-icon.png` (180 px), a 32 px favicon and `manifest.webmanifest` (name, standalone, theme colours, icons). Preview with the iOS corner mask: `docs/icon/home-screen-preview.png`. Not yet seen on Drew's phone: iOS caches the icon when a page is added, so he needs to remove any old Home Screen shortcut and add the page again. The manifest is a basic one; offline play and the update prompt are still Phase 5.
- **Known, not fixed: `check-game` fails in the Mac's WebKit with "focus should go back to the New game button"** after tapping Keep playing, at all three widths. It passes in Chromium (checked 2026-11-21 on the Mac: `PW_CHROMIUM= node --import ./scripts/use-chromium.mjs scripts/check-game.mjs`; an empty `PW_CHROMIUM` makes the shim use Playwright's own Chromium, which is installed). So the failure is WebKit, and it is real: `askNewGame` in `src/app/app.ts` takes `document.activeElement` as the button to return focus to, but Safari and iOS do not focus a button when it is tapped, so focus falls back to the page. Fix: remember the tapped button (the click's `currentTarget`) and focus that on close. Matters for VoiceOver and keyboard users on Safari. Left because it is outside art round 4's files.

**Art round 4: cut and pushed to `dev` (2026-11-21); waiting for Drew's answers.** Drew generated the four sheets (GPT Image 2.6, Unlimited, so no credits) and a local session on the Mac cut them. Lineups are in `docs/phase-2/`: `stage-3-redraw.png`, `stage-3-as-drawn.png`, `win-backflip.png`, `win-dance.png`, `cloud-and-flakes.png`, and `game-stages-2-3-4-easy.png` (the real game on Easy). Nothing in the game uses the new pieces yet, except stage 3 in the melt.

- **Stage 3 (`snowman-3`)** is the middle figure of `snowman-3-redraw.png`. The prompt put a copy of stage 5, not stage 4, on the sheet's right, so the middle figure came out 689 px tall, shorter than stage 4's 729. It is scaled up 9.6% (`TWEAK` in `cut-art.mjs`) to 755 px, so the heights run 780, 755, 729 and the hat tops step down evenly in the game. Its hat is 215 px wide against 205 (stage 2) and 193 (stage 4). It is 606 wide against stage 2's 632 (4% narrower): no one scale makes it shorter than 2, taller than 4 and as wide as 2. Set `'snowman-3': 1` to go back to the figure as drawn.
- **Win poses** (`win-backflip-1..4`, `win-dance-1..4`; read top left, top right, bottom left, bottom right): drawn 6 to 19% smaller than the fresh snowman by hat area, so `TWEAK` scales backflip by 1.10 and dance by 1.19, putting every hat at 96 to 104% of stage 0's. Heights as a share of stage 0 (912 px): backflip 65, 69, 74 and 91%; dance 98, 97, 107 and 103%. The dance poses are the more on-model pair. Backflip 1 (crouch) has a fierce frown and backflip 2 is upside down with the hat under the head, which may read oddly. Dance 3 holds the hat just above the head with a hand still on it.
- **Cloud and six snowflakes** cut cleanly (`cloud` 900x416, `flake-1..6` about 330x370). Drew decides whether they are worth keeping.
- **Cutting changes:** the redraw sheet needs `join: 10` (at 12 or more the middle and right puddles merge into one piece). Crops now drop pixels that belong to a neighbouring island: stage 3 had 856 pixels of the left figure's arm tip in it. Only stage 3 was affected; every other piece re-cuts byte for byte.
- **Open, for Drew:** does the new stage 3 fix the melt order; backflip or dance; keep the cloud and flakes. Once he picks, remove the unused celebration's entries from `SHEETS` and re-cut so its pieces stop loading (ask first). Phase 2 has not started.
- **Weight:** art is now 2.54 MB (was 1.46 MB): the win poses add about 0.9 MB and the cloud and flakes 0.25 MB. `preloadArt()` in `src/paper/art.ts` (called from `src/app/app.ts`) fetches every piece in the manifest on every page load, so all of that downloads on first load until preloading is changed to load only what the current screen needs.
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

**After Step 2:** Phase 2 animation (melt beats, the win celebration with new poses, the loss sequence), designed versions of the new screens (mock-up options first), Phase 4 audio, the rest of Phase 5 (offline play, update prompt, README, moving the live site to `main`), and Phase 6 QA.

**Phase 3 engine:** built on Sonnet, reviewed on Fable and pushed (2026-11-19). Pure, UI-free TypeScript in `src/engine/` with 89 Vitest tests (`npm test`). Import everything from `src/engine/index.ts`; the flow is `reduce(state, action)` in `flow.ts`, saving is `createSaveStore` in `save.ts`. Not wired into any screen yet. The match rules are in `match.ts`.

**Known gaps**

- No iPad layout yet. Screens 320 px wide work but are cramped; a 24-letter single word there gets 9.5 px letters.
- Art is 2.54 MB, over the target of well under 2 MB for the first load. Later melt stages, the win poses and the cloud and flakes should load after the first screen: `preloadArt()` in `src/paper/art.ts` fetches every piece in the manifest on every load. Preload only what the current screen needs.
- The first direction (a beach, drawn in code) is still in the repo: `src/art/`, `src/ui/`, `direction/index.html`, `direction/play.html`, `direction/board.*`. It was replaced by the paper look and is not in the build. Delete it once Phase 1 is approved; ask first.

## How we work

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
- **Sizes are judged against the neighbouring stage, not the sheet.** A sheet's scale comes from its widest hat, so a figure can still land the wrong size next to a stage from another sheet. Check with `node scripts/lineup.mjs out.png <pieces...>` (heights are printed under each) and correct with `TWEAK` in `cut-art.mjs`, with a comment saying why.
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
