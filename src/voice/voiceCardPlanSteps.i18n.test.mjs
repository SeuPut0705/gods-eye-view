// Voice card in the UI language: every tool's plan step, the bare "Layer"
// step, whole error lines and long headlines, the Contacts snapshot clock.
// What the model receives stays English.
import assert from 'node:assert/strict';
import test from 'node:test';
import { setLocale } from '../i18n/index.js';
import { GEV_ACTION_SCHEMAS } from './actionSchemas.js';
import { presentResult, shownSnapshotTime } from './resultDisplay.js';
import { CITY_POIS } from '../cityPois.js';
import { attachVoiceResult, narrationLabel, planStepLabel } from './speech.js';
import {
  initialVoiceCardState,
  reduceVoiceCard,
  voiceCardView,
} from './voiceCardPresentation.js';

const TOOLS = GEV_ACTION_SCHEMAS.map((schema) => schema.name);

function inLocale(locale, run) {
  setLocale(locale);
  try {
    return run();
  } finally {
    setLocale('en');
  }
}

test('every tool has a plan label, never its raw name', () => {
  for (const name of TOOLS) {
    const label = planStepLabel(name, {});
    assert.notEqual(label, name.replace(/_/g, ' '), name);
    assert.doesNotMatch(label, /_/, name);
  }
  assert.equal(planStepLabel('analyst_query', {}), 'Analyst query');
  assert.equal(
    planStepLabel('adjust_camera_zoom', { direction: 'in' }),
    'Zoom in',
  );
  assert.equal(
    planStepLabel('adjust_camera_zoom', { direction: 'out' }),
    'Zoom out',
  );
  // A tool the card does not know keeps its name in English.
  assert.equal(planStepLabel('brand_new_tool', {}), 'brand new tool');
});

test('ko plan labels are all translated', () => {
  const english = Object.fromEntries(
    TOOLS.map((name) => [name, planStepLabel(name, { direction: 'out' })]),
  );
  inLocale('ko', () => {
    for (const name of TOOLS) {
      const label = planStepLabel(name, { direction: 'out' });
      assert.notEqual(label, english[name], `${name}: "${label}"`);
    }
  });
});

test('analyst query and an unknown tool in ko', () => {
  inLocale('ko', () => {
    assert.equal(planStepLabel('analyst_query', {}), '분석가 질의');
    assert.equal(planStepLabel('brand_new_tool', {}), '동작');
  });
});

test('a layer step with no layer reads in Korean', () => {
  const step = (enabled) => planStepLabel('set_layer_visibility', { enabled });
  assert.equal(step(true), 'Layer on');
  assert.equal(step(false), 'Layer off');
  inLocale('ko', () => {
    assert.equal(step(true), '레이어 켜기');
    assert.equal(step(false), '레이어 끄기');
    // A named layer keeps the shared "{label} on" wording.
    assert.match(
      planStepLabel('set_layer_visibility', {
        layerId: 'earthquakes',
        enabled: true,
      }),
      / 켜짐$/,
    );
  });
});

function cardAfter(name, result, args = {}) {
  let state = reduceVoiceCard(initialVoiceCardState(), {
    type: 'action-call',
    id: 'c1',
    name,
    arguments: args,
  });
  state = reduceVoiceCard(state, {
    type: 'action-result',
    id: 'c1',
    name,
    result: attachVoiceResult(name, result, args),
  });
  return voiceCardView(state);
}

const NO_PLACE = {
  ok: false,
  action: 'select_nearest_aircraft',
  stage: 'location',
  error:
    'Nearest-aircraft selection needs a preset, place name, or latitude and longitude',
  feed: {},
};

test('an error line shows whole, in every language', () => {
  for (const [locale, expected] of [
    ['en', NO_PLACE.error],
    [
      'ko',
      '가장 가까운 항공기 선택에는 프리셋, 장소 이름 또는 위도와 경도가 필요합니다',
    ],
  ]) {
    const view = inLocale(locale, () =>
      cardAfter('select_nearest_aircraft', NO_PLACE),
    );
    assert.deepEqual(view.result.lines, [expected], locale);
  }
});

test('a successful line keeps its 80-character cap', () => {
  const long = 'x'.repeat(120);
  const view = voiceCardView({
    ...initialVoiceCardState(),
    result: { display: { title: 'T', lines: [long] } },
  });
  assert.equal(view.result.lines[0].length, 80);
});

test('a translated analyst headline fits the card title whole', () => {
  // Longer than the English 64-character title cap, within the translated cap.
  const title =
    '최소 군용기 12대 로스앤젤레스에서 40 km 이내이며 이 범위에는 주변 지역 전체와 비행 중인 항공기, 그리고 가장 최근에 갱신된 분석 결과 요약 문장이 모두 포함됩니다';
  assert.ok(title.length > 64 && title.length <= 120, String(title.length));
  const card = () =>
    voiceCardView({
      ...initialVoiceCardState(),
      result: { display: { title, lines: [] } },
    }).result.title;
  assert.equal(inLocale('ko', card), title);
  // English keeps its 64-character title, equal to the spoken headline.
  const english = card();
  assert.ok(english.length <= 64 && english.endsWith('…'), english);
});

