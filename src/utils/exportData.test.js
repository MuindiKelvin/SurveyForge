import { describe, expect, it } from 'vitest';
import { buildDataset } from './dataset';
import { buildResultsFile, delimitedField, guardFormula, xmlEscape } from './exportResultsData';
import { EXPORT_FORMATS, FORMAT_MAP, DEFAULT_DATA_OPTIONS } from './exportFormats';
import { buildSav, truncateBytes } from './spssSav';
import { makeQuestion } from './surveyModel';

// jsdom's Blob has no arrayBuffer()/text(), so read through FileReader.
const readBlob = (blob, as) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    if (as === 'text') reader.readAsText(blob);
    else reader.readAsArrayBuffer(blob);
  });
const textOf = async (file) => (await readBlob(file.blob, 'text')).replace(/^\uFEFF/, '');
const bytesOf = async (file) => new Uint8Array(await readBlob(file.blob, 'buffer'));

/** Small RFC 4180 reader (quotes, doubled quotes, line breaks inside quotes). */
function parseDelimited(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const survey = () => ({
  title: 'Caf\u00E9 \u2013 \u201Cquoted\u201D, survey',
  description: 'Line one\nLine two',
  questions: [
    makeQuestion({ type: 'section', text: 'Part A' }),
    makeQuestion({ type: 'short_text', text: 'Name' }),
    makeQuestion({ type: 'long_text', text: 'Story' }),
    makeQuestion({ type: 'number', text: 'Age' }),
    makeQuestion({ type: 'multiple_choice', text: 'Colour', options: ['Red', 'Blue'] }),
    makeQuestion({ type: 'checkboxes', text: 'Toppings', options: ['A', 'B', 'C'] }),
    makeQuestion({ type: 'yes_no', text: 'Sure?' }),
    makeQuestion({ type: 'rating', text: 'Rate', scaleMax: 5, minLabel: 'Bad', maxLabel: 'Good' }),
    makeQuestion({ type: 'matrix', text: 'Grid', rows: ['Food', 'Service'], options: ['Bad', 'Good'] }),
  ],
});

const LONG = 'x\u00E9\u4E16'.repeat(300); // 1,800 bytes of UTF-8

const responses = (s) => {
  const [, name, story, age, colour, toppings, sure, rate, grid] = s.questions;
  return [
    {
      id: 'r2',
      submittedAt: Date.UTC(2026, 0, 2, 9, 30),
      answers: { [name.id]: '=HYPERLINK("http://evil")', [story.id]: 'Short, with "quotes"\nand a new line', [colour.id]: 'Purple (deleted option)', [toppings.id]: ['B', 'Old topping'] },
    },
    {
      id: 'r1',
      submittedAt: Date.UTC(2026, 0, 1, 9, 30),
      answers: {
        [name.id]: 'Wanjiku',
        [story.id]: LONG,
        [age.id]: 3.25,
        [colour.id]: 'Blue',
        [toppings.id]: ['A', 'C'],
        [sure.id]: 'No',
        [rate.id]: 5,
        [grid.id]: { [grid.rows[0].id]: 'Good', [grid.rows[1].id]: 'Bad' },
      },
    },
    { id: 'r3', submittedAt: Date.UTC(2026, 0, 3, 9, 30), answers: {} },
  ];
};

describe('format catalogue', () => {
  it('lists the formats people expect, each with a unique key', () => {
    const keys = EXPORT_FORMATS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ['xlsx', 'pdf', 'txt', 'csv', 'tsv', 'sav', 'json', 'ndjson', 'xml', 'codebook']) expect(keys).toContain(k);
    expect(FORMAT_MAP.sav.ext).toBe('.sav');
  });
});

