/**
 * Native IndexedDB Storage Wrapper for Vanilla Web Foundations
 * Object stores: student_profile, quizzes, practicals, lesson_progress, certificates, trail
 */

const DB_NAME = 'druba_web_learning_db';
const DB_VERSION = 4;

let dbPromise = null;
const memoryFallback = {
  student_profile: new Map(),
  quizzes: new Map(),
  practicals: new Map(),
  lesson_progress: new Map(),
  certificates: new Map(),
  trail: new Map()
};

/**
 * Called after every progress write the app makes (not trail or certificate-cache writes).
 * The inspection trail uses it to re-seal progress, so edits made outside the app stand out.
 */
let afterProgressWrite = null;
export function setAfterProgressWriteHook(fn) {
  afterProgressWrite = typeof fn === 'function' ? fn : null;
}
async function notifyProgressWrite() {
  try {
    await afterProgressWrite?.();
  } catch (err) {
    console.warn('[db.js] after-write hook failed:', err);
  }
}

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('student_profile')) {
        db.createObjectStore('student_profile', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('quizzes')) {
        db.createObjectStore('quizzes', { keyPath: 'moduleId' });
      }
      if (!db.objectStoreNames.contains('practicals')) {
        db.createObjectStore('practicals', { keyPath: 'labId' });
      }
      if (!db.objectStoreNames.contains('lesson_progress')) {
        db.createObjectStore('lesson_progress', { keyPath: 'lessonKey' });
      }
      if (!db.objectStoreNames.contains('certificates')) {
        db.createObjectStore('certificates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('trail')) {
        db.createObjectStore('trail', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });

  return dbPromise;
}

async function withStore(storeName, mode, operation) {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = operation(store);

      if (req && typeof req.onsuccess !== 'undefined') {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } else {
        tx.oncomplete = () => resolve(undefined);
        tx.onerror = () => reject(tx.error);
      }
    });
  } catch (err) {
    console.warn(`[db.js] Falling back to in-memory store for ${storeName}:`, err);
    return null;
  }
}

export async function getProfile() {
  const rec = await withStore('student_profile', 'readonly', (s) => s.get('current'));
  if (rec !== null) return rec || null;
  return memoryFallback.student_profile.get('current') || null;
}

export async function saveProfile(data) {
  const existing = (await getProfile()) || {};
  const record = {
    ...existing,
    ...data,
    id: 'current',
    updatedAt: new Date().toISOString()
  };
  if (!record.createdAt) {
    record.createdAt = record.updatedAt;
  }
  memoryFallback.student_profile.set('current', record);
  await withStore('student_profile', 'readwrite', (s) => s.put(record));
  await notifyProgressWrite();
  return record;
}

export async function getQuiz(moduleId) {
  const numId = Number(moduleId);
  const rec = await withStore('quizzes', 'readonly', (s) => s.get(numId));
  if (rec !== null) return rec || null;
  return memoryFallback.quizzes.get(numId) || null;
}

export async function getAllQuizzes() {
  const list = await withStore('quizzes', 'readonly', (s) => s.getAll());
  if (Array.isArray(list)) {
    return list.sort((a, b) => a.moduleId - b.moduleId);
  }
  return Array.from(memoryFallback.quizzes.values()).sort((a, b) => a.moduleId - b.moduleId);
}

export async function saveQuizAttempt(moduleId, scorePercent, passed, details = {}) {
  const numId = Number(moduleId);
  const existing = (await getQuiz(numId)) || {
    moduleId: numId,
    bestScorePercent: 0,
    attempts: 0,
    passed: false,
    completedAt: null
  };

  const now = new Date().toISOString();
  const isPassed = Boolean(existing.passed || passed);

  const record = {
    ...existing,
    moduleId: numId,
    bestScorePercent: Math.max(existing.bestScorePercent || 0, Number(scorePercent)),
    lastScorePercent: Number(scorePercent),
    attempts: (existing.attempts || 0) + 1,
    passed: isPassed,
    completedAt: isPassed ? (existing.completedAt || now) : null,
    lastAttemptAt: now,
    ...details
  };

  memoryFallback.quizzes.set(numId, record);
  await withStore('quizzes', 'readwrite', (s) => s.put(record));
  await notifyProgressWrite();
  return record;
}

export async function getPractical(labId) {
  const numId = Number(labId);
  const rec = await withStore('practicals', 'readonly', (s) => s.get(numId));
  if (rec !== null) return rec || null;
  return memoryFallback.practicals.get(numId) || null;
}

export async function getAllPracticals() {
  const list = await withStore('practicals', 'readonly', (s) => s.getAll());
  if (Array.isArray(list)) {
    return list.sort((a, b) => a.labId - b.labId);
  }
  return Array.from(memoryFallback.practicals.values()).sort((a, b) => a.labId - b.labId);
}

export async function savePracticalProgress(labId, patch = {}) {
  const numId = Number(labId);
  const existing = (await getPractical(numId)) || {
    labId: numId,
    htmlCode: '',
    cssCode: '',
    jsCode: '',
    exactOutputSnapshot: '',
    passedAssertions: 0,
    totalAssertions: 0,
    activeTypingSeconds: 0,
    pasteCount: 0,
    completed: false,
    completedAt: null
  };

  const now = new Date().toISOString();
  const nextCompleted = Boolean(existing.completed || patch.completed);

  const record = {
    ...existing,
    ...patch,
    labId: numId,
    completed: nextCompleted,
    completedAt: nextCompleted ? (existing.completedAt || patch.completedAt || now) : null,
    updatedAt: now
  };

  memoryFallback.practicals.set(numId, record);
  await withStore('practicals', 'readwrite', (s) => s.put(record));
  await notifyProgressWrite();
  return record;
}

