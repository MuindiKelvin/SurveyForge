/*
 * Writes a native SPSS system file (.sav): uncompressed, little-endian, UTF-8.
 * It carries variable names + labels, value labels, numeric and string variables, and supports
 * text answers longer than 255 bytes ("very long strings"), so nothing is cut off.
 *
 * Layout (see the PSPP "System File Format" reference):
 *   file header (176 bytes)
 *   variable records (type 2)            one per variable; strings add "continuation" records
 *   value-label records (types 3 + 4)
 *   extension records (type 7)           encoding, floating-point constants, long names, very long strings
 *   dictionary terminator (type 999)
 *   data                                 8-byte slots, `caseSize` slots per case
 *
 * Input is a dataset from buildDataset() (see dataset.js). Numeric variables become SPSS numeric
 * variables (null -> system-missing); string variables become string variables sized to the longest answer.
 */

const encoder = new TextEncoder();

const SYSMIS = -Number.MAX_VALUE; // 0xFFEFFFFFFFFFFFFF, SPSS "system missing"
const HIGHEST = Number.MAX_VALUE;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MAX_SHORT_STRING = 255; // longest string a normal string variable can hold
// Very long strings (over 255 bytes) are split into segments. SPSS sizes the split as ceil(L / 252)
// segments (all 255 wide except the last, which is L - 252 * (n - 1) wide), and the answer's bytes
// fill each full segment with 255 bytes. This is the layout used by ReadStat's SPSS writer.
const SEGMENT_UNIT = 252;
const SEGMENT_DATA = 255;
const MAX_STRING_BYTES = 32767; // SPSS limit
const MAX_VAR_LABEL_BYTES = 255;
const MAX_VALUE_LABEL_BYTES = 120;

/** Cut a string so its UTF-8 form is at most `maxBytes` long, never splitting a character. */
export function truncateBytes(text, maxBytes) {
  let used = 0;
  let out = '';
  for (const ch of String(text)) {
    const n = encoder.encode(ch).length;
    if (used + n > maxBytes) break;
    used += n;
    out += ch;
  }
  return out;
}

class ByteWriter {
  constructor() {
    this.buf = new Uint8Array(1 << 16);
    this.view = new DataView(this.buf.buffer);
    this.len = 0;
  }

  ensure(extra) {
    if (this.len + extra <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + extra) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }

  i32(v) {
    this.ensure(4);
    this.view.setInt32(this.len, v, true);
    this.len += 4;
  }

  f64(v) {
    this.ensure(8);
    this.view.setFloat64(this.len, v, true);
    this.len += 8;
  }

  /** A double given as raw bits (high word, low word). */
  f64Bits(hi, lo) {
    this.ensure(8);
    this.view.setUint32(this.len, lo, true);
    this.view.setUint32(this.len + 4, hi, true);
    this.len += 8;
  }

  u8(v) {
    this.ensure(1);
    this.buf[this.len] = v;
    this.len += 1;
  }

  bytes(u8) {
    this.ensure(u8.length);
    this.buf.set(u8, this.len);
    this.len += u8.length;
  }

  fill(byte, count) {
    if (count <= 0) return;
    this.ensure(count);
    this.buf.fill(byte, this.len, this.len + count);
    this.len += count;
  }

  /** Text padded with spaces to exactly `width` bytes (text must already fit). */
  padded(u8, width) {
    this.bytes(u8);
    this.fill(0x20, width - u8.length);
  }

  result() {
    return this.buf.slice(0, this.len);
  }
}

const shortName = (index) => `V${String(index + 1).padStart(5, '0')}`; // V00001 ... (6 chars)
const segmentName = (n) => `W${String(n).padStart(7, '0')}`; // W0000001 (8 chars)

const cleanString = (v) => (v === null || v === undefined ? '' : String(v).replace(/\u0000/g, ''));

const numericFormat = (width, decimals) => (5 << 16) | (width << 8) | decimals; // 5 = F
const stringFormat = (width) => (1 << 16) | (Math.min(width, MAX_SHORT_STRING) << 8); // 1 = A

