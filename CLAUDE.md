# Meltdown: handoff notes

A pass-and-play word-guessing game for two people on one phone. Wrong guesses melt a snowman. Built for Drew and his young son, a new reader.

Read `BRIEF.md` before doing anything. It is the source of truth: the original brief, then three dated sections of decisions that override it. This file only says where things stand and how to work here.

**Every session ends by updating "Where things stand" below**, so the next session, on any model, can pick up without the conversation.

## Where things stand (updated 2026-11-21)

**The game goes live from `dev`.** Every push to `dev` publishes to https://drew879.github.io/meltdown/ (decided 2026-11-20; see `BRIEF.md`). Drew changed the Pages settings on 2026-11-20 so `dev` can publish. Cloud sessions cannot re-run or start the workflow by hand (the Claude GitHub App gets a 403), so redeploy by pushing to `dev`.

- Live now: the Phase 1 stand-in round is the front page (`index.html`, code in `src/paper/play.ts`). The answer comes from the URL and the names and scores are fixed, so it is not a playable game yet.
- The answer limit is 45 characters (engine, sign and checks). At the limit, letters are 22 px at Drew's phone size (440x956).
- The four engine calls are confirmed (`BRIEF.md`, 2026-11-20).

**Now: art round 4, which Drew is running** (agreed 2026-11-20). Prompts in `art/prompts/round-4-stage-3-and-win.md`: melt stage 3 redrawn (keeping the waving arm), and two win-celebration options (a backflip, a little dance) for Drew to pick from, plus an optional cloud and snowflakes. Drew saves his picks in `art/layers/originals/` as `snowman-3-redraw.png`, `win-backflip.png`, `win-dance.png` and `win-sky.png`, which are already in `SHEETS` in `scripts/cut-art.mjs` (the redraw replaces stage 3 when present). He may cut and push them himself from the Mac. Then show him a lineup of stages 2 to 4 and the two celebrations side by side.

**In progress: Step 2, make it playable.** Drew asked on 2026-11-21 for it to run in a separate cloud session, alongside art round 4. While both run, they split the files: the Step 2 session owns `index.html`, `src/` (except `src/paper/art-manifest.json`), `scripts/check-*.mjs` and the tests; the art round owns `art/`, `public/art/`, `src/paper/art-manifest.json` and `scripts/cut-art.mjs`. Both push to `dev`, so fetch and merge `origin/dev` before every push, and push only builds that work, because each push goes live.

- One app page that shows the screen for `state.phase`, driven by `reduce` in `src/engine/flow.ts`, saving after every action with `createSaveStore`.
- The play screen reads the engine's round instead of its own stand-in rules, with real names and scores.
- Plain screens built from the paper pieces that exist, with no new art: names and match length; setup (answer with a hide toggle, category with Other, difficulty preset to the setter's last pick); handoff (who is guessing, the difficulty, "It's me", a way back); result (heading, the full answer with missed letters marked, Next round); match over (winner, Rematch, New game). New game sits behind a confirmation on every screen. A calm notice shows if storage is unavailable.
- A browser check that plays full rounds (win, loss, refresh mid-round, new game) at 320, 393 and 440 px.
- Then a code review, a push to `dev`, and Drew plays it on his phone.

**Still open from Phase 1** (none of it blocks Step 2)

- Drew's sign change, done: the nail heads at the board's ends looked odd with nothing behind them, so `scripts/cut-art.mjs` paints them out (2026-11-20). The category tag's two nails, which sat above the board's top edge, are gone too (2026-11-21).
- Approval of Phase 1.
- First real-phone look (2026-11-20): the live page loads and looks good on Drew's iPhone.
- **Melt stage 3 runs backwards** (being redrawn in round 4). Drew saw the snowman get taller going into the arm-lift pose. Stage 3 came from a different sheet (`snowman-3-5.png`): its hat sits above stage 2's (786 vs 780 px), and it is slimmer and more upright with a waving arm. Shrinking it to 94% fixes the height but leaves a smaller hat and a slimmer body, so 3 to 4 then looks like widening; see `docs/phase-1/11-melt-stage-3.jpg`. Drew chose a redraw (not the shrink), in the same round as the win poses.

**After Step 2:** Phase 2 animation (melt beats, the win celebration with new poses, the loss sequence), designed versions of the new screens (mock-up options first), Phase 4 audio, the rest of Phase 5 (icon, offline play, update prompt, README, moving the live site to `main`), and Phase 6 QA.

**Phase 3 engine:** built on Sonnet, reviewed on Fable and pushed (2026-11-19). Pure, UI-free TypeScript in `src/engine/` with 89 Vitest tests (`npm test`). Import everything from `src/engine/index.ts`; the flow is `reduce(state, action)` in `flow.ts`, saving is `createSaveStore` in `save.ts`. Not wired into any screen yet. The match rules are in `match.ts`.

**Known gaps**

- No iPad layout yet. Screens 320 px wide work but are cramped; a 24-letter single word there gets 9.5 px letters.
- Art is 1.46 MB. The target is well under 2 MB for the first load, so later melt stages should load after the first screen. `src/paper/play.ts` preloads every piece in the manifest, so once the round 4 win poses are cut it will also fetch them on every load; preload only what the current screen needs.
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
npm run check    # type-check, tap through a round, and fit-test the sign (needs the dev server running)
npm run art      # cut the generated sheets into the pieces in public/art/
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
| `index.html`, `src/paper/play.ts` | The front page: the play screen, with stand-in game rules. Query: `?a=answer&c=category&limit=4,6 or 8&g=letters already guessed`. |
| `.github/workflows/deploy.yml` | Tests, builds and publishes every push to `dev` to GitHub Pages. |
| `src/paper/paper.css` | The paper look: name tags, sign, keys, tray, thermometer. |
| `src/paper/art-manifest.json` | Sizes of the cut pieces. Written by `npm run art`; do not edit by hand. |
| `public/art/` | The cut pieces the game loads (WebP). Written by `npm run art`. |
| `art/layers/originals/` | Full-size generated sheets, stored with Git LFS. |
| `art/prompts/` | Every image prompt, with which model, settings and reference images. |
| `art/concepts/` | Mock-ups from the direction rounds. Reference only; they never ship. |
| `docs/phase-1/` | Screenshots shown to Drew at check-ins. |
| `scripts/` | `cut-art.mjs`, `shot.mjs`, `check-play.mjs`, `check-sign.mjs`, `use-chromium.mjs`. |

## How the art is made

1. A sheet of several pieces is generated on a transparent background (prompts in `art/prompts/round-3-layers.md`).
2. The PNG goes in `art/layers/originals/`.
3. `scripts/cut-art.mjs` finds each piece as an island of opaque pixels, names them from its `SHEETS` list, scales them and writes WebP files plus the manifest.
4. The page positions and swaps the pieces in code. Text is always live type, never baked into art.

Rules of thumb that cost time to learn:

- **Melt stages:** nine pictures, 0 (fresh) to 8 (puddle), shared by all difficulties. A round with N misses allowed shows stage `round(misses * 8 / N)`. All nine are cut to one scale, taken from the hat's width.
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
