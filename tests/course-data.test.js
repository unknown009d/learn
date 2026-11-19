import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../js/course-data.js';
import { QUIZZES } from '../js/quiz-data.js';
import { LABS, getLabById } from '../js/labs-data.js';

test('every quiz question has a valid, unique answer', () => {
  for (const mod of MODULES) {
    const quiz = QUIZZES[mod.id];
    assert.ok(quiz, `Module ${mod.id} has a quiz`);
    const ids = new Set();
    for (const q of quiz.questions) {
      assert.ok(!ids.has(q.id), `duplicate question id ${q.id}`);
      ids.add(q.id);
      assert.ok(q.options.length >= 3, `${q.id} has at least 3 options`);
      assert.equal(new Set(q.options).size, q.options.length, `${q.id} options are distinct`);
      assert.ok(q.correctIndex >= 0 && q.correctIndex < q.options.length, `${q.id} correctIndex in range`);
      assert.ok(q.explanation, `${q.id} has an explanation`);
    }
  }
});

test('every lesson Quick Check has a valid answer', () => {
  for (const mod of MODULES) {
    for (const sec of mod.sections) {
      const mc = sec.microCheck;
      if (!mc) continue;
      assert.ok(mc.correctIndex >= 0 && mc.correctIndex < mc.options.length, `${sec.id} correctIndex in range`);
      assert.ok(mc.options.length <= 4, `${sec.id} fits the A–D option labels`);
    }
  }
});

test('labs are wired to their modules and numbered in course order', () => {
  assert.equal(new Set(LABS.map((l) => l.id)).size, LABS.length, 'lab ids are unique');
  for (const mod of MODULES) {
    for (const id of mod.labIds) {
      assert.equal(getLabById(id)?.moduleId, mod.id, `lab ${id} belongs to module ${mod.id}`);
    }
  }
  const courseOrder = MODULES.flatMap((m) => m.labIds);
  assert.deepEqual(LABS.map((l) => l.id), courseOrder, 'LABS array follows module order');
  LABS.forEach((lab, idx) => assert.equal(lab.code, `Lab ${idx + 1}`, `${lab.title} is labelled in order`));
});
