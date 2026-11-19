// Lays a range of answers out on the garden sign at several screen sizes and
// fails if a letter leaves the board, the sign takes more than three rows, or
// the page scrolls. Prints the letter size each case gets.
//
//   npm run dev            (in another terminal; the page must be served)
//   node scripts/check-sign.mjs
import { webkit } from '@playwright/test';

const URL = process.env.MELTDOWN_URL ?? 'http://localhost:5173/meltdown/direction/paper.html';
const LONG = 'Alexander and the Terrible, Horrible, No Good, Very Bad Day';
/** answer, screen width, screen height */
const CASES = [
  ['Cat', 320, 568],
  ['Polar Bear', 440, 956],
  ['The Lion King', 393, 852],
  ['Six Flags Great Adventure', 440, 956],
  ['Six Flags Great Adventure', 375, 667],
  ['Six Flags Great Adventure', 1024, 1366],
  ['Cloudy with a Chance of Meatballs', 440, 956],
  ['Harry Potter and the Chamber of Secrets', 440, 956],
  [LONG, 440, 956],
  [LONG, 375, 667],
  [LONG, 320, 568],
  ['Supercalifragilisticexpia', 440, 956],
  ['Supercalifragilisticexpi', 320, 568],
];

// the page has to be served first
if (!(await fetch(URL).then((r) => r.ok, () => false))) {
  console.error(`Nothing is answering at ${URL}. Start the dev server first: npm run dev`);
  process.exit(1);
}

const problems = [];
const browser = await webkit.launch();
for (const [answer, w, h] of CASES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const where = `"${answer}" at ${w}x${h}`;
  page.on('console', (m) => m.type() === 'error' && problems.push(`${where}: console error: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${where}: page error: ${e}`));
  await page.goto(`${URL}?still&a=${encodeURIComponent(answer)}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => {
    const board = document.getElementById('board').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.pp-row')];
    const inside = rows.every((row) => {
      const first = row.firstElementChild.getBoundingClientRect();
      const last = row.lastElementChild.getBoundingClientRect();
      return first.left >= board.left && last.right <= board.right && first.top >= board.top && last.bottom <= board.bottom;
    });
    return {
      letter: parseFloat(getComputedStyle(document.getElementById('answer')).getPropertyValue('--slot')),
      rows: rows.length,
      boards: document.querySelectorAll('.pp-board').length,
      sign: `${Math.round(board.width)}x${Math.round(board.height)}`,
      onScreen: board.left >= 0 && board.right <= innerWidth,
      inside,
      scrolls: document.documentElement.scrollHeight > innerHeight,
      snowman: Math.round(document.getElementById('snowman').getBoundingClientRect().height),
    };
  });
  console.log(`${String(answer.length).padStart(2)} chars  ${`${w}x${h}`.padEnd(9)}  ${r.rows} row${r.rows > 1 ? 's' : ' '}  letters ${String(r.letter).padStart(4)}px  sign ${r.sign.padEnd(7)}  snowman ${r.snowman}px`);
  if (r.boards !== 1) problems.push(`${where}: expected one sign, found ${r.boards}`);
  if (r.rows > 3) problems.push(`${where}: ${r.rows} rows, the limit is three`);
  if (!r.inside) problems.push(`${where}: a letter falls outside the board`);
  if (!r.onScreen) problems.push(`${where}: the sign runs off the screen`);
  if (r.scrolls) problems.push(`${where}: the page scrolls`);
  if (r.snowman < 90) problems.push(`${where}: the snowman is squeezed to ${r.snowman}px`);
  await page.close();
}
await browser.close();
if (problems.length) {
  console.error('check-sign failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('check-sign passed: every answer fits its sign');
