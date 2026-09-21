import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getQuestionNumbers, computeProgress } from './surveyModel';
import { selectionLimit } from './answers';
import { pdfSafe } from './pdfText';
import { slugify } from './format';
import { applyPdfBranding, PDF_BOTTOM, PDF_TOP } from './pdfBranding';

const TEAL = [14, 107, 104];
const INK = [30, 36, 40];
const MUTED = [110, 118, 122];

/** Build the PDF document (separate from saving so it can be tested). */
export function buildSurveyPdf(survey) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 50;
  const contentW = pageW - 2 * M;
  const numbers = getQuestionNumbers(survey.questions);
  let y = PDF_TOP; // content starts below the company letterhead

  const ensure = (h) => {
    if (y + h > pageH - PDF_BOTTOM) {
      doc.addPage();
      y = PDF_TOP;
    }
  };

  const write = (text, { size = 11, style = 'normal', indent = 0, color = INK, gap = 0 } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(pdfSafe(text), contentW - indent);
    const lh = size * 1.35;
    lines.forEach((line) => {
      ensure(lh);
      doc.text(line, M + indent, y + size);
      y += lh;
    });
    y += gap;
  };

  const drawOption = (label, shape) => {
    const indent = 14;
    const lineH = 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(pdfSafe(label || ' '), contentW - indent - 22);
    ensure(lines.length * lineH + 3);
    doc.setDrawColor(90, 90, 90);
    doc.setLineWidth(0.8);
    if (shape === 'circle') doc.circle(M + indent + 5, y + 7, 4.5, 'S');
    else doc.rect(M + indent, y + 2.5, 9, 9, 'S');
    doc.setTextColor(...INK);
    lines.forEach((line, i) => doc.text(line, M + indent + 18, y + 11 + i * lineH));
    y += lines.length * lineH + 3;
  };

  const answerLines = (count) => {
    for (let i = 0; i < count; i += 1) {
      ensure(24);
      y += 20;
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.6);
      doc.line(M + 14, y, M + contentW, y);
    }
    y += 4;
  };

  // ---- Title block -------------------------------------------------------
  write(survey.title || 'Untitled survey', { size: 20, style: 'bold', color: TEAL, gap: 4 });
  if (survey.description) write(survey.description, { size: 11, color: MUTED, gap: 4 });
  const progress = computeProgress(survey);
  if (progress.questionCount) {
    write(`${progress.questionCount} question${progress.questionCount === 1 ? '' : 's'}  |  about ${progress.estMinutes} min  |  * = required`, {
      size: 9.5,
      color: MUTED,
    });
  }
  y += 4;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(1.2);
  doc.line(M, y, M + contentW, y);
  y += 10;

  // ---- Questions ---------------------------------------------------------
  for (const q of survey.questions || []) {
    if (q.type === 'section') {
      ensure(70);
      y += 14;
      write(q.text || 'Section', { size: 14, style: 'bold', color: TEAL, gap: 2 });
      doc.setDrawColor(200, 210, 208);
      doc.setLineWidth(0.7);
      doc.line(M, y, M + contentW, y);
      y += 6;
      if (q.help) write(q.help, { size: 9.5, style: 'italic', color: MUTED, gap: 2 });
      continue;
    }

    ensure(80);
    y += 10;
    write(`${numbers[q.id]}. ${q.text || '(no question text)'}${q.required ? ' *' : ''}`, { size: 11.5, style: 'bold', gap: 2 });
    if (q.help) write(q.help, { size: 9.5, style: 'italic', color: MUTED, gap: 2 });

    switch (q.type) {
      case 'short_text':
      case 'email':
        answerLines(1);
        break;
      case 'long_text':
        answerLines(3);
        break;
      case 'number':
        ensure(24);
        y += 20;
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.6);
        doc.line(M + 14, y, M + 14 + 150, y);
        y += 4;
        break;
      case 'date':
        write('____ / ____ / ________   (day / month / year)', { size: 10.5, indent: 14, color: MUTED });
        break;
      case 'multiple_choice':
      case 'dropdown':
        (q.options || []).forEach((o) => drawOption(o.label, 'circle'));
        break;
      case 'checkboxes': {
        const limit = selectionLimit(q);
        if (limit) write(`Select up to ${limit}`, { size: 9.5, style: 'italic', color: MUTED, indent: 14 });
        (q.options || []).forEach((o) => drawOption(o.label, 'square'));
        break;
      }
      case 'yes_no':
        drawOption('Yes', 'circle');
        drawOption('No', 'circle');
        break;
      case 'rating': {
        const n = Number(q.scaleMax) || 5;
        const r = 10;
        const step = 34;
        ensure(2 * r + 30);
        const cy = y + r + 2;
        doc.setDrawColor(90, 90, 90);
        doc.setLineWidth(0.8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...INK);
        for (let i = 0; i < n; i += 1) {
          const cx = M + 14 + r + i * step;
          doc.circle(cx, cy, r, 'S');
          doc.text(String(i + 1), cx, cy + 3.3, { align: 'center' });
        }
        y += 2 * r + 8;
        const parts = [];
        if (q.minLabel) parts.push(`1 = ${q.minLabel}`);
        if (q.maxLabel) parts.push(`${n} = ${q.maxLabel}`);
        if (parts.length) write(parts.join('     '), { size: 9.5, color: MUTED, indent: 14 });
        break;
      }
      case 'matrix': {
        const cols = (q.options || []).map((o) => pdfSafe(o.label));
        const rows = (q.rows || []).map((r) => [pdfSafe(r.label), ...cols.map(() => '')]);
        autoTable(doc, {
          startY: y + 2,
          margin: { left: M + 14, right: M, top: PDF_TOP, bottom: PDF_BOTTOM },
          head: [['', ...cols]],
          body: rows,
          theme: 'grid',
          styles: { fontSize: 8.5, cellPadding: 4, halign: 'center', valign: 'middle', lineColor: [190, 190, 190], lineWidth: 0.5, textColor: INK },
          headStyles: { fillColor: [232, 240, 238], textColor: [20, 60, 58], fontStyle: 'bold' },
          columnStyles: { 0: { halign: 'left', cellWidth: Math.min(170, (contentW - 14) * 0.34) } },
          didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index > 0) {
              doc.setDrawColor(90, 90, 90);
              doc.setLineWidth(0.8);
              doc.circle(data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, 3.6, 'S');
            }
          },
        });
        y = doc.lastAutoTable.finalY + 8;
        break;
      }
      default:
        break;
    }
  }

  // ---- Company letterhead + contact footer on every page ------------------
  applyPdfBranding(doc, M, survey.title || 'Survey');
  return doc;
}

export function exportSurveyPdf(survey) {
  const doc = buildSurveyPdf(survey);
  doc.save(`${slugify(survey.title)}.pdf`);
}