describe('buildDataset', () => {
  it('orders responses oldest first and names variables Q1, Q2 ... with _n for multi-column questions', () => {
    const s = survey();
    const { variables, rows } = buildDataset(s, responses(s), { splitMulti: true });
    expect(variables.map((v) => v.name)).toEqual([
      'ResponseNumber', 'ResponseID', 'SubmittedAt', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5_1', 'Q5_2', 'Q5_3', 'Q5_4', 'Q6', 'Q7', 'Q8_1', 'Q8_2',
    ]);
    expect(new Set(variables.map((v) => v.name.toLowerCase())).size).toBe(variables.length);
    expect(rows.map((r) => r[1])).toEqual(['r1', 'r2', 'r3']);
    expect(rows.map((r) => r[0])).toEqual([1, 2, 3]);
    expect(rows[0][2]).toBe('2026-01-01T09:30:00Z');
  });

  it('keeps choice text by default and leaves unanswered cells null', () => {
    const s = survey();
    const { variables, rows } = buildDataset(s, responses(s));
    const col = (name) => variables.findIndex((v) => v.name === name);
    expect(rows[0][col('Q4')]).toBe('Blue');
    expect(rows[0][col('Q5')]).toBe('A; C');
    expect(rows[0][col('Q3')]).toBe(3.25);
    expect(rows[2][col('Q1')]).toBeNull();
    expect(rows[2][col('Q5')]).toBeNull();
  });

  it('numeric codes follow the order of the choices; yes/no is 1/2', () => {
    const s = survey();
    const { variables, rows } = buildDataset(s, responses(s), { values: 'numeric', splitMulti: true });
    const col = (name) => variables.findIndex((v) => v.name === name);
    expect(rows[0][col('Q4')]).toBe(2); // Blue is the 2nd choice
    expect(rows[0][col('Q6')]).toBe(2); // No
    expect(rows[0][col('Q7')]).toBe(5);
    expect(rows[0][col('Q8_1')]).toBe(2); // Food -> Good
    expect(rows[0][col('Q8_2')]).toBe(1); // Service -> Bad
    expect(variables[col('Q4')].valueLabels).toEqual([{ code: 1, label: 'Red' }, { code: 2, label: 'Blue' }, { code: 3, label: 'Purple (deleted option)' }]);
    expect(variables[col('Q6')].valueLabels).toEqual([{ code: 1, label: 'Yes' }, { code: 2, label: 'No' }]);
    expect(variables[col('Q7')].valueLabels).toEqual([{ code: 1, label: 'Bad' }, { code: 5, label: 'Good' }]);
  });

  it('never drops an answer whose choice was later removed from the survey', () => {
    const s = survey();
    const { variables, rows } = buildDataset(s, responses(s), { values: 'numeric', splitMulti: true });
    const col = (name) => variables.findIndex((v) => v.name === name);
    expect(rows[1][col('Q4')]).toBe(3); // "Purple (deleted option)" got the next free code
    expect(variables[col('Q5_4')].label).toBe('Toppings [Old topping]'); // extra checkbox column
    expect(rows[1][col('Q5_4')]).toBe(1);
    expect(rows[1][col('Q5_2')]).toBe(1);
    expect(rows[1][col('Q5_1')]).toBe(0);
    expect(rows[2][col('Q5_1')]).toBeNull(); // question unanswered -> missing, not 0
  });

  it('checkboxes in one column: text joins with "; ", numeric joins codes with commas', () => {
    const s = survey();
    const text = buildDataset(s, responses(s), { values: 'text', splitMulti: false });
    const num = buildDataset(s, responses(s), { values: 'numeric', splitMulti: false });
    const i = text.variables.findIndex((v) => v.name === 'Q5');
    expect(text.rows[0][i]).toBe('A; C');
    expect(num.rows[0][i]).toBe('1,3');
    expect(num.rows[1][i]).toBe('2,4'); // B and the removed choice
  });

  it('splits checkboxes into one column per choice in text mode too', () => {
    const s = survey();
    const { variables, rows } = buildDataset(s, responses(s), { splitMulti: true });
    const i = variables.findIndex((v) => v.name === 'Q5_3');
    expect(rows[0][i]).toBe('C');
    expect(rows[1][i]).toBeNull();
  });
});

