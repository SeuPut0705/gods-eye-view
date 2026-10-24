import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDocumentTranslations,
  formatDate,
  formatNumber,
  msg,
  persistLocaleAndReload,
  setLocale,
  t,
  tn,
} from './index.js';
import {
  LOCALE_STORAGE_KEY,
  applyDocumentLanguage,
  normalizeLocale,
  resolveLocale,
  writeStoredLocale,
} from './locale.js';

afterEach(() => setLocale('en'));

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    data,
  };
}

test('normalizeLocale folds regional variants and rejects unshipped tags', () => {
  assert.equal(normalizeLocale('ko-KR'), 'ko');
  assert.equal(normalizeLocale(' KO '), 'ko');
  assert.equal(normalizeLocale('ko_KR'), 'ko');
  assert.equal(normalizeLocale('en_GB'), 'en');
  assert.equal(normalizeLocale('xx'), null);
  // Removed locales are no longer shipped.
  assert.equal(normalizeLocale('zh'), null);
  assert.equal(normalizeLocale('zh-CN'), null);
  assert.equal(normalizeLocale('ru-RU'), null);
  assert.equal(normalizeLocale('es'), null);
  assert.equal(normalizeLocale(undefined), null);
});

test('resolveLocale: ?lang= wins, then the stored choice, then browser languages, then English', () => {
  const storage = memoryStorage({ [LOCALE_STORAGE_KEY]: 'ko' });
  assert.equal(
    resolveLocale({
      location: { search: '?lang=en' },
      storage,
      languages: ['ko'],
    }),
    'en',
  );
  assert.equal(
    resolveLocale({ location: { search: '' }, storage, languages: ['en'] }),
    'ko',
  );
  assert.equal(
    resolveLocale({
      location: { search: '?lang=xx' },
      storage: memoryStorage(),
      languages: ['de-DE', 'ko-KR'],
    }),
    'ko',
  );
  assert.equal(
    resolveLocale({
      location: { search: '?lang=ru' },
      storage: memoryStorage(),
      languages: ['es-ES', 'zh-CN'],
    }),
    'en',
  );
  assert.equal(
    resolveLocale({
      location: { search: '' },
      storage: memoryStorage(),
      languages: ['de'],
    }),
    'en',
  );
});

test('a throwing storage never escapes', () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(
    resolveLocale({ location: { search: '' }, storage, languages: [] }),
    'en',
  );
  assert.equal(writeStoredLocale('ko', storage), false);
});

test('applyDocumentLanguage sets lang and dir', () => {
  const doc = { documentElement: {} };
  applyDocumentLanguage(doc, 'ko-KR');
  assert.deepEqual(doc.documentElement, { lang: 'ko', dir: 'ltr' });
});

test('t() returns English text in English and translates in Korean', () => {
  assert.equal(t('POWERED UP'), 'POWERED UP');
  setLocale('ko');
  assert.equal(t('POWERED UP'), '파워 업 완료');
});

test('t() interpolates named values and keeps unknown names literal', () => {
  assert.equal(
    t('Save failed: {detail}', { detail: 'disk full' }),
    'Save failed: disk full',
  );
  assert.equal(
    t('Hello {who} {missing}', { who: 'pilot' }),
    'Hello pilot {missing}',
  );
});

test('t() falls back to English for text without a translation', () => {
  setLocale('ko');
  assert.equal(t('No such message {n}', { n: 1 }), 'No such message 1');
});

test('tn() picks English plural forms and Korean single-form entries', () => {
  const label = (count) =>
    tn(
      count,
      'POWER UP · {count} KEY WAITING',
      'POWER UP · {count} KEYS WAITING',
    );
  assert.equal(label(1), 'POWER UP · 1 KEY WAITING');
  assert.equal(label(3), 'POWER UP · 3 KEYS WAITING');
  setLocale('ko');
  assert.equal(label(1), '파워 업 · 키 1개 대기 중');
  assert.equal(label(3), '파워 업 · 키 3개 대기 중');
  assert.equal(label(21), '파워 업 · 키 21개 대기 중');
});