/** Work out slots/widths for every variable. */
function planVariables(variables, rows) {
  return variables.map((variable, i) => {
    const plan = { variable, short: shortName(i), index: 0 };
    if (variable.kind === 'numeric') {
      return { ...plan, kind: 'numeric', slots: 1, printWidth: variable.questionType === 'number' ? 18 : 8 };
    }
    let longest = 1;
    const encoded = rows.map((row) => {
      const bytes = encoder.encode(cleanString(row[i]));
      if (bytes.length > longest) longest = bytes.length;
      return bytes;
    });
    if (longest > MAX_STRING_BYTES) {
      throw new Error(`An answer to "${variable.name}" is longer than SPSS allows (${MAX_STRING_BYTES} bytes).`);
    }
    if (longest <= MAX_SHORT_STRING) {
      return { ...plan, kind: 'string', encoded, width: longest, slots: Math.ceil(longest / 8) };
    }
    const segments = Math.ceil(longest / SEGMENT_UNIT);
    const widths = Array.from({ length: segments }, (_, k) => (k < segments - 1 ? MAX_SHORT_STRING : longest - SEGMENT_UNIT * (segments - 1)));
    return {
      ...plan,
      kind: 'long',
      encoded,
      length: longest,
      widths,
      slots: widths.reduce((sum, w) => sum + Math.ceil(w / 8), 0),
    };
  });
}

function writeVariableRecord(w, { type, label, format, name }) {
  const labelBytes = label ? encoder.encode(truncateBytes(label, MAX_VAR_LABEL_BYTES)) : null;
  w.i32(2);
  w.i32(type);
  w.i32(labelBytes && labelBytes.length ? 1 : 0);
  w.i32(0); // no user-missing values
  w.i32(format); // print format
  w.i32(format); // write format
  w.padded(encoder.encode(name), 8);
  if (labelBytes && labelBytes.length) {
    w.i32(labelBytes.length);
    w.bytes(labelBytes);
    w.fill(0, (4 - (labelBytes.length % 4)) % 4);
  }
}

function writeContinuations(w, count) {
  for (let k = 0; k < count; k += 1) {
    w.i32(2);
    w.i32(-1);
    w.i32(0);
    w.i32(0);
    w.i32(0);
    w.i32(0);
    w.padded(new Uint8Array(0), 8);
  }
}

function writeExtension(w, subtype, size, count, writeData) {
  w.i32(7);
  w.i32(subtype);
  w.i32(size);
  w.i32(count);
  writeData();
}

/**
 * @param {{ variables: object[], rows: any[][] }} dataset
 * @param {{ title?: string, now?: Date }} [meta]
 * @returns {Uint8Array} the bytes of the .sav file
 */