describe('CSV / TSV', () => {
  it('quotes commas, quotes and line breaks and writes a UTF-8 BOM', async () => {
    const s = survey();
    const file = buildResultsFile('csv', s, responses(s));
    expect(file.filename).toBe('cafe-quoted-survey-results.csv');
    const bytes = await bytesOf(file);
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 byte order mark, so Excel reads accents correctly
    const rows = parseDelimited(await textOf(file));
    expect(rows).toHaveLength(4); // header + 3
    expect(rows[0].slice(0, 5)).toEqual(['ResponseNumber', 'ResponseID', 'SubmittedAt', 'Q1', 'Q2']);
    expect(rows[1][3]).toBe('Wanjiku');
    expect(rows[1][4]).toBe(LONG);
    expect(rows[2][4]).toBe('Short, with "quotes"\nand a new line');
    expect(new Set(rows.map((r) => r.length)).size).toBe(1); // every row has the same number of columns
  });

  it('neutralises spreadsheet formulas in text answers but leaves numbers and plain text alone', async () => {
    const s = survey();
    const rows = parseDelimited(await textOf(buildResultsFile('csv', s, responses(s))));
    expect(rows[2][3]).toBe('\'=HYPERLINK("http://evil")');
    expect(guardFormula('+254 700')).toBe("'+254 700");
    expect(guardFormula('@home')).toBe("'@home");
    expect(guardFormula('-5')).toBe('-5');
    expect(guardFormula('Normal')).toBe('Normal');
    expect(delimitedField(-4, ',')).toBe('-4'); // real numbers are never prefixed
    expect(delimitedField(null, ',')).toBe('');
  });

  it('supports short, full and two-row headings', async () => {
    const s = survey();
    const head = async (headers) => parseDelimited(await textOf(buildResultsFile('csv', s, responses(s), { headers })));
    const short = await head('short');
    expect(short[0][3]).toBe('Q1');
    expect(short).toHaveLength(4);
    const full = await head('full');
    expect(full[0].slice(0, 5)).toEqual(['#', 'Response ID', 'Submitted (UTC)', '1. Name', '2. Story']);
    expect(full).toHaveLength(4);
    const both = await head('both');
    expect(both[0][3]).toBe('Q1');
    expect(both[1][3]).toBe('1. Name');
    expect(both).toHaveLength(5);
  });

  it('writes numeric codes when asked', async () => {
    const s = survey();
    const rows = parseDelimited(await textOf(buildResultsFile('csv', s, responses(s), { values: 'numeric', splitMulti: true })));
    const h = rows[0];
    expect(rows[1][h.indexOf('Q4')]).toBe('2');
    expect(rows[1][h.indexOf('Q5_1')]).toBe('1');
    expect(rows[1][h.indexOf('Q5_2')]).toBe('0');
  });

  it('TSV uses tabs', async () => {
    const s = survey();
    const file = buildResultsFile('tsv', s, responses(s));
    expect(file.filename.endsWith('-results.tsv')).toBe(true);
    const rows = parseDelimited(await textOf(file), '\t');
    expect(rows[0][3]).toBe('Q1');
    expect(rows[2][4]).toBe('Short, with "quotes"\nand a new line');
  });

  it('handles a survey with no responses', async () => {
    const s = survey();
    const rows = parseDelimited(await textOf(buildResultsFile('csv', s, [])));
    expect(rows).toHaveLength(1);
  });
});

