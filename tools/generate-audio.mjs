/**
 * Local Kokoro-82M Lesson Summary Generator for Vanilla Web Foundations
 *
 * Uses sentence-level streaming (TextSplitterStream + tts.stream) so long
 * explanations are NEVER truncated by Kokoro's 510-phoneme single-pass limit,
 * with natural pauses between sentences and a clean trailing silence pad.
 *
 * Usage:
 *   node generate-audio.mjs --module=1                 # Generate Module 1 (af_heart)
 *   node generate-audio.mjs --all                      # Generate all 24 lessons
 *   node generate-audio.mjs --lesson=m1-internet-vs-www --force
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KokoroTTS, TextSplitterStream } from 'kokoro-js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const AUDIO_DIR = path.join(ROOT_DIR, 'audio');
const TMP_DIR = path.join(__dirname, '.tmp');
const SCRIPTS_PATH = path.join(__dirname, 'audio-scripts.json');
const CACHE_PATH = path.join(__dirname, '.cache.json');
const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json');

const DEFAULT_VOICE = 'af_heart';
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const SAMPLE_RATE = 24000;
const SENTENCE_GAP_MS = 240; // Natural breath pause between sentences
const TRAILING_PAD_MS = 400; // Gentle silence tail so endings never clip
const PIPELINE_VERSION = 'v2-stream';

function parseArgs(argv) {
  const opts = {
    module: null,
    lesson: null,
    all: false,
    force: false,
    voice: DEFAULT_VOICE,
    speed: 1.0
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--all') opts.all = true;
    else if (arg === '--force') opts.force = true;
    else if (arg.startsWith('--module=')) opts.module = Number(arg.split('=')[1]);
    else if (arg.startsWith('--lesson=')) opts.lesson = arg.split('=')[1];
    else if (arg.startsWith('--voice=')) opts.voice = arg.split('=')[1];
    else if (arg.startsWith('--speed=')) opts.speed = Number(arg.split('=')[1]) || 1.0;
  }
  return opts;
}

/**
 * Fallback automatic speech composer when a lesson has no custom script in audio-scripts.json.
 */
function sanitizeForSpeech(text) {
  return String(text || '')
    .replace(/<([a-z0-9]+)[^>]*>/gi, (_, tag) => ` the ${tag.toUpperCase()} tag `)
    .replace(/<\/[a-z0-9]+>/gi, '')
    .replace(/->/g, ' then ')
    .replace(/&amp;/g, ' and ')
    .replace(/druba\.in/gi, 'druba dot in')
    .replace(/index\.html/gi, 'index dot H T M L')
    .replace(/\.html\b/gi, ' dot H T M L')
    .replace(/\.css\b/gi, ' dot C S S')
    .replace(/\.js\b/gi, ' dot J S')
    .replace(/\bHTML5\b/g, 'H T M L 5')
    .replace(/\bHTML\b/g, 'H T M L')
    .replace(/\bCSS\b/g, 'C S S')
    .replace(/\bHTTPS\b/g, 'H T T P S')
    .replace(/\bHTTP\b/g, 'H T T P')
    .replace(/\bDNS\b/g, 'D N S')
    .replace(/\bIP\b/g, 'I P')
    .replace(/\bURL\b/g, 'U R L')
    .replace(/\bSQL\b/g, 'S Q L')
    .replace(/\bTCP\/IP\b/g, 'T C P I P')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAutoSummary(sec) {
  const parts = [];
  if (sec.title) parts.push(`${sec.title}.`);
  if (sec.lead) parts.push(sec.lead);
  if (sec.analogy?.text) {
    parts.push(`Think of it this way: ${sec.analogy.text}`);
  }
  if (sec.takeaway?.text) {
    parts.push(`To wrap up, remember this: ${sec.takeaway.text}`);
  }
  return sanitizeForSpeech(parts.join(' '));
}

function hashText(voice, speed, text) {
  return crypto
    .createHash('sha256')
    .update(`${PIPELINE_VERSION}|${MODEL_ID}|${voice}|${speed}|${text}`)
    .digest('hex')
    .slice(0, 16);
}

async function readJsonSafe(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * Trim near-silent leading/trailing edges from a single sentence waveform
 * so concatenated pauses stay consistent and natural.
 */
function trimSilence(samples, threshold = 0.0025, keepMarginSamples = 1200) {
  let start = 0;
  while (start < samples.length && Math.abs(samples[start]) < threshold) start++;
  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end]) < threshold) end--;
  if (start >= end) return samples;
  const safeStart = Math.max(0, start - keepMarginSamples);
  const safeEnd = Math.min(samples.length, end + keepMarginSamples);
  return samples.subarray(safeStart, safeEnd);
}

/**
 * Encode a mono Float32Array [-1, 1] into a standard 16-bit PCM WAV Buffer.
 */
