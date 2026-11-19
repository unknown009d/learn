import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { encodeFrames, createAssembler, parseFrame, crc32, CHUNK_SIZE } from '../js/sync/qr-frames.js';

const demoToken = readFileSync(new URL('../WEB25-014_druba-web_mastery-demo.vwfd', import.meta.url), 'utf8').trim();

const shuffled = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

test('crc32 matches the standard check value', () => {
  assert.equal(crc32('123456789'), 'cbf43926');
});

test('every frame has the same length so the QR size never changes', () => {
  const frames = encodeFrames(demoToken);
  assert.ok(frames.length > 1);
  assert.equal(new Set(frames.map((f) => f.length)).size, 1);
});

test('a full backup reassembles exactly from frames in any order, with repeats', () => {
  const frames = encodeFrames(demoToken);
  const asm = createAssembler();
  const stream = shuffled([...frames, ...frames.slice(0, 5)]);
  for (const f of stream) asm.accept(f);
  assert.equal(asm.complete, true);
  assert.equal(asm.token(), demoToken);
});

test('repeats are reported as duplicates and do not count twice', () => {
  const [first] = encodeFrames(demoToken);
  const asm = createAssembler();
  assert.equal(asm.accept(first), 'added');
  assert.equal(asm.accept(first), 'duplicate');
  assert.equal(asm.have, 1);
});

test('a frame with a misread character is rejected by its checksum', () => {
  const [first] = encodeFrames(demoToken);
  const pos = first.length - 10;
  const garbled = first.slice(0, pos) + (first[pos] === 'A' ? 'B' : 'A') + first.slice(pos + 1);
  assert.deepEqual(parseFrame(garbled), { corrupt: true });
  const asm = createAssembler();
  assert.equal(asm.accept(garbled), 'corrupt');
  assert.equal(asm.have, 0);
});

test('frames from a different transfer restart collection instead of mixing', () => {
  const a = encodeFrames(demoToken, { sid: 'aaaa' });
  const b = encodeFrames(demoToken, { sid: 'bbbb' });
  const asm = createAssembler();
  asm.accept(a[0]);
  asm.accept(a[1]);
  assert.equal(asm.accept(b[2]), 'restarted');
  assert.equal(asm.have, 1);
  for (const f of b) asm.accept(f);
  assert.equal(asm.token(), demoToken);
});

test('unrelated QR codes (like a certificate link) are ignored', () => {
  const asm = createAssembler();
  assert.equal(asm.accept('https://druba.in/learn/#/verify?v=abc'), 'ignored');
  assert.equal(asm.accept(''), 'ignored');
});

test('a token shorter than one chunk still round-trips', () => {
  const asm = createAssembler();
  const frames = encodeFrames('vwfd-v1.short');
  assert.equal(frames.length, 1);
  asm.accept(frames[0]);
  assert.equal(asm.token(), 'vwfd-v1.short');
});

test('the mastery demo backup needs a reasonable number of frames', () => {
  const frames = encodeFrames(demoToken);
  assert.equal(frames.length, Math.ceil(demoToken.length / CHUNK_SIZE));
  assert.ok(frames.length <= 40, `expected <= 40 frames, got ${frames.length}`);
});