describe('JSON, NDJSON and XML', () => {
  it('JSON has survey info, variable definitions with value labels, and every response', async () => {
    const s = survey();
    const data = JSON.parse(await textOf(buildResultsFile('json', s, responses(s), { values: 'numeric' }, new Date('2026-02-03T04:05:06.789Z'))));
    expect(data.survey).toMatchObject({ title: s.title, totalResponses: 3, values: 'numeric', exportedAt: '2026-02-03T04:05:06Z' });
    expect(data.responses).toHaveLength(3);
    const colour = data.variables.find((v) => v.name === 'Q4');
    expect(colour.valueLabels[1]).toEqual({ code: 2, label: 'Blue' });
    expect(data.responses[0].Q4).toBe(2);
    expect(data.responses[0].Q2).toBe(LONG);
    expect(data.responses[2].Q1).toBeNull();
  });

  it('NDJSON has exactly one valid JSON object per line', async () => {
    const s = survey();
    const text = await textOf(buildResultsFile('ndjson', s, responses(s)));
    const lines = text.trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    const objects = lines.map((l) => JSON.parse(l));
    expect(objects[1].Q2).toBe('Short, with "quotes"\nand a new line'); // newline is escaped, not a real line break
    expect(buildResultsFile('ndjson', s, []).filename.endsWith('.ndjson')).toBe(true);
    expect(await textOf(buildResultsFile('ndjson', s, []))).toBe('');
  });

  it('XML is well-formed and escapes special and illegal characters', async () => {
    const s = survey();
    s.title = 'A & B <test> "q" \u0001';
    const rs = responses(s);
    rs[0].answers[s.questions[1].id] = 'x < y & z \u0000\u0008 ok';
    const xml = await textOf(buildResultsFile('xml', s, rs, { values: 'numeric', splitMulti: true }));
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.getAttribute('title')).toBe('A & B <test> "q" ');
    expect(doc.getElementsByTagName('response')).toHaveLength(3);
    expect(doc.getElementsByTagName('variable').length).toBeGreaterThan(10);
    const firstResponse = doc.getElementsByTagName('response')[0];
    expect(firstResponse.getElementsByTagName('Q4')[0].textContent).toBe('2');
    expect(doc.getElementsByTagName('response')[1].getElementsByTagName('Q1')[0].textContent).toBe('x < y & z  ok');
    expect(xmlEscape('<&>"\'')).toBe('&lt;&amp;&gt;&quot;&apos;');
  });
});

describe('plain-text report and codebook', () => {
  it('lists every response question by question', async () => {
    const s = survey();
    const text = await textOf(buildResultsFile('txt', s, responses(s)));
    expect(text).toContain('RESPONSE 1 of 3');
    expect(text).toContain('RESPONSE 3 of 3');
    expect(text).toContain('1. Name\n    Wanjiku');
    expect(text).toContain('Food: Good');
    expect(text).toContain('A; C');
    expect(text).toContain('Short, with "quotes"\n    and a new line'); // continuation lines are indented
    expect(text).toContain('(no answer)');
    expect(text).toContain('Responses: 3');
  });

  it('says so when there are no responses', async () => {
    const s = survey();
    expect(await textOf(buildResultsFile('txt', s, []))).toContain('No responses yet.');
  });

  it('codebook lists each code with its meaning', async () => {
    const s = survey();
    const rows = parseDelimited(await textOf(buildResultsFile('codebook', s, responses(s), { values: 'numeric', splitMulti: true })));
    expect(rows[0]).toEqual(['Variable', 'Label', 'Question number', 'Question type', 'Data type', 'Value', 'Value label']);
    expect(rows).toContainEqual(['Q4', 'Colour', '4', 'Multiple choice', 'numeric', '2', 'Blue']);
    expect(rows).toContainEqual(['Q5_1', 'Toppings [A]', '5', 'Checkboxes', 'numeric', '1', 'Selected']);
    expect(rows).toContainEqual(['Q6', 'Sure?', '6', 'Yes / No', 'numeric', '2', 'No']);
  });
});

describe('unsupported format', () => {
  it('throws for formats this module does not build', () => {
    const s = survey();
    expect(() => buildResultsFile('xlsx', s, [])).toThrow(/unsupported/i);
    expect(() => buildResultsFile('nope', s, [])).toThrow(/unsupported/i);
  });
});

