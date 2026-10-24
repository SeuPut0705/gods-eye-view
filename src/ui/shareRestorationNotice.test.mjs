// Share-tracking restore notices are ready-made sentences per policy: a label
// dropped into a template cannot take the case (ru) or article (es) needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../i18n/index.js';
import { SHARE_TRACKING_RESTORE_POLICIES } from '../data/layerState.js';
import { shareTrackingRestoreNotice } from './shareRestoration.js';

const { flights, military, satellites } = SHARE_TRACKING_RESTORE_POLICIES;

test.afterEach(() => setLocale('en'));

test('en: the notices for every policy and outcome', () => {
  setLocale('en');
  const notice = (policy, classification) =>
    shareTrackingRestoreNotice({ ...policy, classification });
  assert.equal(notice(flights, 'expired'), 'Shared flight follow expired');
  assert.equal(
    notice(military, 'expired'),
    'Shared military flight follow expired',
  );
  assert.equal(
    notice(satellites, 'source-unavailable'),
    'Shared satellite could not be restored — feed unavailable',
  );
  assert.equal(
    notice(flights, 'source-unavailable'),
    'Shared flight could not be restored — feed unavailable',
  );
  assert.equal(
    notice(military, 'unavailable'),
    'Shared military flight is unavailable',
  );
  assert.equal(
    notice(satellites, 'unavailable'),
    'Shared satellite is unavailable',
  );
  // Unknown label and classification: the generic template still applies.
  assert.equal(
    shareTrackingRestoreNotice({ label: 'contact', classification: 'odd' }),
    'Shared contact is unavailable',
  );
  assert.equal(
    shareTrackingRestoreNotice({ classification: 'expired' }),
    'Shared entity follow expired',
  );
});

test('ko: every policy and outcome reads as a ready-made Korean sentence', () => {
  setLocale('ko');
  const expected = {
    flights: {
      expired: '공유된 항공편 추적이 만료되었습니다',
      'source-unavailable': '공유된 항공편을 복원할 수 없습니다 — 피드 사용 불가',
      unavailable: '공유된 항공편을 사용할 수 없습니다',
    },
    military: {
      expired: '공유된 군용기 추적이 만료되었습니다',
      'source-unavailable': '공유된 군용기를 복원할 수 없습니다 — 피드 사용 불가',
      unavailable: '공유된 군용기를 사용할 수 없습니다',
    },
    satellites: {
      expired: '공유된 위성 추적이 만료되었습니다',
      'source-unavailable': '공유된 위성을 복원할 수 없습니다 — 피드 사용 불가',
      unavailable: '공유된 위성을 사용할 수 없습니다',
    },
  };
  const policies = { flights, military, satellites };
  for (const [name, byClassification] of Object.entries(expected)) {
    for (const [classification, text] of Object.entries(byClassification)) {
      const message = shareTrackingRestoreNotice({
        ...policies[name],
        classification,
      });
      assert.equal(message, text);
      assert.doesNotMatch(message, /Shared|\{subject\}/, message);
    }
  }
});
