/**
 * In-memory learner state loaded from IndexedDB, plus course gating and progress rules.
 *
 * Course flow per module: lessons → graded quiz → that module's labs → next module.
 * Every rule below is derived from MODULES / LABS, so adding a module or lab needs no code change here.
 */

import { getProfile, getAllQuizzes, getAllPracticals, getAllLessonProgress } from '../db.js';
import { MODULES, getModuleById } from '../course-data.js';
import { LABS, getLabById } from '../labs-data.js';

export const PASSING_PERCENT = 60;

export const appState = {
  profile: null,
  quizzes: new Map(),
  practicals: new Map(),
  lessons: new Set(),
  activeIDE: null,
  cleanupSplitResizers: null,
  cleanupRouteView: null,
  shortcutContext: null, // { onRunAdvance?, onRunPreview?, onReset?, onSave? }
  certCache: null, // L1 in-memory validated signed certificate
  certIssuePromise: null, // deduplicates background prefetch & route fetch
  certIssueGeneration: 0, // invalidates in-flight fetches on reset / backup import
  certRenderToken: 0, // guards async render if user navigates away
  audioManifest: null, // { voice, lessons: { [id]: { file, duration, voice } } }
  stopLessonAudio: null
};

export async function refreshStateFromDB() {
  const [profile, quizzes, practicals, lessons] = await Promise.all([
    getProfile(),
    getAllQuizzes(),
    getAllPracticals(),
    getAllLessonProgress()
  ]);
  appState.profile = profile;
  appState.quizzes = new Map(quizzes.map((q) => [Number(q.moduleId), q]));
  appState.practicals = new Map(practicals.map((p) => [Number(p.labId), p]));
  appState.lessons = new Set((lessons || []).filter((l) => l.completed).map((l) => l.lessonKey));
}

// ----------------------------------------------------------------------------
// Primitive checks
// ----------------------------------------------------------------------------

export function isRegistered() {
  return Boolean(appState.profile && appState.profile.fullName && appState.profile.rollNo);
}

export function isLessonCompleted(moduleId, lessonId) {
  return appState.lessons.has(`${Number(moduleId)}:${lessonId}`);
}

export function isQuizPassed(moduleId) {
  return Boolean(appState.quizzes.get(Number(moduleId))?.passed);
}

export function isLabCompleted(labId) {
  return Boolean(appState.practicals.get(Number(labId))?.completed);
}

export function countCompletedLessons(moduleId) {
  const mod = getModuleById(moduleId);
  return (mod?.sections || []).filter((sec) => isLessonCompleted(mod.id, sec.id)).length;
}

function areModuleLessonsCompleted(moduleId) {
  const mod = getModuleById(moduleId);
  return Boolean(mod) && countCompletedLessons(mod.id) === mod.sections.length;
}

export function areModuleLabsCompleted(moduleId) {
  const mod = getModuleById(moduleId);
  return !mod || mod.labIds.every((id) => isLabCompleted(id));
}

/** A module is complete only when its lessons were read, its quiz passed and its labs verified. */
export function isModuleCompleted(moduleId) {
  return areModuleLessonsCompleted(moduleId) && isQuizPassed(moduleId) && areModuleLabsCompleted(moduleId);
}

/** "Lab 1", "Labs 4 and 5", "Labs 1, 2 and 3" */
function describeLabs(labIds) {
  const codes = labIds.map((id) => getLabById(id)?.code.replace(/^Lab\s+/, '')).filter(Boolean);
  if (codes.length <= 1) return `Lab ${codes[0] ?? ''}`.trim();
  return `Labs ${codes.slice(0, -1).join(', ')} and ${codes[codes.length - 1]}`;
}

// ----------------------------------------------------------------------------
// Gates — each returns { unlocked, reason, targetHash? }
// ----------------------------------------------------------------------------

const OPEN = { unlocked: true, reason: '' };

