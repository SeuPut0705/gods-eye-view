// Preset place names show in the UI language at the presentation boundary
// (voice results, location pills, HUD); the preset data stays English.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../i18n/index.js';
import { CITY_POIS } from '../cityPois.js';
import { KNOWN_PLACE_NAMES, localizePlaceName } from './placeNames.js';
import { LocationControls } from './locationControls.js';

test.afterEach(() => setLocale('en'));

test('every preset city has a display name entry', () => {
  for (const city of Object.values(CITY_POIS))
    assert.ok(KNOWN_PLACE_NAMES.includes(city.name), city.name);
});

test('en: place names pass through unchanged', () => {
  setLocale('en');
  for (const name of KNOWN_PLACE_NAMES)
    assert.equal(localizePlaceName(name), name);
});

for (const [locale, tokyo, losAngeles] of [
  ['ko', '도쿄', '로스앤젤레스'],
]) {
  test(`${locale}: preset names are translated, other places shown as given`, () => {
    setLocale(locale);
    assert.equal(localizePlaceName('Tokyo'), tokyo);
    assert.equal(localizePlaceName('Los Angeles'), losAngeles);
    assert.equal(localizePlaceName('Ulaanbaatar'), 'Ulaanbaatar');
    assert.equal(localizePlaceName(undefined), undefined);
  });
}

function element() {
  return {
    children: [],
    dataset: {},
    textContent: '',
    addEventListener() {},
    removeEventListener() {},
    appendChild(child) {
      this.children.push(child);
    },
    replaceChildren() {
      this.children = [];
    },
  };
}

test('ko: location pills and the mini-status show the translated city', () => {
  setLocale('ko');
  const elements = {
    pills: element(),
    poiRow: element(),
    divider: element(),
    search: element(),
    searchToggle: element(),
    resetButtons: [],
    statusCity: element(),
    statusPoi: element(),
  };
  const doc = { ...element(), createElement: element };
  const cities = { tokyo: CITY_POIS.tokyo };
  const controls = new LocationControls({
    elements,
    cities,
    getExpandedCity: () => null,
    onCity() {},
    onPoi() {},
    onSearch() {},
    onReset() {},
    doc,
    requestFrame: () => 0,
    cancelFrame() {},
  });
  assert.equal(elements.pills.children[0].textContent, '도쿄');
  controls.renderStatus({ city: CITY_POIS.tokyo, currentPoi: null });
  assert.equal(elements.statusCity.textContent, '📍 도쿄');
  assert.equal(CITY_POIS.tokyo.name, 'Tokyo');
});
