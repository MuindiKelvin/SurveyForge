import { buildDataset, headingOf } from './dataset';
import { DEFAULT_DATA_OPTIONS, FORMAT_MAP } from './exportFormats';
import { buildSav } from './spssSav';
import { downloadBlob } from './download';
import { slugify, formatDateTime } from './format';
import { getQuestionNumbers } from './surveyModel';
import { typeLabel } from './questionTypes';

/** Fixed choices used by the SPSS export (SPSS wants numbers + value labels). */
const SPSS_OPTIONS = { values: 'numeric', headers: 'short', splitMulti: true };

// ---------------------------------------------------------------------------------------------
// CSV / TSV
// ---------------------------------------------------------------------------------------------

const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

/**
 * Spreadsheet programs run text that starts with = + - @ (or a tab / carriage return) as a formula.
 * Because anyone with a link can submit a response, a text cell like that is prefixed with an
 * apostrophe so opening the file in Excel or Sheets can never execute it. Real numbers are untouched.
 */
export function guardFormula(text) {
  return /^[=+\-@\t\r]/.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;
}

/** One delimited-text field: quoted when it contains the delimiter, a quote or a line break. */
export function delimitedField(value, delimiter) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'number' ? String(value) : guardFormula(String(value));
  return text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildDelimited(survey, responses, options, delimiter) {
  const opts = { ...DEFAULT_DATA_OPTIONS, ...options };
  const { variables, rows } = buildDataset(survey, responses, opts);
  const headerRows = [];
  if (opts.headers === 'both') {
    headerRows.push(variables.map((v) => v.name), variables.map((v) => v.header));
  } else {
    headerRows.push(variables.map((v) => headingOf(v, opts.headers)));
  }
  const lines = [...headerRows, ...rows].map((row) => row.map((cell) => delimitedField(cell, delimiter)).join(delimiter));
  return `${lines.join('\r\n')}\r\n`;
}

// ---------------------------------------------------------------------------------------------
// JSON / NDJSON
// ---------------------------------------------------------------------------------------------

const variableInfo = (v) => {
  const info = { name: v.name, label: v.label, type: v.kind };
  if (v.questionNumber !== '') {
    info.questionNumber = v.questionNumber;
    info.questionType = v.questionType;
  }
  if (v.valueLabels.length) info.valueLabels = v.valueLabels.map((vl) => ({ code: vl.code, label: vl.label }));
  return info;
};

const recordOf = (variables, row) => Object.fromEntries(variables.map((v, i) => [v.name, row[i]]));

function buildJson(survey, responses, options, exportedAt) {
  const opts = { ...DEFAULT_DATA_OPTIONS, ...options };
  const { variables, rows } = buildDataset(survey, responses, opts);
  return `${JSON.stringify(
    {
      survey: {
        title: survey.title || '',
        description: survey.description || '',
        exportedAt: exportedAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        totalResponses: rows.length,
        values: opts.values,
      },
      variables: variables.map(variableInfo),
      responses: rows.map((row) => recordOf(variables, row)),
    },
    null,
    2,
  )}\n`;
}

function buildNdjson(survey, responses, options) {
  const { variables, rows } = buildDataset(survey, responses, { ...DEFAULT_DATA_OPTIONS, ...options });
  return rows.map((row) => `${JSON.stringify(recordOf(variables, row))}\n`).join('');
}

// ---------------------------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------------------------