function encodePcm16Wav(samples, sampleRate = SAMPLE_RATE) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20);  // PCM format
  buf.writeUInt16LE(1, 22);  // Mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  buf.writeUInt16LE(2, 32);  // Block align
  buf.writeUInt16LE(16, 34); // Bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    buf.writeInt16LE(int16, offset);
    offset += 2;
  }
  return buf;
}

async function convertWavToMp3(wavPath, mp3Path) {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i', wavPath,
    '-ac', '1',
    '-ar', String(SAMPLE_RATE),
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-b:a', '64k',
    mp3Path
  ]);
}

async function probeDurationSeconds(audioPath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath
    ]);
    const secs = Math.round(parseFloat(stdout.trim()));
    return Number.isFinite(secs) ? secs : 0;
  } catch {
    return 0;
  }
}

async function synthesizeLesson(tts, text, voice, speed, outMp3Path) {
  const splitter = new TextSplitterStream();
  splitter.push(text);
  splitter.close();

  const chunks = [];
  let sentenceCount = 0;

  for await (const { phonemes, audio } of tts.stream(splitter, { voice, speed })) {
    sentenceCount++;
    if (phonemes.length > 420) {
      console.warn(`  [WARN] Sentence ${sentenceCount} has ${phonemes.length} phoneme chars (near 510 limit).`);
    }
    const raw = audio.audio instanceof Float32Array ? audio.audio : Float32Array.from(audio.audio);
    chunks.push(trimSilence(raw));
  }

  const gapSamples = Math.round((SAMPLE_RATE * SENTENCE_GAP_MS) / 1000);
  const tailSamples = Math.round((SAMPLE_RATE * TRAILING_PAD_MS) / 1000);
  const totalSamples =
    chunks.reduce((sum, c) => sum + c.length, 0) +
    Math.max(0, chunks.length - 1) * gapSamples +
    tailSamples;

  const combined = new Float32Array(totalSamples);
  let cursor = 0;
  chunks.forEach((chunk, idx) => {
    combined.set(chunk, cursor);
    cursor += chunk.length;
    if (idx < chunks.length - 1) {
      cursor += gapSamples;
    }
  });

  const tmpWav = path.join(TMP_DIR, `${path.basename(outMp3Path, '.mp3')}_${Date.now()}.wav`);
  await fs.writeFile(tmpWav, encodePcm16Wav(combined, SAMPLE_RATE));
  await convertWavToMp3(tmpWav, outMp3Path);
  await fs.unlink(tmpWav).catch(() => {});

  const duration = await probeDurationSeconds(outMp3Path);
  const stat = await fs.stat(outMp3Path);
  return { duration, sizeKB: Math.round(stat.size / 1024), sentenceCount };
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.module && !opts.lesson && !opts.all) {
    console.log('Usage: node generate-audio.mjs --module=1 | --lesson=<id> | --all [--voice=af_heart] [--force]');
    process.exit(1);
  }

  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.mkdir(TMP_DIR, { recursive: true });

  const courseUrl = pathToFileURL(path.join(ROOT_DIR, 'js', 'course-data.js')).href;
  const { MODULES } = await import(courseUrl);
  const customScripts = await readJsonSafe(SCRIPTS_PATH, {});
  const cache = await readJsonSafe(CACHE_PATH, {});
  const manifest = await readJsonSafe(MANIFEST_PATH, { voice: opts.voice, lessons: {} });

  console.log(`Loading Kokoro-82M (${MODEL_ID}, q8)...`);
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: 'q8',
    device: 'cpu'
  });
  console.log('Model ready.\n');

  const targets = [];
  for (const mod of MODULES) {
    if (opts.module && mod.id !== opts.module) continue;
    for (const sec of mod.sections || []) {
      if (opts.lesson && sec.id !== opts.lesson) continue;
      targets.push({ modId: mod.id, sec });
    }
  }

  manifest.voice = opts.voice;
  let generated = 0;
  let skipped = 0;

  for (const { modId, sec } of targets) {
    const scriptText = customScripts[sec.id] || buildAutoSummary(sec);
    const digest = hashText(opts.voice, opts.speed, scriptText);
    const outPath = path.join(AUDIO_DIR, `${sec.id}.mp3`);

    let exists = false;
    try {
      await fs.access(outPath);
      exists = true;
    } catch {}

    if (!opts.force && exists && cache[sec.id] === digest && manifest.lessons[sec.id]) {
      console.log(`[SKIP] M${modId} ${sec.id} (unchanged)`);
      skipped++;
      continue;
    }

    console.log(`[GEN]  M${modId} ${sec.id} (${opts.voice})...`);
    const info = await synthesizeLesson(tts, scriptText, opts.voice, opts.speed, outPath);
    console.log(`       Saved audio/${sec.id}.mp3 (${info.sentenceCount} sentences, ${info.duration}s, ${info.sizeKB} KB)`);

    cache[sec.id] = digest;
    manifest.lessons[sec.id] = {
      file: `./audio/${sec.id}.mp3`,
      duration: info.duration,
      voice: opts.voice
    };
    generated++;
  }

  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nFinished: ${generated} generated, ${skipped} skipped. Manifest updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
