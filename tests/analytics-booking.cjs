// Run against an archive of a production Jekyll build:
// docker exec websites tar -C /tmp/nadon-ga4-production -cf - . |
//   docker exec -i fraction_playwright node /tmp/analytics-booking.cjs
// Copy this file into that container first. Requires its existing Playwright package.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/tests/node_modules/playwright');
const assert = require('assert/strict');

(async () => {
  const directory = fs.mkdtempSync('/tmp/nadon-booking-check-');
  execFileSync('tar', ['-xf', '-', '-C', directory], { input: fs.readFileSync(0), maxBuffer: 128 * 1024 * 1024 });
  assert(!fs.existsSync(path.join(directory, 'AGENTS')));
  assert(!fs.existsSync(path.join(directory, 'CLAUDE')));
  assert(!fs.existsSync(path.join(directory, 'AGENTS.md')));
  assert(!fs.existsSync(path.join(directory, 'CLAUDE.md')));
  assert(!fs.existsSync(path.join(directory, 'tests')));
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const requests = [];
  const events = [];
  const errors = [];
  const isDebug = event => event._dbg === '1' || event['ep.debug_mode'] === 'true' || event['epn.debug_mode'] === '1';
  async function waitEvent(predicate) {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (events.some(predicate)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.fail('Expected GA payload did not arrive: ' + JSON.stringify(events.map(e => ({ en: e.en, site: e['ep.site'], dl: e.dl }))));
  }
  const origin = 'https://nadonthai.co.uk';
  const key = 'nadon-analytics-consent-v1';
  context.on('request', request => {
    const url = new URL(request.url());
    if (!url.hostname.includes('google-analytics.com') && !url.pathname.endsWith('/collect')) return;
    for (const line of (request.postData() || '').split('\n')) {
      const params = new URLSearchParams(url.search);
      new URLSearchParams(line).forEach((value, key) => params.set(key, value));
      if (params.has('en')) events.push(Object.fromEntries(params));
    }
  });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) {
      const file = path.join(directory, url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: 'Not found' });
      const contentType = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream';
      return route.fulfill({ body: fs.readFileSync(file), contentType });
    }
    if (url.hostname.includes('google-analytics.com') || url.pathname.endsWith('/collect')) {
      requests.push(url.href);
      // Validate real Google payloads without sending synthetic conversions to GA.
      return route.fulfill({ status: 204 });
    }
    if (url.hostname === 'www.googletagmanager.com') {
      requests.push(url.href);
      return route.continue();
    }
    if (url.hostname === 'cdn.jsdelivr.net' || url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) return route.continue();
    // Isolate our tag from resOS's independent tracking. Never interact with forms.
    return route.abort();
  });
  const page = await context.newPage();
  const calls = [];
  await page.exposeFunction('captureGtag', args => calls.push(args));
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const send = window.gtag;
      window.gtag = function () {
        window.captureGtag(Array.from(arguments));
        return send.apply(this, arguments);
      };
    });
  });
  page.on('popup', popup => popup.close());
  page.on('pageerror', error => errors.push(error.message));
  const visit = route => page.goto(origin + route, { waitUntil: 'networkidle' });
  const queue = () => page.evaluate(() => window.dataLayer.filter(item => item[0] === 'event').map(item => Array.from(item)));

  await visit('/?analytics_debug=1');
  await page.getByRole('button', { name: 'Reject analytics', exact: true }).click();
  for (const site of ['newcastle', 'durham', 'morpeth']) {
    await visit('/book-a-table-' + site + '/?analytics_debug=1');
    assert.equal((await queue()).length, 0);
  }
  await visit('/success-morpeth/?analytics_debug=1');
  assert.equal((await queue()).length, 0);
  await visit('/');
  await Promise.all([page.waitForURL('**/book-a-table-newcastle/'), page.locator('#locations a[href="/book-a-table-newcastle/"]').click()]);
  assert.equal((await queue()).length, 0);
  assert.equal(requests.length, 0);
  assert.equal((await context.cookies()).filter(c => c.name.startsWith('_ga')).length, 0);
  console.log('Rejected: no GA cookies, Google tag, collect requests or queued booking events; navigation works');

  await visit('/?analytics_debug=1');
  await page.getByRole('button', { name: 'Analytics settings', exact: true }).click();
  await page.getByRole('button', { name: 'Accept analytics', exact: true }).click();
  await page.waitForFunction(() => document.cookie.includes('_ga='));
  await waitEvent(event => event.en === 'page_view' && isDebug(event));
  console.log('Accepted: GA page_view payload has debug flag and correct tag is loaded');

  for (const site of ['newcastle', 'durham', 'morpeth']) {
    await visit('/nadon-thai-' + site + '/?analytics_debug=1');
    const destination = '/book-a-table-' + site + '/';
    await Promise.all([page.waitForURL(origin + destination), page.locator('#hero a[href="' + destination + '"]').click()]);
    const clicked = calls.filter(call => call[0] === 'event' && call[1] === 'book_click' && call[2].site === site);
    assert.equal(clicked.length, 1);
    assert.deepEqual(clicked[0][2], { site, link_location: 'hero', page_path: '/nadon-thai-' + site + '/' });
    await page.waitForLoadState('networkidle');
    assert.deepEqual((await queue()).filter(event => event[1] === 'booking_page_view'), [['event', 'booking_page_view', { site }]]);
    await waitEvent(event => event.en === 'booking_page_view' && event['ep.site'] === site && isDebug(event));
  }
  console.log('Real hero navigation: one book_click per click with correct parameters; all three booking-page events received');

  await visit('/?analytics_debug=1');
  await page.evaluate(() => {
    const fixtures = [
      ['#header', 'header', 'btn-book'], ['#hero', 'hero', 'btn-book'],
      ['#main', 'btn-gold', 'btn-gold'], ['#main', 'site_page', '']
    ];
    window.clickDefaults = [];
    fixtures.forEach(([parent, expected, classes]) => {
      const a = document.createElement('a');
      a.href = '/book-a-table-durham/?test=1';
      a.className = classes;
      a.target = '_blank';
      a.innerHTML = '<span>Booking</span>';
      a.dataset.expected = expected;
      document.querySelector(parent).appendChild(a);
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      a.firstChild.dispatchEvent(event);
      window.clickDefaults.push(event.defaultPrevented);
      a.remove();
    });
    const a = document.createElement('a');
    a.href = 'https://external.example/book-a-table-newcastle/';
    a.target = '_blank';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    a.remove();
  });
  const clicks = (await queue()).filter(event => event[1] === 'book_click');
  assert.deepEqual(clicks.map(event => event[2].link_location), ['header', 'hero', 'btn-gold', 'site_page']);
  assert.deepEqual(await page.evaluate(() => window.clickDefaults), [false, false, false, false]);
  await waitEvent(event => event.en === 'book_click' && event['ep.site'] === 'durham' && event['ep.link_location'] === 'site_page');
  const payload = events.find(event => event.en === 'book_click' && event['ep.link_location'] === 'btn-gold');
  assert.equal(payload['ep.site'], 'durham');
  assert.equal(payload['ep.page_path'] || payload.dp || new URL(payload.dl).pathname, '/');
  assert(isDebug(payload));
  console.log('Delegated listener handles nested/dynamic links, classes and locations, ignores external links, and never prevents navigation');

  await visit('/book-a-table-morpeth/?analytics_debug=1');
  await page.getByRole('button', { name: 'Analytics settings', exact: true }).click();
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.getByRole('button', { name: 'Reject analytics', exact: true }).click()]);
  assert.equal((await queue()).length, 0);
  await page.getByRole('button', { name: 'Analytics settings', exact: true }).click();
  await page.getByRole('button', { name: 'Accept analytics', exact: true }).click();
  assert.equal((await queue()).filter(event => event[1] === 'booking_page_view').length, 1);
  console.log('Consent accepted on booking page: booking_page_view fires exactly once');

  await visit('/success-morpeth/?analytics_debug=1');
  assert.deepEqual((await queue()).filter(event => event[1] === 'booking_request_sent'), [['event', 'booking_request_sent', { site: 'morpeth' }]]);
  await waitEvent(event => event.en === 'booking_request_sent' && event['ep.site'] === 'morpeth');
  await visit('/success-durham/');
  assert.equal((await queue()).length, 0);
  assert.deepEqual(errors, []);
  console.log('Morpeth confirmation event verified; no false Durham conversion; no JavaScript errors');
  console.log('Development notes and test files absent from production output');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
