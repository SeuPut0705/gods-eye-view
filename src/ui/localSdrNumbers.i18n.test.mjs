// The SDR status line and stats write numbers in the UI language, like
// the frequency next to them ("Сканирование 101,1 МГц…").
import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../i18n/index.js';
import { localSdrCardView } from './localSdrPresentation.js';

const fm = {
  connected: true,
  status: 'streaming',
  mode: 'fm',
  message: 'Tuned',
  seekMessage: '',
  samplesPerSecond: 2_400_000,
  iqLevelDbfs: -21.44,
  audioLevelDbfs: -18.26,
  workerBlocks: 0,
  audioState: 'running',
  gain: 20.7,
  frequencyHz: 101_100_000,
  volume: 0.5,
  messagesPerSecond: 13.8,
  webUsbSupported: true,
};

test('en: SDR readings keep their English digits', () => {
  setLocale('en');
  const view = localSdrCardView(fm);
  assert.match(view.statusText, /· 2\.40 MS\/s IQ ·/);
  assert.match(view.statusText, /· RF -21\.4 dBFS ·/);
  assert.match(view.statusText, /-18\.3 dBFS audio/);
});

const koNumber = (value, digits) =>
  new Intl.NumberFormat('ko', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

for (const locale of ['ko']) {
  test(`${locale}: SDR readings are formatted through Intl for the locale`, () => {
    setLocale(locale);
    try {
      const view = localSdrCardView(fm);
      assert.ok(
        view.statusText.includes(`· ${koNumber(2.4, 2)} MS/s IQ ·`),
        view.statusText,
      );
      assert.ok(
        view.statusText.includes(`· RF ${koNumber(-21.44, 1)} dBFS ·`),
        view.statusText,
      );
      assert.ok(
        view.statusText.includes(`${koNumber(-18.26, 1)} dBFS 오디오`),
        view.statusText,
      );
      const adsb = localSdrCardView({ ...fm, mode: 'adsb' });
      assert.equal(adsb.stats.rate, koNumber(13.8, 1));
      assert.equal(adsb.stats.iq, `${koNumber(-21.44, 1)} dBFS`);
      assert.equal(adsb.gainValue, '20.7', 'input values stay machine');
    } finally {
      setLocale('en');
    }
  });
}