export function getModuleGateStatus(moduleId) {
  if (!isRegistered()) {
    return { unlocked: false, reason: 'Enter your full name and ID on the Home page to start Module 1.', targetHash: '#/' };
  }
  const index = MODULES.findIndex((m) => m.id === Number(moduleId));
  if (index < 0) return { unlocked: false, reason: 'Module not found.' };
  if (index === 0) return OPEN;

  const mod = MODULES[index];
  const prev = MODULES[index - 1];
  if (!isQuizPassed(prev.id)) {
    return {
      unlocked: false,
      reason: `Pass the Module ${prev.id} Quiz (${PASSING_PERCENT}% or higher) to unlock Module ${mod.id}.`,
      targetHash: getQuizGateStatus(prev.id).unlocked ? `#/quiz/${prev.id}` : getNextLessonHash(prev.id)
    };
  }
  const pendingLabId = prev.labIds.find((id) => !isLabCompleted(id));
  if (pendingLabId !== undefined) {
    return {
      unlocked: false,
      reason: `Finish ${describeLabs(prev.labIds)} in Module ${prev.id} to unlock Module ${mod.id}.`,
      targetHash: `#/lab/${pendingLabId}`
    };
  }
  return OPEN;
}

/** The quiz opens once every lesson in the module has been worked through (or if it was already passed). */
export function getQuizGateStatus(moduleId) {
  const modGate = getModuleGateStatus(moduleId);
  if (!modGate.unlocked) return modGate;
  if (isQuizPassed(moduleId) || areModuleLessonsCompleted(moduleId)) return OPEN;

  const mod = getModuleById(moduleId);
  const total = mod.sections.length;
  return {
    unlocked: false,
    reason: `Work through all ${total} lessons in Module ${mod.id} to unlock its quiz (${countCompletedLessons(mod.id)} of ${total} done).`,
    targetHash: getNextLessonHash(mod.id)
  };
}

export function getLabGateStatus(labId) {
  const lab = getLabById(labId);
  if (!lab) return { unlocked: false, reason: 'Lab not found.' };
  const modGate = getModuleGateStatus(lab.moduleId);
  if (!modGate.unlocked) return modGate;
  if (!isQuizPassed(lab.moduleId)) {
    const quizGate = getQuizGateStatus(lab.moduleId);
    return {
      unlocked: false,
      reason: `Pass the Module ${lab.moduleId} Quiz (${PASSING_PERCENT}% or higher) to unlock ${lab.code}.`,
      targetHash: quizGate.unlocked ? `#/quiz/${lab.moduleId}` : quizGate.targetHash
    };
  }
  return OPEN;
}

export function isCertificateUnlocked() {
  return isRegistered() && MODULES.every((m) => isQuizPassed(m.id)) && LABS.every((l) => isLabCompleted(l.id));
}

// ----------------------------------------------------------------------------
// Progress & "what next"
// ----------------------------------------------------------------------------

/** Milestones = one quiz per module + every lab. */
export function computeOverallProgress() {
  const totalSteps = MODULES.length + LABS.length;
  const done = MODULES.filter((m) => isQuizPassed(m.id)).length + LABS.filter((l) => isLabCompleted(l.id)).length;
  return { done, totalSteps, percent: Math.round((done / totalSteps) * 100) };
}

function getNextLessonHash(moduleId) {
  const mod = getModuleById(moduleId);
  const idx = (mod?.sections || []).findIndex((sec) => !isLessonCompleted(mod.id, sec.id));
  return `#/module/${moduleId}/lesson/${idx >= 0 ? idx + 1 : 1}`;
}

export function getNextRecommendedRoute() {
  if (!isRegistered()) return '#/';
  for (const mod of MODULES) {
    if (!isQuizPassed(mod.id)) {
      return areModuleLessonsCompleted(mod.id) ? `#/quiz/${mod.id}` : getNextLessonHash(mod.id);
    }
    const pendingLabId = mod.labIds.find((id) => !isLabCompleted(id));
    if (pendingLabId !== undefined) return `#/lab/${pendingLabId}`;
  }
  return '#/certificate';
}