export function buildSav(dataset, { title = '', now = new Date() } = {}) {
  const { variables, rows } = dataset;
  const plans = planVariables(variables, rows);
  const caseSize = plans.reduce((sum, p) => sum + p.slots, 0);
  const w = new ByteWriter();

  // ---- file header (176 bytes) ------------------------------------------------------------
  const pad2 = (n) => String(n).padStart(2, '0');
  w.bytes(encoder.encode('$FL2'));
  w.padded(encoder.encode('@(#) SPSS DATA FILE - SurveyHub'), 60);
  w.i32(2); // layout code
  w.i32(caseSize);
  w.i32(0); // compression: none
  w.i32(0); // no weight variable
  w.i32(rows.length);
  w.f64(100); // compression bias (unused)
  w.padded(encoder.encode(`${pad2(now.getDate())} ${MONTHS[now.getMonth()]} ${pad2(now.getFullYear() % 100)}`), 9);
  w.padded(encoder.encode(`${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`), 8);
  w.padded(encoder.encode(truncateBytes(title, 64)), 64);
  w.fill(0, 3);

  // ---- variable records ---------------------------------------------------------------------
  let dictIndex = 0; // number of type-2 records written so far (continuations included)
  let segmentCounter = 0;
  for (const p of plans) {
    p.index = dictIndex + 1; // 1-based position of this variable's first record
    const label = p.variable.label || '';
    if (p.kind === 'numeric') {
      const decimals = p.variable.decimals || 0;
      writeVariableRecord(w, { type: 0, label, format: numericFormat(p.printWidth, decimals), name: p.short });
      dictIndex += 1;
    } else if (p.kind === 'string') {
      writeVariableRecord(w, { type: p.width, label, format: stringFormat(p.width), name: p.short });
      writeContinuations(w, p.slots - 1);
      dictIndex += p.slots;
    } else {
      p.widths.forEach((width, k) => {
        segmentCounter += k === 0 ? 0 : 1;
        writeVariableRecord(w, {
          type: width,
          label: k === 0 ? label : '',
          format: stringFormat(width),
          name: k === 0 ? p.short : segmentName(segmentCounter),
        });
        writeContinuations(w, Math.ceil(width / 8) - 1);
        dictIndex += Math.ceil(width / 8);
      });
    }
  }

  // ---- value labels (numeric variables only) --------------------------------------------------
  for (const p of plans) {
    if (p.kind !== 'numeric') continue;
    const labels = (p.variable.valueLabels || []).filter((vl) => Number.isFinite(vl.code));
    if (!labels.length) continue;
    w.i32(3);
    w.i32(labels.length);
    for (const vl of labels) {
      const bytes = encoder.encode(truncateBytes(vl.label, MAX_VALUE_LABEL_BYTES));
      w.f64(vl.code);
      w.u8(bytes.length);
      w.bytes(bytes);
      w.fill(0, (8 - ((1 + bytes.length) % 8)) % 8);
    }
    w.i32(4);
    w.i32(1);
    w.i32(p.index);
  }

  // ---- extension records ------------------------------------------------------------------------
  // 3: machine integer info (declares UTF-8, little-endian, IEEE doubles)
  writeExtension(w, 3, 4, 8, () => {
    [1, 0, 0, -1, 1, 1, 2, 65001].forEach((v) => w.i32(v));
  });
  // 4: machine floating-point info (system-missing, highest, lowest)
  writeExtension(w, 4, 8, 3, () => {
    w.f64(SYSMIS);
    w.f64(HIGHEST);
    w.f64Bits(0xffefffff, 0xfffffffe);
  });
  // 13: long variable names (our V00001 short names -> real names)
  const longNames = encoder.encode(plans.map((p) => `${p.short}=${p.variable.name}`).join('\t'));
  writeExtension(w, 13, 1, longNames.length, () => w.bytes(longNames));
  // 14: very long string lengths
  const longOnes = plans.filter((p) => p.kind === 'long');
  if (longOnes.length) {
    const text = encoder.encode(longOnes.map((p) => `${p.short}=${p.length}\u0000\t`).join(''));
    writeExtension(w, 14, 1, text.length, () => w.bytes(text));
  }
  // 20: character encoding
  const encodingName = encoder.encode('UTF-8');
  writeExtension(w, 20, 1, encodingName.length, () => w.bytes(encodingName));

  // ---- end of dictionary --------------------------------------------------------------------------
  w.i32(999);
  w.i32(0);

  // ---- data ----------------------------------------------------------------------------------------
  rows.forEach((row, r) => {
    plans.forEach((p, i) => {
      if (p.kind === 'numeric') {
        const v = row[i];
        w.f64(v === null || v === undefined || !Number.isFinite(Number(v)) ? SYSMIS : Number(v));
      } else if (p.kind === 'string') {
        w.padded(p.encoded[r], p.slots * 8);
      } else {
        const bytes = p.encoded[r];
        p.widths.forEach((width, k) => {
          const start = Math.min(k * SEGMENT_DATA, bytes.length);
          const end = k < p.widths.length - 1 ? Math.min(start + SEGMENT_DATA, bytes.length) : bytes.length;
          w.padded(bytes.subarray(start, end), Math.ceil(width / 8) * 8);
        });
      }
    });
  });

  return w.result();
}