export async function getAllLessonProgress() {
  const list = await withStore('lesson_progress', 'readonly', (s) => s.getAll());
  if (Array.isArray(list)) {
    return list;
  }
  return Array.from(memoryFallback.lesson_progress.values());
}

export async function markLessonCompleted(moduleId, lessonId, lessonIndex) {
  const numMod = Number(moduleId);
  const lessonKey = `${numMod}:${lessonId}`;
  const now = new Date().toISOString();
  const record = {
    lessonKey,
    moduleId: numMod,
    lessonId: String(lessonId),
    lessonIndex: Number(lessonIndex),
    completed: true,
    completedAt: now
  };
  memoryFallback.lesson_progress.set(lessonKey, record);
  await withStore('lesson_progress', 'readwrite', (s) => s.put(record));
  await notifyProgressWrite();
  return record;
}

export async function exportFullState() {
  const [profile, quizzes, practicals, lessons, trail] = await Promise.all([
    getProfile(),
    getAllQuizzes(),
    getAllPracticals(),
    getAllLessonProgress(),
    getTrailEvents()
  ]);

  return {
    schema: 'DRUBA_WEB_CHECKPOINT_V1',
    courseCode: 'druba-web',
    courseTitle: 'Learning the Web with Basics of Vanilla Front-End Tools',
    exportedAt: new Date().toISOString(),
    profile,
    quizzes,
    practicals,
    lessons,
    trail
  };
}

export async function importFullState(stateObj) {
  if (!stateObj || typeof stateObj !== 'object') {
    throw new Error('Invalid checkpoint payload.');
  }
  if (!stateObj.profile || !stateObj.profile.fullName || !stateObj.profile.rollNo) {
    throw new Error('Checkpoint is missing valid student profile information.');
  }

  await clearAllData();

  // Write the profile directly: the seal is refreshed once at the end of the import.
  const profileRecord = { ...stateObj.profile, id: 'current' };
  memoryFallback.student_profile.set('current', profileRecord);
  await withStore('student_profile', 'readwrite', (s) => s.put(profileRecord));

  if (Array.isArray(stateObj.quizzes)) {
    for (const q of stateObj.quizzes) {
      if (q && typeof q.moduleId !== 'undefined') {
        const rec = { ...q, moduleId: Number(q.moduleId) };
        memoryFallback.quizzes.set(rec.moduleId, rec);
        await withStore('quizzes', 'readwrite', (s) => s.put(rec));
      }
    }
  }

  if (Array.isArray(stateObj.practicals)) {
    for (const p of stateObj.practicals) {
      if (p && typeof p.labId !== 'undefined') {
        const rec = { ...p, labId: Number(p.labId) };
        memoryFallback.practicals.set(rec.labId, rec);
        await withStore('practicals', 'readwrite', (s) => s.put(rec));
      }
    }
  }

  if (Array.isArray(stateObj.lessons)) {
    for (const l of stateObj.lessons) {
      if (l && l.lessonKey) {
        const rec = { ...l, moduleId: Number(l.moduleId) };
        memoryFallback.lesson_progress.set(rec.lessonKey, rec);
        await withStore('lesson_progress', 'readwrite', (s) => s.put(rec));
      }
    }
  }

  if (Array.isArray(stateObj.trail)) {
    for (const t of stateObj.trail) {
      if (t && typeof t.key === 'string') await putTrailEvent(t);
    }
  }

  await notifyProgressWrite();
  return exportFullState();
}

// ----------------------------------------------------------------------------
// Inspection trail (see js/integrity/trail.js)
// ----------------------------------------------------------------------------

export async function getTrailEvents() {
  const list = await withStore('trail', 'readonly', (s) => s.getAll());
  const events = Array.isArray(list) ? list : Array.from(memoryFallback.trail.values());
  return events.sort((a, b) => String(a.firstAt).localeCompare(String(b.firstAt)));
}

export async function putTrailEvent(event) {
  memoryFallback.trail.set(event.key, event);
  await withStore('trail', 'readwrite', (s) => s.put(event));
  return event;
}

export async function getCachedCertificate() {
  const rec = await withStore('certificates', 'readonly', (s) => s.get('current'));
  if (rec !== null) return rec || null;
  return memoryFallback.certificates.get('current') || null;
}

export async function saveCachedCertificate(certData) {
  const record = {
    ...certData,
    id: 'current',
    cachedAt: new Date().toISOString()
  };
  memoryFallback.certificates.set('current', record);
  await withStore('certificates', 'readwrite', (s) => s.put(record));
  return record;
}

export async function clearCachedCertificate() {
  memoryFallback.certificates.clear();
  await withStore('certificates', 'readwrite', (s) => s.clear());
}

export async function clearAllData() {
  memoryFallback.student_profile.clear();
  memoryFallback.quizzes.clear();
  memoryFallback.practicals.clear();
  memoryFallback.lesson_progress.clear();
  memoryFallback.certificates.clear();
  memoryFallback.trail.clear();

  await withStore('student_profile', 'readwrite', (s) => s.clear());
  await withStore('quizzes', 'readwrite', (s) => s.clear());
  await withStore('practicals', 'readwrite', (s) => s.clear());
  await withStore('lesson_progress', 'readwrite', (s) => s.clear());
  await withStore('certificates', 'readwrite', (s) => s.clear());
  await withStore('trail', 'readwrite', (s) => s.clear());
  await notifyProgressWrite();
}
