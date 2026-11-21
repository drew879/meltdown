// Plays whole games in a browser, through the real screens, at three phone
// widths, and fails if anything is off or the page logs an error.
//
//   npm run dev            (in another terminal; the page must be served)
//   node scripts/check-game.mjs [folder for screenshots]
//
// In a cloud session (Chromium only): node --import ./scripts/use-chromium.mjs scripts/check-game.mjs
//
// It covers: names, setup, handoff, a won round, a lost round, a refresh in the
// middle of a round, a new game behind its confirmation, a "1 game" match played
// to its winner and a rematch, and the notices for a phone that cannot save.
// The melt: the beat on a wrong guess, quick taps during it, the loss (the hat
// left hanging) and how long it takes, the answer staying off the sign until
// it ends, a tap to skip it, a refresh on a lost round, and a phone that asks
// for reduced motion. Once, at one size: the melt's pieces left out of the
// first load and fetched with the play screen, the New game confirmation's
// keys while the melt plays, a resize during it, and a new game cutting it off.
// Made-up names only: Sam and Dad.
import { webkit } from '@playwright/test';

const URL = process.env.MELTDOWN_URL ?? 'http://localhost:5173/meltdown/';
const shots = process.argv[2];
const SIZES = [
  [320, 568],
  [393, 852],
  [440, 956],
];
const LOSS_HEADINGS = ['OH DEAR!', 'MY GOD!', "HE'S... GONE!", 'R.I.P. SNOWMAN!', 'WHAT HAVE YOU DONE!?', 'SPLOOSH!', 'BYE BYE!'];

const problems = [];
const expect = (ok, what) => ok || problems.push(what);

if (!(await fetch(URL).then((r) => r.ok, () => false))) {
  console.error(`Nothing is answering at ${URL}. Start the dev server first: npm run dev`);
  process.exit(1);
}

const browser = await webkit.launch();

/** A fresh phone: its own storage, so games never leak from one run into the next. */
async function newPhone(w, h, label, { init, reducedMotion } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const where = `${label} at ${w}x${h}`;
  page.on('console', (m) => m.type() === 'error' && problems.push(`${where}: console error: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${where}: page error: ${e}`));
  const say = (ok, what) => expect(ok, `${where}: ${what}`);
  const shot = async (name) => shots && (await page.screenshot({ path: `${shots}/${w}-${name}.png` }));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { context, page, say, shot, where, w, h };
}

const text = (page) => page.evaluate(() => document.body.innerText);
const saved = (page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('meltdown:save');
    return raw ? JSON.parse(raw).state : null;
  });

