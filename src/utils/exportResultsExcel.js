import * as XLSX from 'xlsx';
import { buildResponseTable, computeStats, pct } from './analysis';
import { slugify, formatDateTime } from './format';
import { COMPANY, CONTACT_LINE } from '../config/company';

/** Build the workbook (separate from saving so it can be tested). */
export function buildResultsWorkbook(survey, responses) {
  const wb = XLSX.utils.book_new();
  const stats = computeStats(survey, responses);

  // ---- Summary sheet -------------------------------------------------------
  // Company header (text only - Excel cannot carry the logo here). The Responses sheet is left as a
  // clean data table so it can still be filtered and pivoted.
  const summary = [
    [COMPANY.fullName],
    [CONTACT_LINE],
    [],
    ['Survey', survey.title || ''],
    ['Total responses', responses.length],
    ['Exported', formatDateTime(Date.now())],
    [],
    ['Q#', 'Question', 'Answer / item', 'Count', '% of respondents'],
  ];
  for (const s of stats) {
    const qText = s.question.text;
    const answeredNote = `${s.answered} of ${s.total} answered`;
    if (s.kind === 'choice' || s.kind === 'rating') {
      summary.push([s.number, qText, `(${answeredNote})`, '', '']);
      s.labels.forEach((label, i) => summary.push(['', '', label, s.counts[i], pct(s.counts[i], s.answered)]));
      if (s.kind === 'rating' && s.average !== null) summary.push(['', '', 'Average rating', s.average, '']);
    } else if (s.kind === 'matrix') {
      summary.push([s.number, qText, `(${answeredNote})`, '', '']);
      s.rows.forEach((row) => {
        s.columns.forEach((col, i) => summary.push(['', '', `${row.label} - ${col}`, row.counts[i], pct(row.counts[i], row.answered)]));
      });
    } else if (s.kind === 'number') {
      summary.push([s.number, qText, `(${answeredNote})`, '', '']);
      [['Average', s.average], ['Minimum', s.min], ['Maximum', s.max], ['Median', s.median], ['Sum', s.sum]].forEach(([label, v]) =>
        summary.push(['', '', label, v === null ? '' : v, '']),
      );
    } else {
      summary.push([s.number, qText, `(${answeredNote}) - see the Responses sheet for the full text`, '', '']);
    }
  }
  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary['!cols'] = [{ wch: 6 }, { wch: 55 }, { wch: 45 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ---- Responses sheet -----------------------------------------------------
  const table = buildResponseTable(survey, responses);
  const wsResponses = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
  wsResponses['!cols'] = table.headers.map((h, i) => {
    if (i === 0) return { wch: 6 };
    if (i === 1) return { wch: 17 };
    return { wch: Math.min(45, Math.max(16, Math.round(String(h).length * 0.7))) };
  });
  XLSX.utils.book_append_sheet(wb, wsResponses, 'Responses');
  return wb;
}

export function exportResultsExcel(survey, responses) {
  const wb = buildResultsWorkbook(survey, responses);
  XLSX.writeFile(wb, `${slugify(survey.title)}-results.xlsx`);
}
