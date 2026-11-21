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
async function newPhone(w, h, label, { init } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
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
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: "It's me" }).click();

    // play: a win, with a wrong letter on the way
    say((await tags(page))[0] === 'DAD 0 SETTING' && (await tags(page))[1] === 'SAM 0 GUESSING', `the tags should show the roles, got ${JSON.stringify(await tags(page))}`);
    await fits(p, 'play', { playScreen: true });
    await guessAll(p, ['A', 'R', 'E', 'X']);
    say(/snowman-1\.webp$/.test(await snowmanSrc(page)), 'one miss of six should show stage 1');
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
    // a refresh on the result keeps the result
    await page.reload({ waitUntil: 'networkidle' });
    say((await page.locator('#result').isVisible()) === true, 'refreshing on the result should keep it');
    say((await page.locator('.pp-headline').textContent()) === 'YOU GOT IT!', 'the result heading should survive a refresh');
    await page.getByRole('button', { name: 'Next round' }).click();

    // roles swap: Sam sets, a hard round that Dad loses
    say((await text(page)).includes('Sam, type a secret.'), 'roles should swap each round');
    say((await tags(page))[0].startsWith('DAD 0') && (await tags(page))[1].startsWith('SAM 1'), 'the score should carry on');
    await setSecret(p, { answer: 'Cat', category: 'Other', custom: 'Pet', difficulty: 'Hard' });
    say((await text(page)).includes('Hard') && /4 wrong guesses/.test(await text(page)), 'the handoff should say Hard');
    await page.getByRole('button', { name: "It's me" }).click();
    say((await page.locator('.pp-notch').count()) === 4, 'a Hard round should have four notches on the thermometer');
    say((await page.locator('#category').textContent()) === 'Pet', 'a custom category should show on the sign');
    await guessAll(p, ['X', 'Q', 'Z']);
    await p.shot('6-one-miss-left');
    await guessAll(p, ['W']);
    say(/snowman-8\.webp$/.test(await snowmanSrc(page)), 'a lost round should end on the puddle');
    const heading = await page.locator('.pp-headline').textContent();
    say(LOSS_HEADINGS.includes(heading), `a loss heading should be one of the seven, got "${heading}"`);
    say(/No point/.test(await page.locator('.pp-note').textContent()), 'a loss should say there is no point');
    say((await page.locator('.pp-slot.missed').count()) === 3, 'the three letters of CAT should be marked missed');
    say(/C \(missed\) a \(missed\) t \(missed\)/.test(await page.locator('#answer').getAttribute('aria-label')), 'missed letters should be named for screen readers');
    say((await tags(page))[0].startsWith('DAD 0'), 'a loss earns no point');
    await p.shot('7-result-loss');
    await fits(p, 'loss', { playScreen: true });
    await page.getByRole('button', { name: 'Next round' }).click();

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
    await guessAll(p, ['X', 'Q', 'Z', 'W', 'J', 'K', 'V', 'B']);
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

await browser.close();
if (problems.length) {
  console.error('check-game failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('check-game passed: games play through cleanly at 320, 393 and 440 px');