test('t() context separates identical English with different meanings', () => {
  assert.equal(t('CLEAR', { context: 'action' }), 'CLEAR');
  setLocale('ko');
  assert.equal(t('CLEAR', { context: 'action' }), '지우기');
  assert.equal(t('CLEAR'), '맑음');
});

test('msg() returns its text unchanged', () => {
  assert.equal(msg('Live Flights'), 'Live Flights');
});

test('Intl formatters follow the active locale', () => {
  const date = new Date(Date.UTC(2026, 0, 15));
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  };
  assert.equal(formatDate(date, options), 'January 15, 2026');
  assert.equal(formatNumber(1234.5), '1,234.5');
  setLocale('ko');
  assert.equal(formatDate(date, options), '2026년 1월 15일');
  assert.equal(formatNumber(1234.5), '1,234.5');
});

function fakeElement({ text = '', attributes = {} } = {}) {
  const attrs = new Map(Object.entries(attributes));
  return {
    textContent: text,
    getAttribute: (name) => (attrs.has(name) ? attrs.get(name) : null),
    setAttribute: (name, value) => attrs.set(name, value),
    attrs,
  };
}

test('applyDocumentTranslations translates opted-in text and attributes in place', () => {
  const label = fakeElement({ text: '\n  POWERED\n  UP  ' });
  const pin = fakeElement({ attributes: { title: 'POWERED UP' } });
  const unknown = fakeElement({ text: 'No such message' });
  const doc = {
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return [label, unknown];
      if (selector === '[data-i18n-title]') return [pin];
      return [];
    },
  };
  assert.equal(
    applyDocumentTranslations(doc),
    0,
    'English leaves markup alone',
  );
  setLocale('ko');
  assert.equal(applyDocumentTranslations(doc), 2);
  assert.equal(label.textContent, '파워 업 완료');
  assert.equal(pin.attrs.get('title'), '파워 업 완료');
  assert.equal(unknown.textContent, 'No such message');
});

test('persistLocaleAndReload keeps the choice in ?lang when storage is blocked', () => {
  const calls = [];
  const location = {
    href: 'https://gev.local/?x=1#scene=a',
    assign: (url) => calls.push(['assign', url]),
    reload: () => calls.push(['reload']),
  };
  const history = {
    replaceState: (_s, _t, url) => calls.push(['replace', url]),
  };
  const storage = {
    setItem() {
      throw new Error('blocked');
    },
  };
  assert.equal(
    persistLocaleAndReload('ko', { location, history, storage }),
    true,
  );
  assert.deepEqual(calls, [
    ['replace', 'https://gev.local/?x=1&lang=ko#scene=a'],
    ['reload'],
  ]);
});

test('persistLocaleAndReload stores the choice, keeps the hash, strips ?lang', () => {
  const storage = memoryStorage();
  const calls = [];
  const location = {
    href: 'https://gev.local/?lang=en&x=1#scene=a',
    assign: (url) => calls.push(['assign', url]),
    reload: () => calls.push(['reload']),
  };
  const history = {
    replaceState: (_s, _t, url) => calls.push(['replace', url]),
  };
  assert.equal(
    persistLocaleAndReload('ko', { location, history, storage }),
    true,
  );
  assert.equal(storage.data.get(LOCALE_STORAGE_KEY), 'ko');
  assert.deepEqual(calls, [
    ['replace', 'https://gev.local/?x=1#scene=a'],
    ['reload'],
  ]);
});

test('tn() shows a caller-formatted count and still picks the form by number', () => {
  const label = (n) =>
    tn(n, '{count} map object', '{count} map objects', {
      count: formatNumber(n),
    });
  assert.equal(label(12345), '12,345 map objects');
  assert.equal(tn(12345, '{count} file', '{count} files'), '12345 files');
  setLocale('ko');
  try {
    assert.equal(label(12345), '지도 객체 12,345개');
    assert.equal(label(1), '지도 객체 1개');
  } finally {
    setLocale('en');
  }
});
