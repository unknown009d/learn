/**
 * Cryptographic Completion Key & Checkpoint Token Engine
 * Uses native CompressionStream('gzip'), DecompressionStream('gzip'),
 * Base64URL encoding, and ECDSA P-256 (ES256) signatures issued by
 * the Cloudflare Worker and verified locally with the public key.
 */

export const CERT_WORKER_URL = 'https://druba-cert-api.dev-74a.workers.dev';

const SIGNING_PUBLIC_JWK = {
  kty: 'EC',
  x: 'jPN3ZBtzks0j5ivXufJhUHVUoM6xnp4h8SyzZnxio3Q',
  y: '5bPS0SjaALRXfpHb8_B78HiXVXvFDpJ-86ua4AaKAHY',
  crv: 'P-256'
};

const KEY_PREFIX_GZIP = 'druba-web-v1.';
const KEY_PREFIX_RAW = 'druba-web-v1r.';
export const VWFD_BACKUP_SECRET = 'DRUBA_WEB_FOUNDATIONS_VWFD_KEY_2026';
export const VWFD_PREFIX_GZIP = 'vwfd-v1.';
export const VWFD_PREFIX_RAW = 'vwfd-v1r.';

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

async function verifyEcdsaSignature(text, sigB64Url) {
  if (!window.crypto?.subtle) {
    throw new Error('Web Crypto ECDSA verification requires HTTPS or localhost.');
  }
  const key = await window.crypto.subtle.importKey(
    'jwk',
    SIGNING_PUBLIC_JWK,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
  const sigBytes = base64UrlToBytes(sigB64Url);
  return window.crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    sigBytes,
    new TextEncoder().encode(text)
  );
}

export async function issueSignedCertificate(fullState) {
  const payload = buildCanonicalPayload(fullState);
  const res = await fetch(`${CERT_WORKER_URL}/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Certificate server returned ${res.status}`);
  }
  const { verifyId, signature, qrSig, tuple } = data;
  const envelopeJson = JSON.stringify({ alg: 'ES256', p: payload, s: signature });
  const { compressed, bytes } = await gzipText(envelopeJson);
  const prefix = compressed ? KEY_PREFIX_GZIP : KEY_PREFIX_RAW;
  const key = prefix + bytesToBase64Url(bytes);
  const qrToken = bytesToBase64Url(new TextEncoder().encode(JSON.stringify([...tuple, qrSig])));

  return {
    key,
    payload,
    signature,
    qrToken,
    verifyId,
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

    if (parsed.alg !== 'ES256') {
      return {
        valid: false,
        tampered: true,
        payload: parsed.p,
        signature: parsed.s,
        error: 'This verification code is unsigned or uses a deprecated legacy format.'
      };
    }

    const valid = await verifyEcdsaSignature(JSON.stringify(parsed.p), parsed.s);

    return {
      valid,
      tampered: !valid,
      payload: parsed.p,
      signature: parsed.s,
      error: valid ? null : 'This verification code has an invalid or forged signature.'
    };
  } catch (err) {
    return {
      valid: false,
      tampered: true,
      error: `Could not read this verification code: ${err.message}`
    };
  }
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

    if (!Array.isArray(parsed) || parsed.length !== 7 || typeof parsed[6] !== 'string') {
      return { valid: false, tampered: true, error: 'This QR verification link could not be read.' };
    }

    const tuple = [
      String(parsed[0] || ''),
      String(parsed[1] || ''),
      String(parsed[2] || ''),
      Array.isArray(parsed[3]) ? parsed[3].map(Number) : [],
      Number(parsed[4] || 0),
      String(parsed[5] || '')
    ];
    const sig = String(parsed[6]);
    let valid = await verifyEcdsaSignature(JSON.stringify(tuple), sig);
    const verifyHash = await sha256Hex(sig);
    const verifyId = `DRUBA-WEB-${verifyHash.slice(0, 10).toUpperCase()}`;
    let error = valid ? null : 'This QR code has an invalid or forged signature.';

    // Optional registry/revocation check against Cloudflare Worker KV if bound
    if (valid) {
      try {
        const res = await fetch(`${CERT_WORKER_URL}/verify?id=${encodeURIComponent(verifyId)}`);
        if (res.ok) {
          const reg = await res.json();
          if (reg.revoked) {
            valid = false;
            error = 'This certificate has been revoked by the course administrator.';
          }
        }
      } catch {}
    }

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
      verifyId,
      error
    };
  } catch (err) {
    return {
      valid: false,
      tampered: true,
      error: `Could not read QR verification code: ${err.message}`
    };
  }
}

function canonicalizeForSigning(val) {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalizeForSigning);
  }
  const sorted = {};
  for (const k of Object.keys(val).sort()) {
    sorted[k] = canonicalizeForSigning(val[k]);
  }
  return sorted;
}

export async function computeVwfdSignature(payload) {
  const canonical = canonicalizeForSigning(payload);
  const jsonStr = JSON.stringify(canonical);
  return sha256Hex(`${jsonStr}|${VWFD_BACKUP_SECRET}`);
}

export async function encodeBackupToken(fullState) {
  const signature = await computeVwfdSignature(fullState);
  const envelope = {
    format: 'VWFD',
    v: 1,
    issuedAt: new Date().toISOString(),
    payload: fullState,
    signature
  };
  const envelopeJson = JSON.stringify(envelope);
  const { compressed, bytes } = await gzipText(envelopeJson);
  const prefix = compressed ? VWFD_PREFIX_GZIP : VWFD_PREFIX_RAW;
  return prefix + bytesToBase64Url(bytes);
}

export async function decodeBackupToken(tokenString) {
  const trimmed = String(tokenString || '').trim();
  if (!trimmed) {
    throw new Error('Please choose a saved progress file (.vwfd) or paste your backup text first.');
  }

  // Strictly reject raw JSON input from users
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    throw new Error('Raw JSON files or text are not accepted. Only authentic .vwfd backup files are allowed.');
  }

  let isCompressed = true;
  let body = '';

  if (trimmed.startsWith(VWFD_PREFIX_GZIP)) {
    isCompressed = true;
    body = trimmed.slice(VWFD_PREFIX_GZIP.length);
  } else if (trimmed.startsWith(VWFD_PREFIX_RAW)) {
    isCompressed = false;
    body = trimmed.slice(VWFD_PREFIX_RAW.length);
  } else {
    throw new Error('Could not recognize this backup. Only authentic .vwfd backup files and tokens are supported.');
  }

  let envelope;
  try {
    const bytes = base64UrlToBytes(body);
    const jsonStr = await gunzipBytes(bytes, isCompressed);
    envelope = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error('Could not decompress or read this .vwfd backup. The file may be corrupted.');
  }

  if (!envelope || typeof envelope !== 'object' || !envelope.payload || typeof envelope.signature !== 'string') {
    throw new Error('This .vwfd backup file is malformed or missing cryptographic signature records.');
  }

  if (envelope.format !== 'VWFD') {
    throw new Error('Invalid file format. Only authentic .vwfd backup files are supported.');
  }

  const expectedSignature = await computeVwfdSignature(envelope.payload);
  if (envelope.signature !== expectedSignature) {
    throw new Error('Tamper detection alert: This backup file has an invalid or forged signature.');
  }

  return envelope.payload;
}

export { encodeBackupToken as encodeVwfdBackup, decodeBackupToken as decodeVwfdBackup };
