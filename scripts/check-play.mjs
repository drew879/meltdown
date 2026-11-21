// Taps through a whole round on the paper play screen with motion on, and
// fails if anything is off or the page logs an error.
//
//   npm run dev            (in another terminal; the page must be served)
//   node scripts/check-play.mjs [folder for screenshots]
//
// This checks the play screen alone, through the demo link (?a=answer&c=category),
// which builds a round with the real engine and never saves. check-game.mjs plays
// whole games through every screen.
import { webkit } from '@playwright/test';

const URL = process.env.MELTDOWN_URL ?? 'http://localhost:5173/meltdown/';
const shots = process.argv[2];
const problems = [];
const expect = (ok, what) => ok || problems.push(what);

// the page has to be served first
if (!(await fetch(URL).then((r) => r.ok, () => false))) {
  console.error(`Nothing is answering at ${URL}. Start the dev server first: npm run dev`);
  process.exit(1);
}

const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2 });
page.on('console', (m) => m.type() === 'error' && problems.push('console error: ' + m.text()));
page.on('pageerror', (e) => problems.push('page error: ' + e));
await page.goto(`${URL}?a=Polar%20Bear&c=Animal`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const read = () =>
  page.evaluate(() => ({
    snowman: document.getElementById('snowman').getAttribute('src'),
    alt: document.getElementById('snowman').alt,
    answer: document.getElementById('answer').getAttribute('aria-label'),
    hit: [...document.querySelectorAll('.pp-key.hit')].map((k) => k.textContent).join(''),
    miss: [...document.querySelectorAll('.pp-key.miss')].map((k) => k.textContent).join(''),
    scrolls: document.documentElement.scrollHeight > innerHeight,
    boards: document.querySelectorAll('.pp-board').length,
    rows: document.querySelectorAll('.pp-row').length,
    missedLetters: document.querySelectorAll('.pp-slot.missed').length,
    resultShown: !document.getElementById('result').hidden,
  }));

// three right letters and two wrong ones, by tapping
for (const ch of ['A', 'R', 'E', 'T', 'S']) {
  await page.getByRole('button', { name: ch, exact: true }).click();
  await page.waitForTimeout(650);
}
await page.waitForTimeout(1800);
const mid = await read();
if (shots) await page.screenshot({ path: `${shots}/paper-polar.png` });
expect(mid.hit === 'ERA', `right keys should be E, R and A, got "${mid.hit}"`);
expect(mid.miss === 'TS', `wrong keys should be T and S, got "${mid.miss}"`);
expect(/snowman-3\.webp$/.test(mid.snowman), `two of six misses should show stage 3, got ${mid.snowman}`);
expect(mid.alt.includes('4 misses left'), `the snowman's description should say 4 misses left, got "${mid.alt}"`);
expect(mid.answer === 'Animal: blank blank blank a r   blank e a r', `unexpected answer label "${mid.answer}"`);
expect(mid.boards === 1 && mid.rows === 1, `Polar Bear should sit on one sign in one row, got ${mid.boards} and ${mid.rows}`);
expect(!mid.scrolls, 'the page should not scroll');
expect(!mid.resultShown, 'the round should not be over yet');

// a repeat, then four more wrong letters from a physical keyboard: the round is lost
for (const ch of ['T', 'X', 'Q', 'Z', 'W']) {
  await page.keyboard.press(ch);
  await page.waitForTimeout(500);
}
await page.waitForTimeout(800);
const end = await read();
if (shots) await page.screenshot({ path: `${shots}/paper-polar-lost.png` });
expect(/snowman-8\.webp$/.test(end.snowman), `a lost round should show the puddle, got ${end.snowman}`);
expect(end.miss.length === 6, `a repeated letter should be ignored, leaving 6 wrong keys, got ${end.miss.length}`);
expect(end.missedLetters === 4, `the four unguessed letters should be shown as missed, got ${end.missedLetters}`);
expect(end.resultShown, 'the result panel should be showing');

await browser.close();
if (problems.length) {
  console.error('check-play failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('check-play passed: a full round taps through cleanly');