/** Remove characters XML 1.0 cannot contain, then escape the five special ones. */
export function xmlEscape(value) {
  return String(value)
    .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildXml(survey, responses, options, exportedAt) {
  const opts = { ...DEFAULT_DATA_OPTIONS, ...options };
  const { variables, rows } = buildDataset(survey, responses, opts);
  const out = ['<?xml version="1.0" encoding="UTF-8"?>'];
  out.push(
    `<survey title="${xmlEscape(survey.title || '')}" exportedAt="${exportedAt.toISOString().replace(/\.\d{3}Z$/, 'Z')}" totalResponses="${rows.length}" values="${opts.values}">`,
  );
  if (survey.description) out.push(`  <description>${xmlEscape(survey.description)}</description>`);
  out.push('  <variables>');
  for (const v of variables) {
    const attrs = [`name="${xmlEscape(v.name)}"`, `label="${xmlEscape(v.label)}"`, `type="${v.kind}"`];
    if (v.questionNumber !== '') attrs.push(`question="${v.questionNumber}"`, `questionType="${xmlEscape(v.questionType)}"`);
    if (v.valueLabels.length) {
      out.push(`    <variable ${attrs.join(' ')}>`);
      for (const vl of v.valueLabels) out.push(`      <value code="${xmlEscape(vl.code)}">${xmlEscape(vl.label)}</value>`);
      out.push('    </variable>');
    } else {
      out.push(`    <variable ${attrs.join(' ')} />`);
    }
  }
  out.push('  </variables>', '  <responses>');
  for (const row of rows) {
    out.push('    <response>');
    variables.forEach((v, i) => {
      if (row[i] !== null && row[i] !== undefined) out.push(`      <${v.name}>${xmlEscape(row[i])}</${v.name}>`);
    });
    out.push('    </response>');
  }
  out.push('  </responses>', '</survey>');
  return `${out.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------
// Plain-text report
// ---------------------------------------------------------------------------------------------

function buildText(survey, responses, exportedAt) {
  const numbers = getQuestionNumbers(survey.questions);
  const ordered = [...responses].sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0));
  const rule = '='.repeat(72);
  const thin = '-'.repeat(72);
  const indent = (text) => String(text).replace(/\r\n?|\n/g, '\n    ');
  const lines = [rule, survey.title || 'Untitled survey'];
  if (survey.description) lines.push('', survey.description);
  lines.push('', `Responses: ${ordered.length}`, `Exported:  ${formatDateTime(exportedAt.getTime())}`, rule, '');

  ordered.forEach((r, i) => {
    lines.push(`RESPONSE ${i + 1} of ${ordered.length}   submitted ${formatDateTime(r.submittedAt) || 'unknown'}`, thin);
    for (const q of survey.questions || []) {
      if (q.type === 'section') {
        lines.push('', `[ ${q.text || 'Section'} ]`);
        continue;
      }
      lines.push('', `${numbers[q.id]}. ${q.text || ''}`);
      const value = r.answers?.[q.id];
      if (q.type === 'matrix') {
        const answered = (q.rows || []).filter((row) => value && typeof value === 'object' && value[row.id]);
        if (!answered.length) lines.push('    (no answer)');
        answered.forEach((row) => lines.push(`    ${row.label}: ${value[row.id]}`));
      } else if (Array.isArray(value) ? value.length : value !== undefined && value !== null && String(value).trim() !== '') {
        lines.push(`    ${indent(Array.isArray(value) ? value.join('; ') : value)}`);
      } else {
        lines.push('    (no answer)');
      }
    }
    lines.push('', '');
  });
  if (!ordered.length) lines.push('No responses yet.', '');
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------
// Codebook
// ---------------------------------------------------------------------------------------------

function buildCodebook(survey, responses, options) {
  const { variables } = buildDataset(survey, responses, { ...DEFAULT_DATA_OPTIONS, ...options });
  const rows = [['Variable', 'Label', 'Question number', 'Question type', 'Data type', 'Value', 'Value label']];
  for (const v of variables) {
    const base = [v.name, v.label, v.questionNumber, v.questionType ? typeLabel(v.questionType) : 'Response detail', v.kind];
    if (!v.valueLabels.length) rows.push([...base, '', '']);
    else v.valueLabels.forEach((vl) => rows.push([...base, vl.code, vl.label]));
  }
  return `${rows.map((row) => row.map((cell) => delimitedField(cell, ',')).join(',')).join('\r\n')}\r\n`;
}

// ---------------------------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------------------------

const BOM = '\uFEFF'; // lets Excel recognise UTF-8 in CSV / TSV

/**
 * Build one results file.
 * @returns {{ blob: Blob, filename: string }}
 */
export function buildResultsFile(format, survey, responses, options = {}, now = new Date()) {
  const def = FORMAT_MAP[format];
  if (!def || !['csv', 'tsv', 'sav', 'json', 'ndjson', 'xml', 'txt', 'codebook'].includes(format)) {
    throw new Error(`Unsupported data format: ${format}`);
  }
  const stem = slugify(survey.title);
  const file = (parts, type, name) => ({ blob: new Blob(parts, { type }), filename: name });

  switch (format) {
    case 'csv':
      return file([BOM, buildDelimited(survey, responses, options, ',')], 'text/csv;charset=utf-8', `${stem}-results.csv`);
    case 'tsv':
      return file([BOM, buildDelimited(survey, responses, options, '\t')], 'text/tab-separated-values;charset=utf-8', `${stem}-results.tsv`);
    case 'json':
      return file([buildJson(survey, responses, options, now)], 'application/json;charset=utf-8', `${stem}-results.json`);
    case 'ndjson':
      return file([buildNdjson(survey, responses, options)], 'application/x-ndjson;charset=utf-8', `${stem}-results.ndjson`);
    case 'xml':
      return file([buildXml(survey, responses, options, now)], 'application/xml;charset=utf-8', `${stem}-results.xml`);
    case 'txt':
      return file([buildText(survey, responses, now)], 'text/plain;charset=utf-8', `${stem}-results.txt`);
    case 'codebook':
      return file([BOM, buildCodebook(survey, responses, options)], 'text/csv;charset=utf-8', `${stem}-codebook.csv`);
    default: {
      // 'sav'
      const dataset = buildDataset(survey, responses, SPSS_OPTIONS);
      return file([buildSav(dataset, { title: survey.title || '', now })], 'application/x-spss-sav', `${stem}-results.sav`);
    }
  }
}

/** Build the file and hand it to the browser as a download. */
export function exportResultsData(survey, responses, format, options = {}) {
  const { blob, filename } = buildResultsFile(format, survey, responses, options);
  downloadBlob(blob, filename);
}
