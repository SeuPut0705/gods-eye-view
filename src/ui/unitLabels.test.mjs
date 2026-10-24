import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../i18n/index.js';
import { formatQuantity, formatScaleLabel, unitLabel } from './unitLabels.js';

test('English readings and scales read exactly as the unit ids', () => {
  setLocale('en');
  assert.equal(unitLabel('km/h'), 'km/h');
  assert.equal(unitLabel('°C'), '°C');
  assert.equal(unitLabel('dBZ'), 'dBZ');
  assert.equal(unitLabel(''), '');
  assert.equal(formatQuantity(95, 'kt'), '95 kt');
  assert.equal(formatQuantity(1006, 'hPa'), '1006 hPa');
  assert.equal(
    formatQuantity(22, 'km/h', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
    '22.0 km/h',
  );
  assert.deepEqual(
    ['0.1', '-40', '1050+', '300+', 'Calm'].map(formatScaleLabel),
    ['0.1', '-40', '1050+', '300+', 'Calm'],
  );
});

test('Korean readings keep the unit ids and group no digits', () => {
  try {
    setLocale('ko');
    assert.equal(
      formatQuantity(22, 'km/h', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      '22.0\u00a0km/h',
    );
    assert.equal(formatQuantity(1050, 'hPa'), '1050\u00a0hPa');
    assert.deepEqual(['0.1', '-40', '1050+'].map(formatScaleLabel), [
      '0.1',
      '-40',
      '1050+',
    ]);
  } finally {
    setLocale('en');
  }
});
