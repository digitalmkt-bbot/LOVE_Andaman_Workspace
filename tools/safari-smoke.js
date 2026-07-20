// Safari-engine smoke test (runs WebKit — Safari's engine — on Windows via Playwright).
//
//   npm run safari                       → open production in a WebKit window, live console errors in terminal
//   npm run safari -- <url>              → same against another URL (e.g. the testing app)
//   npm run safari -- <url> --headless --for 30
//                                        → no window, auto-close after 30s, exit code 1 if errors (CI-able)
//
// Catches the Safari-only class of bugs Chrome hides: JavaScriptCore parse/reference errors,
// WebKit localStorage quota (QuotaExceededError), date-parsing quirks.
const { webkit } = require('playwright');

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--')) || 'https://loveandamanworkspace-production.up.railway.app';
const headless = args.includes('--headless');
const forIdx = args.indexOf('--for');
const seconds = forIdx >= 0 ? Number(args[forIdx + 1]) || 30 : 0;

(async () => {
  let errors = 0;
  const browser = await webkit.launch({ headless });
  const page = await browser.newPage(headless ? {} : { viewport: null });

  page.on('console', m => {
    const t = m.type();
    if (t === 'error' || t === 'warning') {
      if (t === 'error') errors++;
      console.log(`[console.${t}] ${m.text()}`);
    }
  });
  page.on('pageerror', e => { errors++; console.log(`[pageerror] ${e.message}`); });
  page.on('requestfailed', r => console.log(`[requestfailed] ${r.method()} ${r.url()} — ${r.failure() && r.failure().errorText}`));

  console.log(`WebKit ${browser.version()} → ${url}`);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(e => { errors++; console.log(`[goto] ${e.message}`); });

  if (seconds) {
    await page.waitForTimeout(seconds * 1000);
    console.log(`\n${errors ? '✗ ' + errors + ' error(s)' : '✓ no console/page errors'} after ${seconds}s`);
    await browser.close();
    process.exit(errors ? 1 : 0);
  } else {
    console.log('Browser is open — test by hand; errors stream above. Close the window to finish.');
    await new Promise(res => browser.on('disconnected', res));
    console.log(`\n${errors ? '✗ ' + errors + ' error(s) logged' : '✓ no console/page errors'}`);
  }
})();
