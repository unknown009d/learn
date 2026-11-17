/**
 * Cryptographic Completion Key & Checkpoint Token Engine
 * Uses native CompressionStream('gzip'), DecompressionStream('gzip'),
 * Base64URL encoding, and Web Crypto SHA-256 digests.
 */

const COMPLETION_SALT = 'DRUBA_WEB_FOUNDATIONS_SALT_2025';
const KEY_PREFIX_GZIP = 'druba-web-v1.';
const KEY_PREFIX_RAW = 'druba-web-v1r.';
const BACKUP_PREFIX_GZIP = 'druba-web-bak1.';
const BACKUP_PREFIX_RAW = 'druba-web-bak1r.';

function bytesToBase64Url(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url) {
  let b64 = b64url.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function gzipText(text) {
  const rawBytes = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'function') {
    return { compressed: false, bytes: rawBytes };
  }
  const stream = new Blob([rawBytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return { compressed: true, bytes: new Uint8Array(buffer) };
}

async function gunzipBytes(bytes, isCompressed) {
  if (!isCompressed) {
    return new TextDecoder().decode(bytes);
  }
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser does not support native DecompressionStream("gzip").');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buffer);
}

/**
 * Pure-JS SHA-256 fallback used only if crypto.subtle is unavailable on non-HTTPS LAN origins.
 */
function sha256Fallback(asciiBytes) {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const rotr = (n, x) => (x >>> n) | (x << (32 - n));
  const len = asciiBytes.length;
  const bitLen = len * 8;
  const paddedLen = Math.ceil((len + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(asciiBytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Uint32Array(64);
  for (let i = 0; i < paddedLen; i += 64) {
    for (let t = 0; t < 16; t++) W[t] = view.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, W[t - 15]) ^ rotr(18, W[t - 15]) ^ (W[t - 15] >>> 3);
      const s1 = rotr(17, W[t - 2]) ^ rotr(19, W[t - 2]) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return Array.from(H).map((v) => v.toString(16).padStart(8, '0')).join('');
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  if (window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return sha256Fallback(bytes);
}

export function buildCanonicalPayload(fullState) {
  const profile = fullState.profile || {};
  const quizzes = (fullState.quizzes || [])
    .slice()
    .sort((a, b) => a.moduleId - b.moduleId)
    .map((q) => ({
      moduleId: Number(q.moduleId),
      bestScorePercent: Number(q.bestScorePercent || 0),
      attempts: Number(q.attempts || 0),
      passed: Boolean(q.passed),
      completedAt: q.completedAt || null
    }));

  const practicals = (fullState.practicals || [])
    .slice()
    .sort((a, b) => a.labId - b.labId)
    .map((p) => ({
      labId: Number(p.labId),
      htmlCode: p.htmlCode || '',
      cssCode: p.cssCode || '',
      jsCode: p.jsCode || '',
      exactOutputSnapshot: p.exactOutputSnapshot || '',
      passedAssertions: Number(p.passedAssertions || 0),
      totalAssertions: Number(p.totalAssertions || 0),
      activeTypingSeconds: Number(p.activeTypingSeconds || 0),
      pasteCount: Number(p.pasteCount || 0),
      completed: Boolean(p.completed),
      completedAt: p.completedAt || null
    }));

  return {
    v: 1,
    courseCode: 'druba-web',
    courseName: 'Learning the Web with Basics of Vanilla Front-End Tools (druba.in)',
    student: {
      fullName: String(profile.fullName || '').trim(),
      rollNo: String(profile.rollNo || '').trim()
    },
    issuedAt: fullState.issuedAt || new Date().toISOString(),
    quizzes,
    practicals
  };
}

export async function generateCompletionKey(fullState) {
  const payload = buildCanonicalPayload(fullState);
  const canonicalJson = JSON.stringify(payload);
  const signature = await sha256Hex(`${canonicalJson}|${COMPLETION_SALT}`);
  const envelopeJson = JSON.stringify({ p: payload, s: signature });
  const { compressed, bytes } = await gzipText(envelopeJson);
  const prefix = compressed ? KEY_PREFIX_GZIP : KEY_PREFIX_RAW;
  const key = prefix + bytesToBase64Url(bytes);

  return {
    key,
    payload,
    signature,
    compressed,
    byteLength: bytes.length
  };
}

export async function verifyCompletionKey(rawKey) {
  const trimmed = String(rawKey || '').trim();
  if (!trimmed) {
    return { valid: false, tampered: false, error: 'Please paste a Certificate Verification Code to check.' };
  }

  let isCompressed = true;
  let b64Body = '';

  if (trimmed.startsWith(KEY_PREFIX_GZIP)) {
    isCompressed = true;
    b64Body = trimmed.slice(KEY_PREFIX_GZIP.length);
  } else if (trimmed.startsWith(KEY_PREFIX_RAW)) {
    isCompressed = false;
    b64Body = trimmed.slice(KEY_PREFIX_RAW.length);
  } else {
    return {
      valid: false,
      tampered: true,
      error: 'This verification code does not look complete. Make sure you copied the entire Certificate Verification Code.'
    };
  }

  try {
    const bytes = base64UrlToBytes(b64Body);
    const jsonStr = await gunzipBytes(bytes, isCompressed);
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== 'object' || !parsed.p || typeof parsed.s !== 'string') {
      return {
        valid: false,
        tampered: true,
        error: 'This verification code could not be read properly.'
      };
    }

    const expectedSignature = await sha256Hex(`${JSON.stringify(parsed.p)}|${COMPLETION_SALT}`);
    const valid = parsed.s === expectedSignature;

    return {
      valid,
      tampered: !valid,
      payload: parsed.p,
      signature: parsed.s,
      expectedSignature,
      error: valid ? null : 'This verification code has been altered and does not match the original certificate.'
    };
  } catch (err) {
    return {
      valid: false,
      tampered: true,
      error: `Could not read this verification code: ${err.message}`
    };
  }
}

export async function generateCompactQrToken(fullState, fullCodeSignature = '') {
  const quizScores = [1, 2, 3, 4, 5].map((m) => {
    const q = (fullState.quizzes || []).find((x) => Number(x.moduleId) === m);
    return Number(q?.bestScorePercent || 0);
  });
  const avgScore = Math.round(quizScores.reduce((a, b) => a + b, 0) / 5);
  const labsPassed = (fullState.practicals || []).filter((p) => p.completed).length;

  const name = String(fullState.profile?.fullName || '').trim();
  const rollNo = String(fullState.profile?.rollNo || '').trim();
  const date = String(fullState.issuedAt || new Date().toISOString()).slice(0, 10);
  const codeHash = String(fullCodeSignature || '').slice(0, 10);

  // Compact positional tuple keeps the QR code low-density and fast to scan
  const tuple = [name, rollNo, date, quizScores, labsPassed, codeHash];
  const fullSig = await sha256Hex(`${JSON.stringify(tuple)}|${COMPLETION_SALT}`);
  const sig = fullSig.slice(0, 16);
  const token = bytesToBase64Url(new TextEncoder().encode(JSON.stringify([...tuple, sig])));
  const verifyId = `DRUBA-WEB-${sig.slice(0, 10).toUpperCase()}`;

  return {
    token,
    verifyId,
    payload: {
      name,
      rollNo,
      course: 'Learning the Web with Basics of Vanilla Front-End Tools (druba.in)',
      date,
      quizScores,
      avgScore,
      labsPassed,
      codeHash,
      sig
    }
  };
}

export async function verifyCompactQrToken(tokenString) {
  let trimmed = String(tokenString || '').trim();
  if (!trimmed) {
    return { valid: false, tampered: false, error: 'The QR verification code is missing.' };
  }
  if (trimmed.includes('?v=')) {
    trimmed = trimmed.replace(/^.*?\?v=/, '').split('&')[0].trim();
  }
  try {
    const bytes = base64UrlToBytes(trimmed);
    const parsed = JSON.parse(new TextDecoder().decode(bytes));

    if (Array.isArray(parsed) && parsed.length === 7 && typeof parsed[6] === 'string') {
      const tuple = [
        String(parsed[0] || ''),
        String(parsed[1] || ''),
        String(parsed[2] || ''),
        Array.isArray(parsed[3]) ? parsed[3].map(Number) : [],
        Number(parsed[4] || 0),
        String(parsed[5] || '')
      ];
      const sig = String(parsed[6]);
      const expectedFullSig = await sha256Hex(`${JSON.stringify(tuple)}|${COMPLETION_SALT}`);
      const expectedSig = expectedFullSig.slice(0, 16);
      const valid = sig === expectedSig;
      const quizScores = tuple[3];
      const avgScore = quizScores.length
        ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
        : 0;

      return {
        valid,
        tampered: !valid,
        payload: {
          name: tuple[0],
          rollNo: tuple[1],
          course: 'Learning the Web with Basics of Vanilla Front-End Tools (druba.in)',
          date: tuple[2],
          quizScores,
          avgScore,
          labsPassed: tuple[4],
          codeHash: tuple[5],
          sig
        },
        signature: sig,
        expectedSignature: expectedSig,
        verifyId: `DRUBA-WEB-${sig.slice(0, 10).toUpperCase()}`,
        error: valid ? null : 'This QR code was altered and no longer matches the original certificate.'
      };
    }

    if (!parsed || typeof parsed !== 'object' || typeof parsed.sig !== 'string') {
      return { valid: false, tampered: true, error: 'This QR verification link could not be read.' };
    }
    const core = {
      name: String(parsed.name || ''),
      rollNo: String(parsed.rollNo || ''),
      course: String(parsed.course || ''),
      date: String(parsed.date || ''),
      quizScores: Array.isArray(parsed.quizScores) ? parsed.quizScores.map(Number) : [],
      avgScore: Number(parsed.avgScore || 0),
      labsPassed: Number(parsed.labsPassed || 0),
      codeHash: String(parsed.codeHash || '')
    };
    const expectedFullSig = await sha256Hex(`${JSON.stringify(core)}|${COMPLETION_SALT}`);
    const expectedSig = expectedFullSig.slice(0, 24);
    const valid = parsed.sig === expectedSig;
    return {
      valid,
      tampered: !valid,
      payload: parsed,
      signature: parsed.sig,
      expectedSignature: expectedSig,
      verifyId: `DRUBA-WEB-${String(parsed.sig).slice(0, 10).toUpperCase()}`,
      error: valid ? null : 'This QR code was altered and no longer matches the original certificate.'
    };
  } catch (err) {
    return {
      valid: false,
      tampered: true,
      error: `Could not read QR verification code: ${err.message}`
    };
  }
}

export async function encodeBackupToken(fullState) {
  const json = JSON.stringify(fullState);
  const { compressed, bytes } = await gzipText(json);
  const prefix = compressed ? BACKUP_PREFIX_GZIP : BACKUP_PREFIX_RAW;
  return prefix + bytesToBase64Url(bytes);
}

export async function decodeBackupToken(tokenString) {
  const trimmed = String(tokenString || '').trim();
  if (!trimmed) {
    throw new Error('Please choose a saved progress file or paste your backup text first.');
  }

  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }

  let isCompressed = true;
  let body = '';

  if (trimmed.startsWith(BACKUP_PREFIX_GZIP)) {
    isCompressed = true;
    body = trimmed.slice(BACKUP_PREFIX_GZIP.length);
  } else if (trimmed.startsWith(BACKUP_PREFIX_RAW)) {
    isCompressed = false;
    body = trimmed.slice(BACKUP_PREFIX_RAW.length);
  } else {
    throw new Error('Could not recognize this backup. Upload a saved progress file (.json) or paste the full backup text.');
  }

  const bytes = base64UrlToBytes(body);
  const json = await gunzipBytes(bytes, isCompressed);
  return JSON.parse(json);
}

export async function generateDemoKey(tamper = false) {
  const baseTime = Date.now() - 3600 * 1000 * 5;
  const ts = (minOffset) => new Date(baseTime + minOffset * 60000).toISOString();

  const demoState = {
    issuedAt: ts(280),
    profile: {
      fullName: 'Ananya Das',
      rollNo: 'WEB25-014'
    },
    quizzes: [
      { moduleId: 1, bestScorePercent: 90, attempts: 1, passed: true, completedAt: ts(30) },
      { moduleId: 2, bestScorePercent: 80, attempts: 2, passed: true, completedAt: ts(75) },
      { moduleId: 3, bestScorePercent: 90, attempts: 1, passed: true, completedAt: ts(150) },
      { moduleId: 4, bestScorePercent: 100, attempts: 1, passed: true, completedAt: ts(220) },
      { moduleId: 5, bestScorePercent: 80, attempts: 1, passed: true, completedAt: ts(270) }
    ],
    practicals: [
      {
        labId: 1,
        htmlCode: `<h1>Ananya Das</h1>\n<p>Learning front-end web engineering with <b>HTML5, CSS3, and JavaScript</b>.</p>\n<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Ujjayanta_Palace_Agartala.jpg/320px-Ujjayanta_Palace_Agartala.jpg" alt="Ujjayanta Palace in Agartala" width="240">\n<p><a href="https://swayam.gov.in" target="_blank">Explore SWAYAM Courses</a></p>`,
        cssCode: '',
        jsCode: '',
        passedAssertions: 5,
        totalAssertions: 5,
        activeTypingSeconds: 142,
        pasteCount: 0,
        completed: true,
        completedAt: ts(90)
      },
      {
        labId: 2,
        htmlCode: `<form action="register.php" method="post">\n  <label for="fullname">Full Name</label>\n  <input id="fullname" name="name" type="text" required>\n  <label for="email">Email</label>\n  <input id="email" name="email" type="email" required>\n  <label for="pwd">Password</label>\n  <input id="pwd" name="pwd" type="password" required>\n  <input type="radio" name="batch" value="morning" id="m" checked> <label for="m">Morning</label>\n  <input type="radio" name="batch" value="evening" id="e"> <label for="e">Evening</label>\n  <input type="submit" value="Register">\n</form>`,
        cssCode: '',
        jsCode: '',
        passedAssertions: 5,
        totalAssertions: 5,
        activeTypingSeconds: 196,
        pasteCount: 0,
        completed: true,
        completedAt: ts(105)
      },
      {
        labId: 3,
        htmlCode: `<h2>Course Schedule &amp; Topics</h2>\n<table border="1" cellpadding="8">\n  <tr><th colspan="3">Time Table</th></tr>\n  <tr><th>Day</th><th>Time</th><th>Subject</th></tr>\n  <tr><td rowspan="2">Monday</td><td>10:30</td><td>HTML</td></tr>\n  <tr><td>12:00</td><td>CSS</td></tr>\n</table>\n<ul>\n  <li>Front End\n    <ul>\n      <li>HTML5</li>\n      <li>CSS3</li>\n    </ul>\n  </li>\n  <li>Back End</li>\n</ul>`,
        cssCode: '',
        jsCode: '',
        passedAssertions: 5,
        totalAssertions: 5,
        activeTypingSeconds: 175,
        pasteCount: 0,
        completed: true,
        completedAt: ts(120)
      },
      {
        labId: 4,
        htmlCode: `<style>\n  body { background-color: lightyellow; font-family: Arial, sans-serif; }\n</style>\n<h1 id="title">Welcome to Web Design</h1>\n<p class="alert">Live practical sessions start at 10:30 AM.</p>`,
        cssCode: `#title {\n  color: darkgreen;\n  text-align: center;\n}\n.alert {\n  color: red;\n  padding: 12px;\n  border: 2px solid #1E88E5;\n}`,
        jsCode: '',
        passedAssertions: 4,
        totalAssertions: 4,
        activeTypingSeconds: 118,
        pasteCount: 0,
        completed: true,
        completedAt: ts(230)
      },
      {
        labId: 5,
        htmlCode: `<form id="regForm">\n  <input id="nameInput" type="text" placeholder="Full Name"><br><br>\n  <input id="emailInput" type="email" placeholder="Email"><br><br>\n  <input id="passInput" type="password" placeholder="Password (min 6 chars)"><br><br>\n  <button type="submit">Validate &amp; Register</button>\n</form>\n<p id="msg"></p>`,
        cssCode: `#msg { font-weight: bold; margin-top: 10px; }`,
        jsCode: `const form = document.getElementById("regForm");\nconst msg = document.getElementById("msg");\nform.addEventListener("submit", function (e) {\n  e.preventDefault();\n  try {\n    const name = document.getElementById("nameInput").value.trim();\n    const email = document.getElementById("emailInput").value.trim();\n    const pwd = document.getElementById("passInput").value;\n    if (!name) throw new Error("Name is required");\n    if (!email.includes("@")) throw new Error("Valid email is required");\n    if (pwd.length < 6) throw new Error("Password must be at least 6 characters");\n    msg.textContent = "Registration valid!";\n    msg.style.color = "green";\n  } catch (err) {\n    msg.textContent = "Error: " + err.message;\n    msg.style.color = "red";\n  }\n});`,
        passedAssertions: 5,
        totalAssertions: 5,
        activeTypingSeconds: 215,
        pasteCount: 0,
        completed: true,
        completedAt: ts(170)
      },
      {
        labId: 6,
        htmlCode: `<div class="clock-card">\n  <h2>Live Campus Clock</h2>\n  <p id="dateDisplay"></p>\n  <p id="timeDisplay"></p>\n</div>`,
        cssCode: `.clock-card { padding: 20px; border: 2px solid #0e7a3a; border-radius: 12px; text-align: center; }`,
        jsCode: `function updateClock() {\n  const now = new Date();\n  document.getElementById("dateDisplay").textContent = now.toLocaleDateString("en-IN");\n  document.getElementById("timeDisplay").textContent = now.toLocaleTimeString();\n}\nupdateClock();\nsetInterval(updateClock, 1000);`,
        passedAssertions: 4,
        totalAssertions: 4,
        activeTypingSeconds: 124,
        pasteCount: 0,
        completed: true,
        completedAt: ts(195)
      },
      {
        labId: 7,
        htmlCode: `<h2 id="heading">Old Notice</h2>\n<div id="infoBox">Original content</div>\n<button id="updateBtn">Update Notice</button>`,
        cssCode: `#infoBox { padding: 12px; border: 1px solid #999; margin: 10px 0; }`,
        jsCode: `document.getElementById("updateBtn").addEventListener("click", function () {\n  const box = document.getElementById("infoBox");\n  box.innerHTML = "<strong>Updated:</strong> Lab exam on <em>Friday</em>!";\n  box.style.backgroundColor = "lightyellow";\n  document.getElementById("heading").textContent = "Updated Notice";\n});`,
        passedAssertions: 4,
        totalAssertions: 4,
        activeTypingSeconds: 130,
        pasteCount: 0,
        completed: true,
        completedAt: ts(245)
      },
      {
        labId: 8,
        htmlCode: `<div class="layout-box">\n  <h3>Notice Board</h3>\n  <p>Office closed on <span class="highlight">Sunday</span>.</p>\n</div>`,
        cssCode: `.layout-box {\n  width: 280px;\n  padding: 20px;\n  border: 4px solid green;\n  margin: 20px;\n  box-sizing: border-box;\n  background-color: lightyellow;\n}\n.highlight {\n  color: red;\n  font-weight: bold;\n}`,
        jsCode: '',
        passedAssertions: 5,
        totalAssertions: 5,
        activeTypingSeconds: 160,
        pasteCount: 1,
        completed: true,
        completedAt: ts(260)
      }
    ]
  };

  const generated = await generateCompletionKey(demoState);
  if (!tamper) {
    return generated.key;
  }

  // Produce an authentic-looking but tampered key (altered score without updating signature)
  const decoded = await verifyCompletionKey(generated.key);
  const tamperedPayload = JSON.parse(JSON.stringify(decoded.payload));
  tamperedPayload.quizzes[0].bestScorePercent = 100; // Tampered!
  const envelopeJson = JSON.stringify({ p: tamperedPayload, s: decoded.signature });
  const { compressed, bytes } = await gzipText(envelopeJson);
  return (compressed ? KEY_PREFIX_GZIP : KEY_PREFIX_RAW) + bytesToBase64Url(bytes);
}
