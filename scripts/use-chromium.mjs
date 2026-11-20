// For cloud sessions, which have Chromium but no WebKit, and a Chromium that
// is not the build this Playwright version expects. Preload it so the checks
// run unchanged, in Chromium:
//
//   node --import ./scripts/use-chromium.mjs scripts/check-play.mjs
//
// Set PW_CHROMIUM to use a Chromium somewhere other than /opt/pw-browsers.
import { chromium, webkit } from '@playwright/test';

const executablePath = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';
const launch = chromium.launch.bind(chromium);
chromium.launch = (options = {}) => launch({ ...options, executablePath });
webkit.launch = (options = {}) => launch({ ...options, executablePath });
