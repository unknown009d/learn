/**
 * Animated-QR transfer protocol: splits a backup token into numbered frames and
 * reassembles them on the scanning device. Pure functions, no DOM (unit tested in Node).
 *
 * Frame layout (fixed-width header, no separators, so every frame is the same length
 * and the QR keeps the same size from frame to frame):
 *
 *   VWS1  sid(4)  index(2)  total(2)  tokenLength(5)  crc32(8 hex)  chunk(CHUNK_SIZE, last one padded)
 *
 * Numbers are base36. The transfer id (sid) ties frames to one send session, so pieces from
 * two different transfers never mix. The per-frame CRC drops any frame a camera misread.
 */

export const FRAME_MAGIC = 'VWS1';
export const CHUNK_SIZE = 480;
const SID_LEN = 4;
const IDX_LEN = 2;
const LEN_LEN = 5;
const CRC_LEN = 8;
const HEADER_LEN = FRAME_MAGIC.length + SID_LEN + IDX_LEN * 2 + LEN_LEN + CRC_LEN;
const MAX_FRAMES = 36 ** IDX_LEN - 1;
const PAD = '~';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(str) {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc = CRC_TABLE[(crc ^ str.charCodeAt(i)) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(CRC_LEN, '0');
}

const b36 = (n, width) => n.toString(36).padStart(width, '0');

export function randomTransferId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return b36(n % 36 ** SID_LEN, SID_LEN);
}

/** @returns {string[]} one string per QR frame */
export function encodeFrames(token, { sid = randomTransferId(), chunkSize = CHUNK_SIZE } = {}) {
  const text = String(token || '');
  if (!text) throw new Error('Nothing to send.');
  if (text.length >= 36 ** LEN_LEN) throw new Error('This backup is too large to send by QR.');
  const total = Math.ceil(text.length / chunkSize);
  if (total > MAX_FRAMES) throw new Error('This backup is too large to send by QR.');

  const frames = [];
  for (let i = 0; i < total; i++) {
    const chunk = text.slice(i * chunkSize, (i + 1) * chunkSize).padEnd(chunkSize, PAD);
    frames.push(
      FRAME_MAGIC + sid + b36(i, IDX_LEN) + b36(total, IDX_LEN) + b36(text.length, LEN_LEN) + crc32(chunk) + chunk
    );
  }
  return frames;
}

/** Parse a scanned string. Returns null when it isn't a transfer frame or fails its checksum. */
export function parseFrame(raw) {
  const s = String(raw || '');
  if (!s.startsWith(FRAME_MAGIC) || s.length <= HEADER_LEN) return null;
  let p = FRAME_MAGIC.length;
  const take = (n) => s.slice(p, (p += n));
  const sid = take(SID_LEN);
  const index = parseInt(take(IDX_LEN), 36);
  const total = parseInt(take(IDX_LEN), 36);
  const length = parseInt(take(LEN_LEN), 36);
  const crc = take(CRC_LEN);
  const chunk = s.slice(HEADER_LEN);
  if (!/^[0-9a-z]+$/.test(sid) || !Number.isInteger(index) || !Number.isInteger(total) || !Number.isInteger(length)) {
    return null;
  }
  if (total < 1 || index >= total || length < 1) return null;
  if (crc32(chunk) !== crc) return { corrupt: true };
  return { sid, index, total, length, chunk };
}

/**
 * Collects frames from one transfer. accept() returns what happened to the frame:
 * 'ignored' (not a transfer QR), 'corrupt' (checksum failed), 'duplicate', 'added',
 * or 'restarted' (a new transfer id appeared, so collection started over).
 */
export function createAssembler() {
  let sid = null;
  let total = 0;
  let length = 0;
  let chunks = [];
  let have = 0;

  const reset = () => {
    sid = null;
    total = 0;
    length = 0;
    chunks = [];
    have = 0;
  };

  return {
    accept(raw) {
      const frame = parseFrame(raw);
      if (!frame) return 'ignored';
      if (frame.corrupt) return 'corrupt';
      let outcome = 'added';
      if (sid !== null && (frame.sid !== sid || frame.total !== total || frame.length !== length)) {
        reset();
        outcome = 'restarted';
      }
      if (sid === null) {
        sid = frame.sid;
        total = frame.total;
        length = frame.length;
        chunks = new Array(total).fill(null);
      }
      if (chunks[frame.index] !== null) return 'duplicate';
      chunks[frame.index] = frame.chunk;
      have++;
      return outcome;
    },
    has: (i) => chunks[i] != null,
    get have() {
      return have;
    },
    get total() {
      return total;
    },
    get complete() {
      return total > 0 && have === total;
    },
    /** The reassembled backup token (only once complete). */
    token() {
      if (!(total > 0 && have === total)) return null;
      return chunks.join('').slice(0, length);
    },
    reset
  };
}
