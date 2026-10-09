import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildResponseTable, computeStats, pct, responsesPerDay } from './analysis';
import { pdfSafe } from './pdfText';
import { slugify, formatDateTime } from './format';
import { applyPdfBranding, PDF_BOTTOM, PDF_TOP } from './pdfBranding';

const TEAL = [14, 107, 104];
const INK = [30, 36, 40];
const MUTED = [110, 118, 122];
const MAX_INDIVIDUAL_RESPONSES = 200;
const MAX_TEXT_ANSWERS = 300;
const PALETTE = [[14, 107, 104], [227, 162, 58], [61, 122, 184], [200, 86, 59], [124, 154, 62], [138, 95, 179], [209, 122, 160], [74, 163, 160], [166, 124, 82], [92, 107, 115], [184, 163, 58], [47, 143, 91]];
const TRACK = [228, 234, 232];

/** Build the results PDF (separate from saving so it can be tested). */
export function buildResultsPdf(survey, responses) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 45;
  const contentW = pageW - 2 * M;
  let y = PDF_TOP; // content starts below the company letterhead

  const ensure = (h) => {
    if (y + h > pageH - PDF_BOTTOM) {
      doc.addPage();
      y = PDF_TOP;
    }
  };
  const write = (text, { size = 10.5, style = 'normal', color = INK, gap = 0 } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(pdfSafe(text), contentW);
    const lh = size * 1.35;
    lines.forEach((line) => {
      ensure(lh);
      doc.text(line, M, y + size);
      y += lh;
    });
    y += gap;
  };
  const tableDefaults = {
    margin: { left: M, right: M, top: PDF_TOP, bottom: PDF_BOTTOM },
    theme: 'striped',
    rowPageBreak: 'avoid', // keep a multi-line answer together instead of splitting it across pages
    styles: { fontSize: 9, cellPadding: 4, textColor: INK, overflow: 'linebreak' },
    headStyles: { fillColor: TEAL, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 247, 246] },
  };
  const afterTable = () => {
    y = doc.lastAutoTable.finalY + 12;
  };

  /** Horizontal bar chart drawn with PDF primitives (stays sharp and needs no canvas). */
  const barChart = (labels, values, { suffix = '', total = 0 } = {}) => {
    const rowH = 18;
    const labelW = Math.min(170, contentW * 0.34);
    const barX = M + labelW + 6;
    const barMaxW = contentW - labelW - 6 - 70;
    const top = Math.max(1, ...values);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    labels.forEach((label, i) => {
      ensure(rowH);
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(pdfSafe(label), labelW)[0], M, y + 11);
      doc.setFillColor(...TRACK);
      doc.rect(barX, y + 2, barMaxW, 11, 'F');
      const w = (values[i] / top) * barMaxW;
      if (w > 0) {
        doc.setFillColor(...PALETTE[i % PALETTE.length]);
        doc.rect(barX, y + 2, w, 11, 'F');
      }
      doc.setTextColor(...MUTED);
      doc.text(total ? `${values[i]} (${pct(values[i], total)}%)${suffix}` : `${values[i]}${suffix}`, barX + barMaxW + 6, y + 11);
      y += rowH;
    });
    y += 6;
  };

  // ---- Header ------------------------------------------------------------
  write(survey.title || 'Survey results', { size: 20, style: 'bold', color: TEAL, gap: 2 });
  write('Survey results', { size: 12, color: MUTED, gap: 2 });
  write(`Exported ${formatDateTime(Date.now())}   |   ${responses.length} response${responses.length === 1 ? '' : 's'}`, {
    size: 9.5,
    color: MUTED,
    gap: 8,
  });

  const stats = computeStats(survey, responses);

  const perDay = responsesPerDay(responses).slice(-30);
  if (perDay.length) {
    ensure(40 + perDay.length * 18);
    write('Responses per day', { size: 11.5, style: 'bold', gap: 3 });
    barChart(perDay.map((d) => d.day), perDay.map((d) => d.count));
  }

  // ---- Question summaries ------------------------------------------------
  for (const s of stats) {
    ensure(90);
    y += 6;
    write(`${s.number}. ${s.question.text}`, { size: 11.5, style: 'bold', gap: 1 });
    write(`${s.answered} of ${s.total} answered`, { size: 9, color: MUTED, gap: 3 });

    if (s.kind === 'choice' || s.kind === 'rating') {
      if (s.answered) barChart(s.labels, s.counts, { total: s.answered });
      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        head: [['Answer', 'Count', '% of respondents']],
        body: s.labels.map((label, i) => [pdfSafe(label), s.counts[i], `${pct(s.counts[i], s.answered)}%`]),
        columnStyles: { 1: { halign: 'right', cellWidth: 60 }, 2: { halign: 'right', cellWidth: 100 } },
        didParseCell: (data) => {
          if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right';
        },
      });
      afterTable();
      if (s.kind === 'rating' && s.average !== null) write(`Average rating: ${s.average}`, { size: 9.5, style: 'bold', gap: 4 });
    } else if (s.kind === 'matrix') {
      s.rows.forEach((row) => {
        if (!row.answered) return;
        ensure(40);
        write(pdfSafe(row.label), { size: 9.5, style: 'bold', gap: 2 });
        barChart(s.columns, row.counts, { total: row.answered });
      });
      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        styles: { ...tableDefaults.styles, fontSize: 8, halign: 'center' },
        head: [['', ...s.columns.map(pdfSafe)]],
        body: s.rows.map((row) => [pdfSafe(row.label), ...row.counts.map((c) => `${c} (${pct(c, row.answered)}%)`)]),
        columnStyles: { 0: { halign: 'left', cellWidth: Math.min(150, contentW * 0.3) } },
      });
      afterTable();
    } else if (s.kind === 'number') {
      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        head: [['Average', 'Minimum', 'Maximum', 'Median', 'Sum']],
        body: [[s.average ?? '-', s.min ?? '-', s.max ?? '-', s.median ?? '-', s.sum ?? '-']],
      });
      afterTable();
    } else {
      const shown = s.entries.slice(0, MAX_TEXT_ANSWERS);
      if (shown.length) {
        autoTable(doc, {
          ...tableDefaults,
          startY: y,
          head: [['Answers']],
          body: shown.map((e) => [pdfSafe(e.text)]),
        });
        afterTable();
        if (s.entries.length > shown.length) write(`... and ${s.entries.length - shown.length} more (see the Excel export).`, { size: 9, color: MUTED, gap: 4 });
      } else {
        write('No answers yet.', { size: 9.5, color: MUTED, gap: 4 });
      }
    }
  }

  // ---- Individual responses ----------------------------------------------
  if (responses.length) {
    doc.addPage();
    y = PDF_TOP;
    write('Individual responses', { size: 16, style: 'bold', color: TEAL, gap: 4 });
    const table = buildResponseTable(survey, responses);
    const limit = Math.min(table.rows.length, MAX_INDIVIDUAL_RESPONSES);
    if (table.rows.length > limit) {
      write(`Showing the first ${limit} of ${table.rows.length} responses. The Excel export contains all of them.`, { size: 9.5, color: MUTED, gap: 6 });
    }
    for (let r = 0; r < limit; r += 1) {
      const row = table.rows[r];
      ensure(70);
      write(`Response ${row[0]}  -  ${row[1]}`, { size: 10.5, style: 'bold', gap: 2 });
      autoTable(doc, {
        ...tableDefaults,
        startY: y,
        theme: 'grid',
        styles: { ...tableDefaults.styles, fontSize: 8.5, lineColor: [210, 216, 214], lineWidth: 0.4 },
        showHead: false,
        body: table.headers.slice(2).map((h, i) => [pdfSafe(h), pdfSafe(row[i + 2] === '' || row[i + 2] === undefined ? '-' : row[i + 2])]),
        columnStyles: { 0: { cellWidth: contentW * 0.45, fontStyle: 'bold', fillColor: [244, 247, 246] } },
      });
      afterTable();
    }
  }

  // ---- Company letterhead + contact footer on every page ------------------
  applyPdfBranding(doc, M, `${survey.title || 'Survey'} - results`);
  return doc;
}

export function exportResultsPdf(survey, responses) {
  const doc = buildResultsPdf(survey, responses);
  doc.save(`${slugify(survey.title)}-results.pdf`);
}
