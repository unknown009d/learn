import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeTrailForQr,
  decodeTrailFromQr,
  encodeTrailForKey,
  decodeTrailFromKey,
  splitKeyAndTrail,
  isMasteryTrail,
  getMasteryRank
} from '../js/integrity/trail-format.js';

const sample = [
  { type: 'devtools-shortcut', count: 2, where: 'Lab 1', detail: 'F12', firstAt: '2026-11-19T10:00:00.000Z', lastAt: '2026-11-19T10:05:00.000Z', seconds: 0 },
  { type: 'scripted-input', count: 10, where: 'Module 2 quiz', detail: 'click on "Submit Quiz"', firstAt: '2026-11-19T10:01:00.000Z', lastAt: '2026-11-19T10:01:00.000Z', seconds: 0 },
  { type: 'storage-edited', count: 1, where: 'IndexedDB', detail: 'Changed outside the app: quizzes — “ünïcödé”', firstAt: '2026-11-19T10:02:00.000Z', lastAt: '2026-11-19T10:02:00.000Z', seconds: 0 }
];

test('QR form keeps totals per type', () => {
  const qr = encodeTrailForQr(sample);
  assert.equal(qr, 'K2S10I1');
  assert.deepEqual(decodeTrailFromQr(qr).map((e) => [e.type, e.count]), [['devtools-shortcut', 2], ['scripted-input', 10], ['storage-edited', 1]]);
});

test('key form round-trips full detail, including non-ASCII text', () => {
  const decoded = decodeTrailFromKey(encodeTrailForKey(sample));
  assert.deepEqual(decoded, sample.map(({ type, count, where, detail, firstAt, lastAt, seconds }) => ({ type, count, where, detail, firstAt, lastAt, seconds })));
  assert.deepEqual(decodeTrailFromKey('not-base64!!'), []);
});

test('verification code and trail split on "~"', () => {
  assert.deepEqual(splitKeyAndTrail('druba-web-v1.abc~xyz'), { key: 'druba-web-v1.abc', trail: 'xyz' });
  assert.deepEqual(splitKeyAndTrail('druba-web-v1.abc'), { key: 'druba-web-v1.abc', trail: '' });
});

test('only hands-on signals earn the mastery badge, ranked by variety', () => {
  assert.equal(isMasteryTrail([sample[0]]), false, 'just opening DevTools is not mastery');
  assert.equal(getMasteryRank([sample[0]]), null);
  assert.equal(getMasteryRank(sample.slice(0, 2)).title, 'Script Kiddie');
  assert.equal(getMasteryRank(sample).title, 'Hacktivist');
  const four = ['scripted-input', 'editor-injection', 'lab-check-forged', 'storage-edited'].map((type) => ({ type, count: 1 }));
  assert.equal(getMasteryRank(four).title, 'Root');
});
