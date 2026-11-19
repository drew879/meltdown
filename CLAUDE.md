# Meltdown: handoff notes

A pass-and-play word-guessing game for two people on one phone. Wrong guesses melt a snowman. Built for Drew and his young son, a new reader.

Read `BRIEF.md` before doing anything. It is the source of truth: the original brief, then three dated sections of decisions that override it. This file only says where things stand and how to work here.

**Every session ends by updating "Where things stand" below**, so the next session, on any model, can pick up without the conversation.

## Where things stand (updated 2026-11-19)

**Phase 1 (direction) is not approved yet.** Drew is reviewing the play screen built in the cut-paper look.

- Done and pushed: a tappable stand-in round at `direction/paper.html`, in the approved look. One garden sign with up to three rows, nine melt stages, four sun moods, square keys in a paper tray.
- Waiting on Drew:
  1. He said "I have changes" to the single-sign version and has not listed them yet. Ask; do not guess.
  2. Answer limit: keep 60 characters (16 px letters at the limit on his phone) or lower to 45.
  3. Approval of Phase 1, then the go-ahead for Phase 2.
- Nothing has been tried on a real phone. All checks so far are WebKit and Chromium through Playwright.

**Next, once Phase 1 is approved**

- Phase 2: animated melt beats between stages, the win celebration (snowman restored, then a silly dance or backflip; needs new poses), and the loss sequence.
- Phase 3 engine: **built on Sonnet, reviewed on Fable and pushed** (2026-11-19). Pure, UI-free TypeScript in `src/engine/` with 89 Vitest tests (`npm test`). Import everything from `src/engine/index.ts`; the flow is `reduce(state, action)` in `flow.ts`, saving is `createSaveStore` in `save.ts`. Not wired into any screen yet. Calls made where the brief was silent, for Drew to confirm: a "1 game" match can end in a draw; a rematch keeps the names and each player's last difficulty; letters that do not fold to one A to Z letter (ß, æ, ø) are rejected like other alphabets; the default match length is Endless. The match rules are in `match.ts`.

**Known gaps**

- No iPad layout yet. Screens 320 px wide work but are cramped.
- Art is 1.5 MB. The target is well under 2 MB for the first load, so later melt stages should load after the first screen.
- The first direction (a beach, drawn in code) is still in the repo: `src/art/`, `src/ui/`, `direction/index.html`, `direction/play.html`, `direction/board.*`. It was replaced by the paper look. Delete it once Phase 1 is approved; ask first.

## How we work

- **Check in at the end of each phase and wait.** Do not start the next phase until Drew says so. If a question is open in either direction, confirm before building.
- **Push work in progress to `dev`. Never push to `main`** without Drew's approval of that milestone. GitHub's default branch is `dev` only because the repo started empty; switch it to `main` at the first approved push.
- **Commit in small steps** with clear messages.
- **Never commit the son's name or age**, and never send them to an outside service. Mock-ups and test data use "Sam" and "Dad".
- **Look at your own work.** Take screenshots and read them before showing Drew. Run `npm run check` before every commit that touches the play screen.
- **Show Drew options before building a look.** For visual direction he wants several generated alternatives to choose from first.
- **The quality bar** is "stylized, professional, and polished", never "AI slop cartoons". Do not trade quality for convenience.
- If you fail twice at the same problem, stop and say so. Drew may move the task to a more capable model.

## Commands

```bash
npm run dev      # dev server on the local network, http://localhost:5173/meltdown/
npm run check    # type-check, tap through a round, and fit-test the sign (needs the dev server running)
npm run art      # cut the generated sheets into the pieces in public/art/
npm run build    # type-check and build
npm test         # engine unit tests (Vitest)
```

`node scripts/shot.mjs <url> <out.png> [width] [height] [scale] [chromium|webkit] [selector]` takes a screenshot and fails on console errors. Add `?still` to a page's URL to freeze animation for screenshots.

The site is served under `/meltdown/` in development too, to match `https://drew879.github.io/meltdown/`.

## Map

| Path | What it is |
| --- | --- |
| `BRIEF.md` | The brief and every decision since. Add new decisions there, dated. |
| `direction/paper.html`, `direction/paper.ts` | The play screen, with stand-in game rules. Query: `?a=answer&c=category&limit=4,6 or 8&g=letters already guessed`. |
| `src/paper/paper.css` | The paper look: name tags, sign, keys, tray, thermometer. |
| `src/paper/art-manifest.json` | Sizes of the cut pieces. Written by `npm run art`; do not edit by hand. |
| `public/art/` | The cut pieces the game loads (WebP). Written by `npm run art`. |
| `art/layers/originals/` | Full-size generated sheets, stored with Git LFS. |
| `art/prompts/` | Every image prompt, with which model, settings and reference images. |
| `art/concepts/` | Mock-ups from the direction rounds. Reference only; they never ship. |
| `docs/phase-1/` | Screenshots shown to Drew at check-ins. |
| `scripts/` | `cut-art.mjs`, `shot.mjs`, `check-play.mjs`, `check-sign.mjs`. |

## How the art is made

1. A sheet of several pieces is generated on a transparent background (prompts in `art/prompts/round-3-layers.md`).
2. The PNG goes in `art/layers/originals/`.
3. `scripts/cut-art.mjs` finds each piece as an island of opaque pixels, names them from its `SHEETS` list, scales them and writes WebP files plus the manifest.
4. The page positions and swaps the pieces in code. Text is always live type, never baked into art.

Rules of thumb that cost time to learn:

- **Melt stages:** nine pictures, 0 (fresh) to 8 (puddle), shared by all difficulties. A round with N misses allowed shows stage `round(misses * 8 / N)`. All nine are cut to one scale, taken from the hat's width.
- **The sign:** one board holding one to three rows. Three board pictures exist (long, medium, tall); the script picks the closest shape, keeps the ragged ends as drawn and stretches only the middle. Rows are split so the longest is as short as possible.
- **Motion** is stop-motion: stepped poses (`steps()`), not smooth glides. Honour `prefers-reduced-motion`.

## Generating images (Higgsfield)

Use models that are unlimited on Drew's plan first, so nothing costs credits. State the credit cost before any paid run.

- The Higgsfield connector refuses unlimited generations from Claude Code. The free route is the website in Drew's Chrome: `https://higgsfield.ai/ai/image`, pick a model with the UNLIMITED badge, turn on the Unlimited switch, and confirm the Generate button reads UNLIMITED before each click. A page reload turns the switch off.
- Unlimited mode fixes quality at Medium and 2K and runs one image at a time. Medium has been good enough to ship. The Transparent background option gives real transparency.
- Earlier generations can be attached as style references from the "+" button, Generations tab. Always attach one, or pieces drift from the look.
- GPT Image 2.6 was unlimited on a 7-day grant ending 2026-11-26. Re-check the badges; the list changes.
- If the website gives trouble, ask Drew to run the generation himself; do not fall back to credits silently.

## Things that will bite later

- **Deploy:** Drew's `gh` token lacks the `workflow` scope. Before the Actions workflow can be pushed (Phase 5) he must run `gh auth refresh -s workflow`.
- **Pages build:** it needs only `public/art/`, so its checkout should not fetch LFS files.
- **Git LFS** is turned on for this clone only (`git lfs install --local`).
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
