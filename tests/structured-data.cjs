// Usage: node tests/structured-data.cjs [Jekyll build directory]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] || '_site');

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? files(filename) : filename.endsWith('.html') ? [filename] : [];
  });
}
function blocks(filename) {
  return [...fs.readFileSync(filename, 'utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
}
function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(nodes)];
}
function typed(filename, type) {
  return blocks(filename).flatMap(nodes).filter(node => node['@type'] === type);
}
const home = path.join(root, 'index.html');
const organization = typed(home, 'Organization');
assert.equal(organization.length, 1);
assert.equal(typed(home, 'WebSite').length, 1);
assert.equal(typed(home, 'Restaurant').length, 0, 'Homepage must not create partial Restaurant entities');
assert.equal(organization[0].subOrganization.length, 3);
const base = organization[0].url;
const branchIds = new Set();
let restaurantCount = 0;

for (const filename of files(root)) {
  const entities = typed(filename, 'Restaurant');
  const relative = path.relative(root, filename).replaceAll(path.sep, '/');
  const branch = relative.match(/^nadon-thai-(morpeth|newcastle|durham)\/index.html$/);
  assert.equal(entities.length, branch ? 1 : 0, 'Unexpected Restaurant count on ' + relative);
  if (!branch) continue;
  restaurantCount += entities.length;
  const site = branch[1];
  const restaurant = entities[0];
  const url = base + 'nadon-thai-' + site + '/';
  assert.equal(restaurant.url, url);
  assert.equal(restaurant['@id'], url + '#restaurant');
  branchIds.add(restaurant['@id']);
  assert.equal(restaurant.parentOrganization['@id'], organization[0]['@id']);
  assert.equal(restaurant.acceptsReservations, true);
  assert.equal(restaurant.address['@type'], 'PostalAddress');
  assert(!Array.isArray(restaurant.address));
  for (const key of ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry']) assert(restaurant.address[key]);
  assert.equal(restaurant.address.addressCountry, 'GB');
  assert.match(restaurant.telephone, /^\+44\d{10}$/);
  assert.equal(typeof restaurant.geo.latitude, 'number');
  assert.equal(typeof restaurant.geo.longitude, 'number');
  assert.match(restaurant.hasMap, /^https:\/\/www.google.com\/maps\/place\/\?q=place_id:ChIJ/);
  assert.equal(restaurant.menu, base + 'menu/');
  assert.equal(restaurant.openingHoursSpecification.length, 3);
  const lunch = restaurant.openingHoursSpecification[0];
  assert.equal(lunch.opens, '12:00');
  assert.equal(lunch.closes, '14:30');
  for (const day of ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) {
    const dinner = restaurant.openingHoursSpecification.filter(hours => hours.dayOfWeek.includes(day) && hours.opens === '17:00');
    assert.equal(dinner.length, 1, site + ' needs exactly one dinner period for ' + day);
    assert.equal(dinner[0].closes, ['Friday', 'Saturday'].includes(day) ? '22:00' : '21:30');
  }
  const reservation = restaurant.potentialAction.find(action => action['@type'] === 'ReserveAction');
  assert.equal(reservation.target.urlTemplate, base + 'book-a-table-' + site + '/');
  const order = restaurant.potentialAction.filter(action => action['@type'] === 'OrderAction');
  assert.equal(order.length, site === 'morpeth' ? 0 : 1);
  if (order.length) assert.match(order[0].target.urlTemplate, new RegExp('^https://www\\.just-eat\\.co\\.uk/.*' + site));
  assert(restaurant.sameAs.some(profile => profile.includes('tripadvisor.co.uk')));
  assert.equal(typed(filename, 'BreadcrumbList').length, 1);
  for (const asset of [restaurant.image, restaurant.logo]) {
    assert(asset.startsWith(base));
    assert(fs.existsSync(path.join(root, asset.slice(base.length))));
  }
}
assert.equal(restaurantCount, 3);
assert.deepEqual(new Set(organization[0].subOrganization.map(branch => branch['@id'])), branchIds);
const alias = fs.readFileSync(path.join(root, 'menus/index.html'), 'utf8');
assert(alias.includes('http-equiv="refresh"'));
assert(alias.includes('href="' + base + 'menu/"'));
assert(!fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').includes(base + 'menus/'));
console.log('All JSON-LD parses; homepage Organization/WebSite, three unique branch Restaurants, actions, references, assets and legacy menu alias validated.');
