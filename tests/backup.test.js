import { test } from 'node:test';
import assert from 'node:assert/strict';

// crypto-key.js targets the browser; Node provides the same Web APIs on globalThis.
globalThis.window = globalThis;
const { encodeBackupToken, decodeBackupTokenDetailed, computeVwfdSignature, verifyCompletionKey } = await import('../js/crypto-key.js');

const state = {
  schema: 'DRUBA_WEB_CHECKPOINT_V1',
  profile: { fullName: 'Test Learner', rollNo: 'T-1' },
  quizzes: [{ moduleId: 1, bestScorePercent: 80, attempts: 1, passed: true }],
  practicals: [],
  lessons: [],
  trail: []
};

const toToken = (envelope) => `vwfd-v1r.${Buffer.from(JSON.stringify(envelope)).toString('base64url')}`;

test('an exported backup round-trips and is not flagged as crafted', async () => {
  const { payload, crafted } = await decodeBackupTokenDetailed(await encodeBackupToken(state));
  assert.deepEqual(payload, state);
  assert.equal(crafted, false);
});

test('a hand-built v2 backup with a valid signature but no seal is flagged', async () => {
  const signature = await computeVwfdSignature(state);
  const { crafted } = await decodeBackupTokenDetailed(toToken({ format: 'VWFD', v: 2, payload: state, signature }));
  assert.equal(crafted, true);
});

test('legacy v1 backups are accepted without a flag', async () => {
  const signature = await computeVwfdSignature(state);
  const { crafted } = await decodeBackupTokenDetailed(toToken({ format: 'VWFD', v: 1, payload: state, signature }));
  assert.equal(crafted, false);
});

test('a wrong signature is rejected outright', async () => {
  await assert.rejects(decodeBackupTokenDetailed(toToken({ format: 'VWFD', v: 2, payload: state, signature: 'nope' })), /forged signature/);
});

test('a truncated verification code gets a readable error', async () => {
  const res = await verifyCompletionKey('druba-web-v1.abcdef');
  assert.equal(res.valid, false);
  assert.match(res.error, /incomplete or damaged/);
});
