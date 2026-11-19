import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../js/course-data.js';
import {
  appState,
  getModuleGateStatus,
  getQuizGateStatus,
  getLabGateStatus,
  isModuleCompleted,
  isCertificateUnlocked,
  computeOverallProgress,
  getNextRecommendedRoute
} from '../js/core/state.js';
import { LABS } from '../js/labs-data.js';

const [m1, m2] = MODULES;
const readAllLessons = (mod) => mod.sections.forEach((s) => appState.lessons.add(`${mod.id}:${s.id}`));
const passQuiz = (id) => appState.quizzes.set(id, { moduleId: id, passed: true, bestScorePercent: 90 });
const finishLab = (id) => appState.practicals.set(id, { labId: id, completed: true });

beforeEach(() => {
  appState.profile = { fullName: 'Test Learner', rollNo: 'T-1' };
  appState.quizzes = new Map();
  appState.practicals = new Map();
  appState.lessons = new Set();
});

test('nothing opens before registration', () => {
  appState.profile = null;
  assert.equal(getModuleGateStatus(1).unlocked, false);
  assert.equal(getNextRecommendedRoute(), '#/');
});

test('the quiz opens only after every lesson in the module', () => {
  assert.equal(getQuizGateStatus(1).unlocked, false);
  assert.equal(getQuizGateStatus(1).targetHash, '#/module/1/lesson/1');
  readAllLessons(m1);
  assert.equal(getQuizGateStatus(1).unlocked, true);
});

test('a quiz passed before lesson gating existed stays open', () => {
  passQuiz(1);
  assert.equal(getQuizGateStatus(1).unlocked, true);
});

test('labs follow the quiz, the next module follows the labs', () => {
  readAllLessons(m1);
  passQuiz(1);
  assert.equal(getModuleGateStatus(2).unlocked, true, 'module 1 has no labs');

  readAllLessons(m2);
  assert.equal(getLabGateStatus(m2.labIds[0]).unlocked, false, 'lab locked before the quiz');
  passQuiz(2);
  assert.equal(getLabGateStatus(m2.labIds[0]).unlocked, true);
  assert.equal(getModuleGateStatus(3).unlocked, false, 'module 3 waits for module 2 labs');
  assert.match(getModuleGateStatus(3).reason, /Labs 1, 2 and 3/);
  m2.labIds.forEach(finishLab);
  assert.equal(getModuleGateStatus(3).unlocked, true);
});

test('a module is complete only with lessons, quiz and labs done', () => {
  passQuiz(1);
  assert.equal(isModuleCompleted(1), false, 'quiz alone is not enough');
  readAllLessons(m1);
  assert.equal(isModuleCompleted(1), true);
});

test('certificate needs every quiz and lab; progress counts both', () => {
  MODULES.forEach((m) => passQuiz(m.id));
  assert.equal(isCertificateUnlocked(), false);
  LABS.forEach((l) => finishLab(l.id));
  assert.equal(isCertificateUnlocked(), true);
  assert.deepEqual(computeOverallProgress(), { done: MODULES.length + LABS.length, totalSteps: MODULES.length + LABS.length, percent: 100 });
});