/** The page must never scroll sideways, and the play screen must never scroll at all. */
async function fits(p, what, { playScreen = false } = {}) {
  const r = await p.page.evaluate(() => ({
    sideways: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
    tall: document.documentElement.scrollHeight > innerHeight,
    spilling: [...document.querySelectorAll('.pp-card *, .pp-result *, .pp-dialog *')].filter(
      (n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX === 'visible' && !n.matches('input'),
    ).length,
    overflowing: [...document.querySelectorAll('.pp-card, .pp-tray, .pp-result, .pp-tags, .pp-board, .pp-dialog')].filter((n) => {
      const b = n.getBoundingClientRect();
      return b.right > innerWidth + 1 || b.left < -1;
    }).length,
  }));
  p.say(!r.sideways, `${what}: the page scrolls sideways`);
  p.say(r.spilling === 0, `${what}: text spills out of its card (${r.spilling} element(s))`);
  p.say(r.overflowing === 0, `${what}: ${r.overflowing} piece(s) run off the side of the screen`);
  if (playScreen) p.say(!r.tall, `${what}: the play screen scrolls`);
}

async function enterNames(p, first, second, length) {
  await p.page.getByLabel('First player').fill(first);
  await p.page.getByLabel('Second player').fill(second);
  if (length) await p.page.locator('label.pp-chip', { hasText: length }).click();
  await p.page.getByRole('button', { name: "Let's play" }).click();
}

async function setSecret(p, { answer, category, difficulty, custom }) {
  await p.page.getByLabel('The secret answer').fill(answer);
  await p.page.locator('label.pp-chip', { hasText: category }).click();
  if (custom) await p.page.getByLabel('Your own category').fill(custom);
  if (difficulty) await p.page.locator('label.pp-chip', { hasText: difficulty }).click();
  await p.page.getByRole('button', { name: 'Done', exact: true }).click();
}

const tap = (p, ch) => p.page.locator(`.pp-key:text-is("${ch}")`).click();
async function guessAll(p, letters) {
  for (const ch of letters) {
    await tap(p, ch);
    await p.page.waitForTimeout(120);
  }
  await p.page.waitForTimeout(1300); // the keys step aside for the result a moment after the last guess
}

const snowmanSrc = (page) => page.evaluate(() => document.getElementById('snowman').getAttribute('src'));
const celebrationPose = (page) => page.evaluate(() => document.querySelector('.pp-cel-actor img:not([hidden])')?.getAttribute('src') ?? '');
const flakesInTheAir = (page) => page.locator('.pp-cel-flake:not([hidden])').count();
/** What the melt is showing: the pictures on screen by name, and whether it has taken the plain snowman's place. */
const melt = (page) =>
  page.evaluate(() => {
    const box = document.querySelector('.pp-melt');
    const shown = (sel) => [...document.querySelectorAll(sel)].filter((i) => !i.hidden).map((i) => i.dataset.piece);
    const hat = [...document.querySelectorAll('.pp-melt-hat')].find((i) => !i.hidden);
    return {
      on: !box.hidden,
      aside: document.getElementById('snowman').classList.contains('aside'),
      body: box.hidden ? null : (shown('.pp-melt-body')[0] ?? null),
      hat: box.hidden || !hat ? null : hat.dataset.piece,
      hatTop: hat ? hat.getBoundingClientRect().top : null,
      hatTurn: hat ? hat.style.transform.replace(/^.*rotate\(([-\d.]+)deg\).*$/, '$1') : null,
      eyes: box.hidden ? [] : shown('.pp-melt-actor img[data-piece^="puddle-eyes"]'),
      flare: !document.querySelector('.pp-melt-flare').hidden,
      sunScale: document.querySelector('.pp-sun').style.scale,
      bits: box.hidden ? 0 : shown('.pp-melt-bits img').length,
    };
  });
const resultShown = (page) => page.locator('#result').isVisible();
const tags = (page) => page.evaluate(() => [...document.querySelectorAll('.pp-tags .pp-tag')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()));

// ---------------------------------------------------------------------------
for (const [w, h] of SIZES) {
  // ===== an endless game: a win, a loss, a refresh mid-round, a new game =====
  {
    const p = await newPhone(w, h, 'endless game');
    const { page, say } = p;

    // names
    say(/meltdown/i.test(await text(page)), 'the names screen should show the title');
    say((await page.locator('.pp-menu').count()) === 0, 'there is nothing to restart on the names screen');
    await p.shot('1-names');
    await fits(p, 'names');
    await page.getByRole('button', { name: "Let's play" }).click();
    say((await page.locator('.pp-error').textContent()).length > 0, 'empty names should show a message');
    await page.getByLabel('First player').fill('Sam');
    await page.getByLabel('Second player').fill('sam');
    await page.getByRole('button', { name: "Let's play" }).click();
    say(/different names/.test(await page.locator('.pp-error').textContent()), 'the same name twice should be refused');
    await enterNames(p, 'Dad', 'Sam');
    say((await saved(page))?.phase === 'setup', 'the game should be saved once the names are in');

    // setup: Dad sets the first answer
    say((await text(page)).includes('Dad, type a secret.'), 'the first player sets first');
    await p.shot('2-setup');
    await fits(p, 'setup');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    say(/Type a secret/.test(await page.locator('.pp-error').textContent()), 'an empty answer should show a message');
    await page.getByLabel('The secret answer').fill('Polar Bear');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    say(/category/i.test(await page.locator('.pp-error').textContent()), 'no category should show a message');
    await page.getByLabel('The secret answer').fill('Привет');
    await page.locator('label.pp-chip', { hasText: 'Animal' }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    say(/A to Z/.test(await page.locator('.pp-error').textContent()), 'another alphabet should be refused kindly');
    await page.getByLabel('The secret answer').fill('x'.repeat(46));
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    say(/45/.test(await page.locator('.pp-error').textContent()), 'an answer over 45 characters should be refused');
    say(
      (await page.locator('.pp-chip input[value="normal"]').isChecked()) === true,
      'Normal should be picked for a first-time setter',
    );
    // the hide toggle keeps the answer but hides the letters
    await page.getByLabel('The secret answer').fill('Polar Bear');
    say((await page.getByRole('button', { name: 'Hide' }).getAttribute('aria-pressed')) === 'false', 'the Hide button should say it is not pressed');
    await page.getByRole('button', { name: 'Hide' }).click();
    say((await page.locator('.pp-input.secret.hide').count()) === 1, 'Hide should hide the answer');
    await page.getByRole('button', { name: 'Show' }).click();
    await setSecret(p, { answer: 'Polar Bear', category: 'Animal', difficulty: 'Normal' });

    // handoff: nothing may leak the answer, and there is a way back
    say((await text(page)).includes('Pass the phone to Sam.'), 'the handoff should name the guesser');
    say(/Normal.*6 wrong guesses/.test(await text(page)), 'the handoff should name the difficulty');
    say(!(await page.content()).toLowerCase().includes('polar'), 'the handoff screen leaks the answer');
    say(!(await page.content()).toLowerCase().includes('bear'), 'the handoff screen leaks the answer');
    await p.shot('3-handoff');
    await fits(p, 'handoff');
    await page.getByRole('button', { name: 'Change the answer' }).click();
    say((await page.getByLabel('The secret answer').inputValue()) === 'Polar Bear', 'going back should keep what was typed');
    say((await page.locator('.pp-input.secret.hide').count()) === 1, 'going back from the handoff should bring the answer back hidden, as the guesser may be holding the phone');
    await page.getByRole('button', { name: 'Show' }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: "It's me" }).click();

    // play: a win, with a wrong letter on the way
    say((await tags(page))[0] === 'DAD 0 SETTING' && (await tags(page))[1] === 'SAM 0 GUESSING', `the tags should show the roles, got ${JSON.stringify(await tags(page))}`);
    await fits(p, 'play', { playScreen: true });
    await guessAll(p, ['A', 'R', 'E']);
    say((await melt(page)).on === false, 'right letters should not melt him');
    // a wrong letter: the sun flares, heat rises and he slumps to the next stage, then the plain snowman is back
    await tap(p, 'X');
    const beat = await melt(page);
    say(beat.on && beat.aside, `a wrong guess should play the melt beat in the plain snowman's place, got ${JSON.stringify(beat)}`);
    say(beat.flare && Number(beat.sunScale) > 1, `the sun should flare on a wrong guess, got ${JSON.stringify(beat)}`);
    say(/^snowman-[01]$/.test(beat.body ?? ''), `the beat should start from the stage he was at, got ${beat.body}`);
    say(/snowman-1\.webp$/.test(await snowmanSrc(page)), 'the plain snowman should take the new stage at once, behind the beat');
    say(await page.locator('.pp-key:text-is("X")').isDisabled(), 'a wrong key should be switched off at once, while the beat plays');
    await page.waitForTimeout(250);
    say((await melt(page)).bits > 0, 'heat should rise during the beat');
    await p.shot('4a-miss-beat');
    await page.waitForFunction(() => document.querySelector('.pp-melt').hidden, null, { timeout: 4000 });
    const afterBeat = await melt(page);
    say(!afterBeat.aside && !afterBeat.flare && afterBeat.sunScale === '', `the plain snowman and the sun should be back after the beat, got ${JSON.stringify(afterBeat)}`);
    say(/snowman-1\.webp$/.test(await snowmanSrc(page)), 'one miss of six should show stage 1');
    say(/a little worried\. 5 misses left/.test(await page.locator('#snowman').getAttribute('alt')), 'the snowman should still be described after the beat');
    await p.shot('4-play');
    say((await saved(page)).round.guessed.join('') === 'AREX', 'every guess should be saved');
    await guessAll(p, ['P', 'O', 'L', 'B']);
    say((await page.locator('#result').isVisible()) === true, 'a solved round should show the result');
    say((await page.locator('.pp-headline').textContent()) === 'YOU GOT IT!', 'a win should say so');
    say(/Sam scores a point/.test(await page.locator('.pp-note').textContent()), 'a win should name who scored');
    say(/snowman-0\.webp$/.test(await snowmanSrc(page)), 'a win should bring the snowman back to full size');
    say((await page.locator('.pp-slot.missed').count()) === 0, 'a won round should have nothing marked missed');
    say((await page.locator('#answer').getAttribute('aria-label')) === 'Animal: P o l a r   B e a r', 'the whole answer should be shown');
    say((await tags(page))[1].startsWith('SAM 1'), `Sam should have a point, got ${JSON.stringify(await tags(page))}`);
    await p.shot('5-result-win');
    await fits(p, 'result', { playScreen: true });
    // the win is celebrated: a backflip, then the cloud and snow, ending at rest
    say(await page.locator('.pp-cel').isVisible(), 'a win should be celebrated');
    say(/win-backflip-[1-4]\.webp$/.test(await celebrationPose(page)), `a win should show a backflip pose, got ${await celebrationPose(page)}`);
    say((await page.locator('#snowman.away').count()) === 1, 'the plain snowman should step aside while the celebration plays');
    await page.waitForFunction(() => /win-backflip-4/.test(document.querySelector('.pp-cel-actor img:not([hidden])')?.getAttribute('src') ?? ''), null, { timeout: 8000 });
    say(await page.locator('.pp-cel-cloud').isVisible(), 'the cloud should roll in over the sun');
    await p.shot('5b-celebration-snow');
    await page.waitForFunction(() => document.querySelectorAll('.pp-cel-flake:not([hidden])').length === 0, null, { timeout: 12000 });
    say(/win-backflip-4\.webp$/.test(await celebrationPose(page)) && (await page.locator('.pp-cel-cloud').isVisible()), 'the celebration should end at rest: arms up, under the cloud');
    // a refresh on the result keeps the result, and the celebration's end rather than playing again
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    say((await page.locator('#result').isVisible()) === true, 'refreshing on the result should keep it');
    say((await page.locator('.pp-headline').textContent()) === 'YOU GOT IT!', 'the result heading should survive a refresh');
    say(/win-backflip-4\.webp$/.test(await celebrationPose(page)) && (await page.locator('.pp-cel-cloud').isVisible()) && (await flakesInTheAir(page)) === 0, 'a refresh on a won round should show how the celebration ends, not play it again');
    say(/snowman-0\.webp$/.test(await snowmanSrc(page)), 'the plain snowman should still be the full-size one after a refresh');
    await p.shot('5c-win-after-refresh');
    await fits(p, 'won result after refresh', { playScreen: true });
    await page.getByRole('button', { name: 'Next round' }).click();

    // roles swap: Sam sets, a hard round that Dad loses
    say((await text(page)).includes('Sam, type a secret.'), 'roles should swap each round');
    say((await tags(page))[0].startsWith('DAD 0') && (await tags(page))[1].startsWith('SAM 1'), 'the score should carry on');
    await setSecret(p, { answer: 'Cat', category: 'Other', custom: 'Pet', difficulty: 'Hard' });
    say((await text(page)).includes('Hard') && /4 wrong guesses/.test(await text(page)), 'the handoff should say Hard');
    await page.getByRole('button', { name: "It's me" }).click();
    say((await page.locator('.pp-notch').count()) === 4, 'a Hard round should have four notches on the thermometer');
    say((await page.locator('#category').textContent()) === 'Pet', 'a custom category should show on the sign');
    // three wrong letters tapped quickly, each one cutting the last beat short: nothing may be left half done
    await guessAll(p, ['X', 'Q', 'Z']);
    await page.waitForFunction(() => document.querySelector('.pp-melt').hidden, null, { timeout: 4000 });
    const quick = await melt(page);
    say(!quick.aside && !quick.flare && quick.sunScale === '', `quick wrong taps should leave the plain snowman standing, got ${JSON.stringify(quick)}`);
    say(/snowman-6\.webp$/.test(await snowmanSrc(page)), 'three misses of four should show stage 6');
    say(/1 miss left/.test(await page.locator('#snowman').getAttribute('alt')), 'three misses of four should leave one');
    say((await saved(page)).round.guessed.join('') === 'XQZ', 'every quick tap should be saved once');
    await p.shot('6-one-miss-left');

    // the last miss: he melts out from under his hat, which hangs, then drops into the puddle
    const lostAt = Date.now();
    await tap(p, 'W');
    say((await resultShown(page)) === false, 'the result should wait for the melt');
    say((await page.locator('.pp-slot.missed').count()) === 0, 'the sign should not give the answer away the moment the round is lost');
    say((await page.locator('#answer').getAttribute('aria-label')) === 'Pet: blank blank blank', `the sign should keep the round as it was while the melt plays, got "${await page.locator('#answer').getAttribute('aria-label')}"`);
    say((await page.locator('.pp-key:not(:disabled)').count()) === 0, 'no key should work once the round is lost');
    await page.waitForTimeout(700);
    const hanging = await melt(page);
    say(hanging.on && hanging.body === 'puddle' && hanging.hat === 'hat-6', `from stage 6 his own hat should be left hanging over the puddle, got ${JSON.stringify(hanging)}`);
    say((await resultShown(page)) === false, 'the result should still be waiting while the hat hangs');
    say((await page.locator('.pp-slot.missed').count()) === 0 && (await page.locator('#answer').innerText()).trim() === '', 'the answer should still be hidden on the sign while the hat hangs');
    await p.shot('6b-hat-left-hanging');
    await page.locator('#result').waitFor({ state: 'visible', timeout: 5000 });
    const took = Date.now() - lostAt;
    say(took >= 2000 && took <= 3600, `the melt should take two to three seconds before the result, took ${took} ms`);
    say((await page.locator('.pp-slot.missed').count()) === 3 && (await page.locator('#answer').innerText()).replace(/\s/g, '') === 'CAT', 'the answer and its missed letters should come up on the sign with the heading, when the melt ends');
    const atRest = await melt(page);
    say(atRest.on && atRest.aside && atRest.body === 'puddle' && atRest.hat === 'puddle-hat', `a lost round should end as the puddle with the hat floating on it, got ${JSON.stringify(atRest)}`);
    say(atRest.hatTop > hanging.hatTop, 'the hat should have come down from where it hung');
    say(atRest.eyes.length === 1 && atRest.bits === 0 && !atRest.flare, `the puddle at rest should have its eyes and nothing in the air, got ${JSON.stringify(atRest)}`);
    say(await page.evaluate(() => document.activeElement?.classList.contains('pp-headline')), 'the loss heading should take the focus when it comes up');
    say(/snowman-8\.webp$/.test(await snowmanSrc(page)), 'a lost round should end on the puddle');
    say((await page.locator('#snowman').getAttribute('alt')) === 'The snowman is a puddle.', 'the puddle should still be described for screen readers');
    const heading = await page.locator('.pp-headline').textContent();
    say(LOSS_HEADINGS.includes(heading), `a loss heading should be one of the seven, got "${heading}"`);
    say(/No point/.test(await page.locator('.pp-note').textContent()), 'a loss should say there is no point');
    say((await page.locator('.pp-slot.missed').count()) === 3, 'the three letters of CAT should be marked missed');
    say(/C \(missed\) a \(missed\) t \(missed\)/.test(await page.locator('#answer').getAttribute('aria-label')), 'missed letters should be named for screen readers');
    say((await tags(page))[0].startsWith('DAD 0'), 'a loss earns no point');
    await p.shot('7-result-loss');
    await fits(p, 'loss', { playScreen: true });
    say((await page.locator('.pp-cel').isVisible()) === false, 'a lost round should not be celebrated');
    // the eyes blink up at you
    await page.waitForFunction(() => [...document.querySelectorAll('.pp-melt-actor img')].some((i) => i.dataset.piece === 'puddle-eyes-closed' && !i.hidden), null, { timeout: 6000 });
    // a refresh on a lost round shows how it ended, without playing the melt again
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    say((await resultShown(page)) === true, 'refreshing on a lost result should keep it, with no wait');
    say((await page.locator('.pp-headline').textContent()) === heading, 'the loss heading should survive a refresh');
    say((await page.locator('.pp-slot.missed').count()) === 3, 'a refresh on a lost round should show the answer and its missed letters at once');
    const reloaded = await melt(page);
    say(reloaded.on && reloaded.body === 'puddle' && reloaded.hat === 'puddle-hat' && reloaded.bits === 0, `a refresh on a lost round should show the puddle at rest, not play the melt again, got ${JSON.stringify(reloaded)}`);
    say((await page.locator('#snowman').getAttribute('alt')) === 'The snowman is a puddle.', 'the puddle should still be described after a refresh');
    await p.shot('7b-loss-after-refresh');
    await fits(p, 'loss after refresh', { playScreen: true });
    await page.getByRole('button', { name: 'Next round' }).click();
    say((await melt(page).catch(() => null)) === null, 'the melt should go away with the play screen');

    // Dad sets again: Normal was his last choice; then a refresh in the middle of his guessing round
    say((await text(page)).includes('Dad, type a secret.'), 'roles should swap back');
    say((await page.locator('.pp-chip input[value="normal"]').isChecked()) === true, "Dad's last difficulty should be the default");
    await page.getByLabel('The secret answer').fill('Snow');
    await page.locator('label.pp-chip', { hasText: 'Place' }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.reload({ waitUntil: 'networkidle' });
    say((await text(page)).includes('Pass the phone to Sam.'), 'refreshing on the handoff should stay on the handoff');
    await page.getByRole('button', { name: "It's me" }).click();
    await guessAll(p, ['S', 'X']);
    const before = { answer: await page.locator('#answer').getAttribute('aria-label'), src: await snowmanSrc(page), alt: await page.locator('#snowman').getAttribute('alt') };
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const after = { answer: await page.locator('#answer').getAttribute('aria-label'), src: await snowmanSrc(page), alt: await page.locator('#snowman').getAttribute('alt') };
    say(JSON.stringify(before) === JSON.stringify(after), `a refresh mid-round should come back exactly: ${JSON.stringify(before)} then ${JSON.stringify(after)}`);
    say((await melt(page)).on === false, 'a refresh mid-round should not replay the beat');
    say((await page.locator('.pp-key.hit').allTextContents()).join('') === 'S', 'the right key should still be marked after a refresh');
    say((await page.locator('.pp-key.miss').allTextContents()).join('') === 'X', 'the wrong key should still be marked after a refresh');
    await p.shot('8-after-refresh');
    await fits(p, 'play after refresh', { playScreen: true });
    await tap(p, 'S'); // a repeat is ignored
    say((await saved(page)).round.guessed.join('') === 'SX', 'a repeated letter should be ignored');
    await page.keyboard.press('n'); // a physical keyboard works too
    await page.waitForTimeout(150);
    say((await saved(page)).round.guessed.join('') === 'SXN', 'the physical keyboard should guess');

    // New game: behind a confirmation, on every screen that has a game
    await page.locator('.pp-menu').click();
    say((await page.getByRole('alertdialog').isVisible()) === true, 'New game should ask first');
    await p.shot('9-confirm');
    await fits(p, 'confirmation');
    await page.keyboard.press('o'); // letters must not reach the round behind the dialog
    await page.waitForTimeout(100);
    say((await saved(page)).round.guessed.join('') === 'SXN', 'the keyboard should not guess while the confirmation is open');
    await page.getByRole('button', { name: 'Keep playing' }).click();
    say((await page.getByRole('alertdialog').count()) === 0, 'Keep playing should close the confirmation');
    say(await page.evaluate(() => document.activeElement?.classList.contains('pp-menu')), 'focus should go back to the New game button');
    say((await saved(page)).phase === 'play', 'Keep playing should change nothing');
    await page.locator('.pp-menu').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'New game' }).click();
    say(/meltdown/i.test(await text(page)), 'a new game should go back to the names screen');
    say((await page.getByLabel('First player').inputValue()) === '', 'a new game should clear the names');
    say((await saved(page))?.phase === 'names' && (await saved(page)).players.length === 0, 'a new game should clear the saved game');
    await page.reload({ waitUntil: 'networkidle' });
    say(/meltdown/i.test(await text(page)), 'a new game should stay new after a refresh');
    await p.context.close();
  }

  // ===== a "1 game" match played to the end =====
  {
    const p = await newPhone(w, h, 'one-game match');
    const { page, say } = p;
    await enterNames(p, 'Dad', 'Sam', '1 game');
    await setSecret(p, { answer: 'Moon', category: 'Place' });
    await page.getByRole('button', { name: "It's me" }).click();
    await guessAll(p, ['M', 'O', 'N']);
    say(/See who won|Next round/.test(await page.locator('#next').textContent()), 'the result should offer a way on');
    await page.getByRole('button', { name: 'Next round' }).click();
    // Sam sets, Dad guesses and loses on Easy: eight misses
    await setSecret(p, { answer: 'Ice', category: 'Food', difficulty: 'Easy' });
    await page.getByRole('button', { name: "It's me" }).click();
    say((await page.locator('.pp-notch').count()) === 8, 'an Easy round should have eight notches');
    await guessAll(p, ['X', 'Q', 'Z', 'W', 'J', 'K', 'V']);
    // the eighth miss loses it; a tap on the yard skips the melt
    await tap(p, 'B');
    await page.waitForTimeout(500);
    const playing = await melt(page);
    say(playing.on && playing.hat === 'hat-7' && (await resultShown(page)) === false, `the tap on the last wrong key should start the melt, not skip it, got ${JSON.stringify(playing)}`);
    say((await page.locator('.pp-slot.missed').count()) === 0, 'the answer should be held back while the melt plays');
    const yard = await page.locator('#scene').boundingBox();
    await page.mouse.click(yard.x + yard.width / 2, yard.y + yard.height / 3);
    await page.waitForTimeout(250);
    say((await resultShown(page)) === true, 'a tap should skip the melt and bring up the result');
    say((await page.locator('.pp-slot.missed').count()) === 3 && (await page.locator('#answer').innerText()).replace(/\s/g, '') === 'ICE', 'a skipped melt should show the answer and its missed letters at once');
    const skipped = await melt(page);
    say(skipped.body === 'puddle' && skipped.hat === 'puddle-hat' && skipped.bits === 0, `a skipped melt should jump to the puddle at rest, got ${JSON.stringify(skipped)}`);
    say(/See who won/.test(await page.locator('#next').textContent()), 'the last round of a match should say who won next');
    await page.getByRole('button', { name: 'See who won' }).click();
    say((await text(page)).includes('Sam wins!'), 'Sam solved one and Dad none, so Sam wins');
    say(/Dad 0, Sam 1/.test(await text(page)), 'the match over screen should show the score');
    await p.shot('10-match-over');
    await fits(p, 'match over');
    await page.reload({ waitUntil: 'networkidle' });
    say((await text(page)).includes('Sam wins!'), 'the match over screen should survive a refresh');
    await page.getByRole('button', { name: 'Rematch' }).click();
    say((await text(page)).includes('Dad, type a secret.'), 'a rematch should start with the first player');
    say((await tags(page))[0].startsWith('DAD 0') && (await tags(page))[1].startsWith('SAM 0'), 'a rematch should reset the score');
    await p.context.close();
  }

  // ===== a phone that asks for reduced motion: the story beats, no big motion =====
  {
    const p = await newPhone(w, h, 'reduced motion', { reducedMotion: 'reduce' });
    const { page, say } = p;
    await enterNames(p, 'Dad', 'Sam');
    await setSecret(p, { answer: 'Cat', category: 'Animal', difficulty: 'Hard' });
    await page.getByRole('button', { name: "It's me" }).click();
    await tap(p, 'X');
    const miss = await melt(page);
    say(!miss.on && !miss.aside && !miss.flare, `with reduced motion a wrong guess should show no beat, got ${JSON.stringify(miss)}`);
    say(/snowman-2\.webp$/.test(await snowmanSrc(page)), 'with reduced motion a wrong guess should still show the next stage at once');
    for (const ch of ['Q', 'Z', 'W']) await tap(p, ch);
    await page.waitForTimeout(200);
    say((await resultShown(page)) === true, 'with reduced motion the result should come up without waiting for a melt');
    say((await page.locator('.pp-slot.missed').count()) === 3, 'with reduced motion the answer and its missed letters should show at once');
    const still = await melt(page);
    say(still.on && still.body === 'puddle' && still.hat === 'puddle-hat' && still.bits === 0, `with reduced motion a lost round should show the puddle at rest, got ${JSON.stringify(still)}`);
    await page.waitForTimeout(800);
    const later = await melt(page);
    say(later.hatTop === still.hatTop && later.hatTurn === '0' && later.eyes.join() === 'puddle-eyes', `with reduced motion the puddle should hold still, got ${JSON.stringify(later)}`);
    await p.shot('14-reduced-motion-loss');
    await p.context.close();
  }

  // ===== the longest names: they must fit on every screen =====
  {
    const p = await newPhone(w, h, 'long names');
    const { page, say } = p;
    const dad = 'Wolfeschlegelsteinhaus'; // 22 letters with nowhere to break
    const sam = 'Bartholomew Montgomery Jr'.slice(0, 24);
    await enterNames(p, dad, sam);
    await fits(p, 'setup with long names');
    await setSecret(p, { answer: 'Moon', category: 'Place' });
    say((await text(page)).includes(`Pass the phone to ${sam}`), 'the handoff should show the whole long name');
    await fits(p, 'handoff with long names');
    await p.shot('12-long-names-handoff');
    await page.getByRole('button', { name: "It's me" }).click();
    await fits(p, 'play with long names', { playScreen: true });
    await guessAll(p, ['M', 'O', 'N']);
    await fits(p, 'result with long names', { playScreen: true });
    await p.shot('13-long-names-result');
    await page.locator('.pp-menu').click();
    await fits(p, 'confirmation with long names');
    await p.context.close();
  }

  // ===== a phone that cannot save, and a save that cannot be read =====
  {
    const p = await newPhone(w, h, 'storage trouble', {
      init: () => {
        Storage.prototype.setItem = () => {
          throw new DOMException('full', 'QuotaExceededError');
        };
      },
    });
    const { page, say } = p;
    await enterNames(p, 'Dad', 'Sam');
    say(/not saving the game/.test(await text(page)), 'a calm notice should say the game is not being saved');
    say((await text(page)).includes('Dad, type a secret.'), 'play should carry on without storage');
    await p.shot('11-no-storage');
    await fits(p, 'notice');
    await page.getByRole('button', { name: 'OK' }).click();
    say((await page.locator('.pp-notice').count()) === 0, 'the notice should go away when asked');
    await p.context.close();

    const q = await newPhone(w, h, 'a broken save', { init: () => localStorage.setItem('meltdown:save', '{not json') });
    q.say(/saved game could not be opened/.test(await text(q.page)), 'a broken save should be dropped with a calm notice');
    q.say(/meltdown/i.test(await text(q.page)), 'a broken save should leave a new game');
    await q.context.close();
  }
}