// -----------------------------------------------------------------------------------------------
// SPSS (.sav). The format was also checked against two independent readers (ReadStat and PSPP);
// this mini reader keeps a regression check inside the test suite.
// -----------------------------------------------------------------------------------------------
function readSav(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  const out = { magic: dec.decode(bytes.subarray(0, 4)), caseSize: dv.getInt32(68, true), ncases: dv.getInt32(80, true), fileLabel: dec.decode(bytes.subarray(109, 173)).trim() };
  const records = [];
  const valueSets = [];
  let veryLong = {};
  let longNames = {};
  let encoding = '';
  let pos = 176;
  for (;;) {
    const type = dv.getInt32(pos, true);
    pos += 4;
    if (type === 2) {
      const t = dv.getInt32(pos, true);
      const hasLabel = dv.getInt32(pos + 4, true);
      const print = dv.getInt32(pos + 12, true);
      const name = dec.decode(bytes.subarray(pos + 20, pos + 28)).trim();
      pos += 28;
      let label = '';
      if (hasLabel) {
        const len = dv.getInt32(pos, true);
        label = dec.decode(bytes.subarray(pos + 4, pos + 4 + len));
        pos += 4 + Math.ceil(len / 4) * 4;
      }
      records.push({ t, name, label, print });
    } else if (type === 3) {
      const count = dv.getInt32(pos, true);
      pos += 4;
      const labels = [];
      for (let i = 0; i < count; i += 1) {
        const value = dv.getFloat64(pos, true);
        const len = bytes[pos + 8];
        labels.push({ value, label: dec.decode(bytes.subarray(pos + 9, pos + 9 + len)) });
        pos += 8 + Math.ceil((1 + len) / 8) * 8;
      }
      valueSets.push({ labels });
    } else if (type === 4) {
      const n = dv.getInt32(pos, true);
      valueSets[valueSets.length - 1].varIndexes = Array.from({ length: n }, (_, i) => dv.getInt32(pos + 4 + 4 * i, true));
      pos += 4 + 4 * n;
    } else if (type === 7) {
      const sub = dv.getInt32(pos, true);
      const size = dv.getInt32(pos + 4, true);
      const count = dv.getInt32(pos + 8, true);
      const data = bytes.subarray(pos + 12, pos + 12 + size * count);
      pos += 12 + size * count;
      if (sub === 13) longNames = Object.fromEntries(dec.decode(data).split('\t').map((p) => p.split('=')));
      if (sub === 14) veryLong = Object.fromEntries(dec.decode(data).split('\u0000\t').filter(Boolean).map((p) => p.split('=')));
      if (sub === 20) encoding = dec.decode(data);
    } else if (type === 999) {
      pos += 4;
      break;
    } else throw new Error(`unexpected record type ${type} at ${pos - 4}`);
  }

  // logical variables
  const vars = [];
  let skipUntil = 0; // dictionary records already consumed as segments of a very long string
  for (let i = 0; i < records.length; i += 1) {
    if (i < skipUntil) continue;
    const r = records[i];
    if (r.t === -1) continue;
    const v = { short: r.name, name: longNames[r.name] || r.name, label: r.label, index: i + 1, numeric: r.t === 0, width: r.t, segments: [r.t], print: r.print };
    if (veryLong[r.name]) {
      v.length = Number(veryLong[r.name]);
      const n = Math.ceil(v.length / 252);
      let j = i + 1;
      for (let k = 1; k < n; k += 1) {
        while (records[j].t === -1) j += 1;
        v.segments.push(records[j].t);
        j += 1;
      }
      skipUntil = j;
    }
    vars.push(v);
  }
  const slotsOf = (w) => Math.ceil(w / 8);
  const caseBytes = vars.reduce((sum, v) => sum + (v.numeric ? 8 : v.segments.reduce((s, w) => s + slotsOf(w) * 8, 0)), 0);
  expect(caseBytes).toBe(out.caseSize * 8);
  expect(bytes.length - pos).toBe(out.ncases * caseBytes);

  const rows = [];
  for (let c = 0; c < out.ncases; c += 1) {
    const row = {};
    for (const v of vars) {
      if (v.numeric) {
        const n = dv.getFloat64(pos, true);
        row[v.name] = n === -Number.MAX_VALUE ? null : n;
        pos += 8;
      } else {
        const parts = [];
        v.segments.forEach((w, k) => {
          const take = v.segments.length > 1 && k < v.segments.length - 1 ? 255 : w;
          parts.push(bytes.subarray(pos, pos + take));
          pos += slotsOf(w) * 8;
        });
        const joined = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
        let at = 0;
        parts.forEach((part) => {
          joined.set(part, at);
          at += part.length;
        });
        row[v.name] = dec.decode(joined).replace(/ +$/, '');
      }
    }
    rows.push(row);
  }
  return { ...out, vars, rows, valueSets, encoding };
}

