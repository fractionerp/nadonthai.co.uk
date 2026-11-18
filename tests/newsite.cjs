// Usage: node tests/newsite.cjs [Jekyll build directory]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] || '_site');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');
const home = read('newsite/index.html');
const menus = {};

for (const location of ['morpeth', 'newcastle', 'durham']) {
  assert.match(home, new RegExp('/newsite/' + location + '/#menus'));
  const page = read('newsite/' + location + '/index.html');
  assert.match(page, /<meta name="robots" content="noindex, follow">/);
  assert.match(page, new RegExp('/book-a-table-' + location + '/'));
  assert.match(page, new RegExp('/assets/menus/menu-' + location + '-takeaway.pdf'));
  assert.match(page, /\/assets\/menus\/menu-allergies\.pdf/);
  assert.doesNotMatch(page, /"price"=>|Liquid error|<dd>\s*<\/dd>/);
  menus[location] = Object.fromEntries(
    [...page.matchAll(/<details class="service-menu" id="menu-([\w-]+)"[^>]*>([\s\S]*?)<\/details>/g)]
      .map(([, service, markup]) => [service, markup])
  );
  assert.deepEqual(Object.keys(menus[location]), ['evening', 'lunch', 'takeaway', 'happy-hour', 'childrens', 'dessert', 'christmas']);
}

for (const service of Object.keys(menus.newcastle)) {
  const removePdf = markup => markup.replace(/<a class="print-menu"[^>]*>[^<]*<\/a>/, '');
  assert.equal(removePdf(menus.newcastle[service]), removePdf(menus.durham[service]), service);
  assert.match(menus.newcastle[service], /class="print-menu"/);
  assert.match(menus.morpeth[service], /class="print-menu"/);
}

assert.match(menus.newcastle.evening, /Lamb shank massaman<\/h5><span>£21\.00/);
assert.doesNotMatch(menus.morpeth.evening, /Lamb shank massaman/);
assert.match(menus.morpeth.evening, /Three-flavoured prawns<\/h5><span>£17\.00/);
assert.doesNotMatch(menus.newcastle.evening, /Three-flavoured prawns/);
assert.match(menus.morpeth.evening, /Vegetables and tofu<\/dt><dd>£14\.25/);
assert.match(menus.newcastle.lunch, /Tapas sets/);
assert.match(menus.morpeth.lunch, /One course<\/dt><dd>£12\.00/);
assert.match(menus.morpeth.takeaway, /Spare ribs in red wine sauce<\/h5><span>£7\.50/);
assert.doesNotMatch(menus.newcastle.takeaway, /Spare ribs in red wine sauce/);
assert.doesNotMatch(read('sitemap.xml'), /\/newsite\//);
assert.ok(!fs.existsSync(path.join(root, '_brand')));

console.log('Newsite links, menu prices, location variants and indexing checks passed.');