test('the snapshot time reads as a UTC clock, dated when not today', () => {
  const iso = '2026-10-15T14:32:05.000Z';
  const sameDay = Date.parse('2026-10-15T23:00:00Z');
  const nextDay = Date.parse('2026-10-16T00:10:00Z');
  assert.equal(shownSnapshotTime(iso, sameDay), iso, 'English keeps ISO');
  inLocale('ko', () => {
    assert.equal(shownSnapshotTime(iso, sameDay), '14:32:05 UTC');
    assert.equal(
      shownSnapshotTime(iso, nextDay),
      '2026. 10. 15., 14:32:05 UTC',
    );
    assert.equal(shownSnapshotTime('not a time'), 'not a time');
  });
});

test('the Contacts note shows the clock; the model note stays ISO', () => {
  const evaluatedAt = new Date();
  evaluatedAt.setUTCHours(14, 32, 5, 0);
  const iso = evaluatedAt.toISOString();
  const note = `Contacts panel snapshot at ${iso} — the same retained cohort supplies the card, speech, and follow-up memory.`;
  const result = {
    ok: true,
    count: 12,
    complete: true,
    scopeLabel: 'in view',
    display: { scope: 'in view' },
    coverage: { note },
    items: [],
  };
  const notes = inLocale('ko', () =>
    presentResult('analyst_query', result).display.notes.join(' | '),
  );
  assert.match(notes, /14:32:05 UTC 기준/);
  assert.doesNotMatch(notes, /T14:32/);
  assert.equal(result.coverage.note, note, 'the result is not changed');
});

test('plan steps and errors name a preset place in the UI language', () => {
  const failed = {
    ok: false,
    action: 'select_nearest_aircraft',
    stage: 'nearest',
    error:
      'Live Flights is enabled, but no airborne aircraft is loaded in the Tokyo view yet',
    location: { label: 'Tokyo' },
    feed: { state: 'nominal' },
  };
  assert.equal(
    planStepLabel('fly_to_location', { query: 'Tokyo' }),
    'Fly to Tokyo',
  );
  inLocale('ko', () => {
    assert.match(planStepLabel('fly_to_location', { query: 'Tokyo' }), /도쿄/);
    assert.match(
      planStepLabel('select_nearest_aircraft', { locationId: 'tokyo' }),
      /도쿄/,
    );
    const view = cardAfter('select_nearest_aircraft', failed);
    assert.match(view.result.lines[0], /도쿄/);
  });
  assert.match(failed.error, /Tokyo view/, 'the result stays English');
});

test('the analyst scope names Los Angeles in the UI language', () => {
  const result = {
    ok: true,
    count: 12,
    complete: false,
    scopeLabel: 'within 40 km of Los Angeles',
    display: { scope: 'within 40 km of Los Angeles' },
    coverage: { layersQueried: [{ layerKey: 'military' }] },
    items: [],
  };
  const title = inLocale(
    'ko',
    () => presentResult('analyst_query', result).display.title,
  );
  assert.equal(title, '최소 군용기 12대 로스앤젤레스에서 40 km 이내');
  assert.equal(result.scopeLabel, 'within 40 km of Los Angeles');
});

// A preset city id from the tool schema (sf, nyc, dc) reads as its city name.
test('a preset city id names the city in plan steps and narration', () => {
  const step = (id, action = 'fly_to_location') =>
    planStepLabel(action, { locationId: id });
  assert.equal(step('sf'), 'Fly to San Francisco');
  assert.equal(
    narrationLabel('fly_to_location', { locationId: 'dc' }),
    'Washington DC',
  );
  assert.equal(
    planStepLabel('fly_to_location', { query: 'Ulaanbaatar' }),
    'Fly to Ulaanbaatar',
    'other places are shown as given',
  );
  inLocale('ko', () => {
    assert.equal(step('tokyo'), '도쿄(으)로 이동');
    assert.equal(step('nyc'), '뉴욕(으)로 이동');
    assert.equal(step('sf'), '샌프란시스코(으)로 이동');
    for (const id of ['sf', 'nyc', 'dc'])
      assert.doesNotMatch(step(id), /\b(Sf|Nyc|Dc)$/, id);
    assert.equal(
      step('dc', 'select_nearest_aircraft'),
      '워싱턴 DC 인근 가장 가까운 항공기',
    );
  });
});

test('every locationId the voice tools accept is a preset city', () => {
  const ids = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.locationId?.enum))
      node.locationId.enum.forEach((id) => ids.add(id));
    Object.values(node).forEach(visit);
  };
  visit(GEV_ACTION_SCHEMAS);
  assert.ok(ids.size > 0, 'found the locationId enums');
  for (const id of ids) assert.ok(Object.hasOwn(CITY_POIS, id), id);
});