describe('SPSS .sav export', () => {
  const build = async (rs, s = survey()) => readSav(await bytesOf(buildResultsFile('sav', s, rs, {}, new Date(2026, 9, 6, 8, 5, 9))));

  it('writes a valid system file with names, labels, value labels and UTF-8', async () => {
    const s = survey();
    const sav = await build(responses(s), s);
    expect(sav.magic).toBe('$FL2');
    expect(sav.ncases).toBe(3);
    expect(sav.encoding).toBe('UTF-8');
    expect(sav.fileLabel).toBe(s.title);
    const names = sav.vars.map((v) => v.name);
    expect(names).toEqual(['ResponseNumber', 'ResponseID', 'SubmittedAt', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5_1', 'Q5_2', 'Q5_3', 'Q5_4', 'Q6', 'Q7', 'Q8_1', 'Q8_2']);
    expect(sav.vars.find((v) => v.name === 'Q4').label).toBe('Colour');
    // value labels sit on the right variables (Q4 = colour) and carry the deleted choice too
    const colour = sav.vars.find((v) => v.name === 'Q4');
    const set = sav.valueSets.find((vs) => vs.varIndexes.includes(colour.index));
    expect(set.labels).toEqual([{ value: 1, label: 'Red' }, { value: 2, label: 'Blue' }, { value: 3, label: 'Purple (deleted option)' }]);
    const rating = sav.vars.find((v) => v.name === 'Q7');
    expect(sav.valueSets.find((vs) => vs.varIndexes.includes(rating.index)).labels).toEqual([{ value: 1, label: 'Bad' }, { value: 5, label: 'Good' }]);
  });

  it('stores the answers as numbers and keeps missing values missing', async () => {
    const s = survey();
    const { rows } = await build(responses(s), s);
    expect(rows[0]).toMatchObject({ ResponseNumber: 1, ResponseID: 'r1', SubmittedAt: '2026-01-01T09:30:00Z', Q1: 'Wanjiku', Q3: 3.25, Q4: 2, Q5_1: 1, Q5_2: 0, Q5_3: 1, Q5_4: 0, Q6: 2, Q7: 5, Q8_1: 2, Q8_2: 1 });
    expect(rows[1]).toMatchObject({ Q4: 3, Q5_2: 1, Q5_4: 1, Q3: null, Q6: null });
    expect(rows[2]).toMatchObject({ Q1: '', Q4: null, Q5_1: null });
  });

  it('keeps text answers longer than 255 bytes intact (very long strings)', async () => {
    const s = survey();
    const huge = 'abc \u00E9\u4E16'.repeat(2000); // ~16 KB
    const rs = responses(s);
    rs[2].answers[s.questions[2].id] = huge;
    const sav = await build(rs, s);
    const story = sav.vars.find((v) => v.name === 'Q2');
    expect(story.length).toBe(new TextEncoder().encode(huge).length);
    expect(sav.rows[0].Q2).toBe(LONG);
    expect(sav.rows[1].Q2).toBe('Short, with "quotes"\nand a new line');
    expect(sav.rows[2].Q2).toBe(huge.replace(/ +$/, ''));
    expect(sav.rows[0].Q3).toBe(3.25); // columns after the long text are still aligned
  });

  it('works with no responses and with a survey that has only sections', async () => {
    const s = survey();
    expect((await build([], s)).ncases).toBe(0);
    const only = { title: '', questions: [makeQuestion({ type: 'section', text: 'Just a heading' })] };
    expect((await build([{ id: 'a', submittedAt: 1, answers: {} }], only)).vars.map((v) => v.name)).toEqual(['ResponseNumber', 'ResponseID', 'SubmittedAt']);
  });

  it('truncateBytes never splits a multi-byte character', () => {
    expect(truncateBytes('a\u4E16b', 3)).toBe('a');
    expect(truncateBytes('a\u4E16b', 4)).toBe('a\u4E16');
    expect(new TextEncoder().encode(truncateBytes('\u00E9'.repeat(200), 120)).length).toBeLessThanOrEqual(120);
  });

  it('is deterministic for the same input and date', () => {
    const s = survey();
    const ds = buildDataset(s, responses(s), { values: 'numeric', headers: 'short', splitMulti: true });
    const a = buildSav(ds, { title: s.title, now: new Date(2026, 0, 1) });
    const b = buildSav(ds, { title: s.title, now: new Date(2026, 0, 1) });
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(DEFAULT_DATA_OPTIONS.values).toBe('text');
  });
});