// ===== the melt's pictures, and the New game confirmation over the melt (once, at one size) =====
{
  const p = await newPhone(393, 852, 'melt pictures and keys', { init: () => performance.setResourceTimingBufferSize(1000) });
  const { page, say } = p;
  const MELT_PIECES = ['puddle', 'puddle-hat', 'puddle-carrot', 'puddle-eyes', 'puddle-eyes-closed', 'hat-6', 'hat-7', 'sun-flare', 'heat-1', 'heat-2', 'drop'];
  /** The melt pieces the page has fetched so far. */
  const got = async () => {
    const names = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name.split('/').pop()));
    return MELT_PIECES.filter((n) => names.includes(`${n}.webp`));
  };
  const firstLoad = await got();
  say(firstLoad.length === 0, `the melt's loose pieces should not be part of the first load, got ${firstLoad.join(', ')}`);
  await enterNames(p, 'Dad', 'Sam');
  await setSecret(p, { answer: 'Cat', category: 'Animal', difficulty: 'Hard' });
  await page.getByRole('button', { name: "It's me" }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  const loaded = await got();
  say(loaded.length === MELT_PIECES.length, `every melt piece, heat and drops included, should be fetched once the play screen is up, before the first miss; missing ${MELT_PIECES.filter((n) => !loaded.includes(n)).join(', ')}`);

  // the confirmation opened while the melt plays: its keys are for its buttons, not for skipping the melt
  for (const ch of ['X', 'Q', 'Z']) await tap(p, ch);
  await tap(p, 'W');
  await page.locator('.pp-menu').click();
  await page.keyboard.press('Enter'); // on Keep playing, which has the focus
  say((await page.locator('.pp-dialog').count()) === 0, 'Enter on Keep playing should close the confirmation while the melt plays');
  say((await resultShown(page)) === false && (await page.locator('.pp-slot.missed').count()) === 0, 'Enter on the confirmation should not skip the melt');
  if (await page.locator('.pp-dialog').count()) await page.getByRole('button', { name: 'Keep playing' }).click(); // so a failure above is reported, not a time-out below
  await page.locator('.pp-menu').click();
  await page.keyboard.press('Escape');
  say((await page.locator('.pp-dialog').count()) === 0, 'Escape should close the confirmation while the melt plays');
  say((await resultShown(page)) === false && (await page.locator('.pp-slot.missed').count()) === 0, 'Escape on the confirmation should not skip the melt');
  // a resize while the melt plays keeps the answer off the sign
  await page.setViewportSize({ width: 440, height: 956 });
  await page.waitForTimeout(150);
  say((await resultShown(page)) === false && (await page.locator('#answer').getAttribute('aria-label')) === 'Animal: blank blank blank', 'a resize during the melt should keep the answer off the sign');

  // a new game started while the melt plays: nothing of it may keep running
  await page.locator('.pp-menu').click();
  await page.locator('.pp-dialog').getByRole('button', { name: 'New game' }).click();
  await page.evaluate(() => {
    window.frames_ = 0;
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => request((t) => (window.frames_++, cb(t)));
  });
  await page.waitForTimeout(2500);
  say(/meltdown/i.test(await text(page)), 'New game during the melt should go back to the names screen');
  say((await page.evaluate(() => window.frames_)) === 0, 'the melt should stop drawing when the play screen goes away');
  await p.context.close();
}

await browser.close();
if (problems.length) {
  console.error('check-game failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('check-game passed: games play through cleanly at 320, 393 and 440 px');
