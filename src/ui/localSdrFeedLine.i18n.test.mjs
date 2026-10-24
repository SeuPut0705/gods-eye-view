import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../i18n/index.js';
import { localSdrFeedLine } from './localSdrPresentation.js';

for (const locale of ['ko']) {
  test(`decoder feed line is translated in ${locale}`, () => {
    setLocale(locale);
    try {
      const feeds = [{ id: '1090', band: '1090', status: 'live' }];
      const polling = localSdrFeedLine({
        configured: true,
        polling: true,
        feeds: [{ ...feeds[0], status: 'unreachable' }],
      });
      const idle = localSdrFeedLine({
        configured: true,
        polling: false,
        feeds,
      });
      assert.doesNotMatch(polling, /Decoder feeds|unreachable/);
      assert.match(polling, /1090/);
      assert.doesNotMatch(idle, /Decoder feeds|read while Local ADS-B is on/);
      assert.match(idle, /1090/);
    } finally {
      setLocale('en');
    }
  });
}

test('an unknown feed status is shown as given', () => {
  setLocale('en');
  const feeds = [{ band: '1090', status: 'odd' }];
  assert.equal(
    localSdrFeedLine({ configured: true, polling: true, feeds }),
    'Decoder feeds: 1090 odd',
  );
});

// The shared "invalid" key is looked up with the "feed status" context, so a
// feed shows its own wording.
test('ko: an invalid decoder feed reads "유효하지 않음"', () => {
  setLocale('ko');
  try {
    const line = localSdrFeedLine({
      configured: true,
      polling: true,
      feeds: [
        { band: '1090', status: 'live' },
        { band: '1090', status: 'invalid' },
      ],
    });
    assert.match(line, /1090 #2 유효하지 않음/);
    assert.doesNotMatch(line, /\binvalid\b/);
  } finally {
    setLocale('en');
  }
});
