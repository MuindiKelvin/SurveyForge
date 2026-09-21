import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  Footer,
  PageNumber,
  Tab,
  TabStopType,
  LeaderType,
  Header,
  ImageRun,
  VerticalAlign,
} from 'docx';
import { getQuestionNumbers, computeProgress } from './surveyModel';
import { selectionLimit } from './answers';
import { downloadBlob } from './download';
import { slugify } from './format';
import { BRAND, COMPANY, CONTACT_LINE } from '../config/company';
import { getLogoBytes } from './branding';

const FONT = 'Calibri';
const SYMBOL_FONT = 'Segoe UI Symbol';
const TEAL = '0E6B68';
const MUTED = '6E767A';
const CONTENT_W = 9638; // A4 (11906) minus 2 x 1134 twip margins
const BRAND_SERIF = 'Times New Roman';
// Paragraph style for the "Page X of Y" line: LibreOffice sizes automatic page-number fields from the
// paragraph style, not from the run, so the size/colour is defined here as well as on the runs.
const PAGE_NUMBER_STYLE = 'PageNumberLine';
const LOGO_PX = 58; // docx sizes images in pixels (96 per inch) -> about 1.5 cm

const run = (text, opts = {}) => new TextRun({ text: text ?? '', font: FONT, ...opts });

/** Text with line breaks preserved. */
function textRuns(text, opts = {}) {
  const lines = String(text ?? '').split(/\r?\n/);
  return lines.map((line, i) => new TextRun({ text: line, font: FONT, ...(i > 0 ? { break: 1 } : {}), ...opts }));
}

const optionParagraph = (label, glyph) =>
  new Paragraph({
    indent: { left: 360 },
    spacing: { after: 40 },
    children: [new TextRun({ text: `${glyph}  `, font: SYMBOL_FONT, size: 22 }), ...textRuns(label, { size: 22 })],
  });

// A right-aligned tab with an underscore leader draws a clean writing line. (Paragraph borders
// are avoided because Word/LibreOffice merge neighbouring bordered paragraphs into one box.)
const answerLine = () =>
  new Paragraph({
    spacing: { before: 240, after: 0 },
    indent: { left: 360 },
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W, leader: LeaderType.UNDERSCORE }],
    children: [new TextRun({ children: [new Tab()], color: '999999', font: FONT })],
  });

const noteParagraph = (text) =>
  new Paragraph({
    spacing: { after: 60 },
    indent: { left: 360 },
    children: textRuns(text, { italics: true, size: 19, color: MUTED }),
  });

function matrixTable(q) {
  const cols = q.options || [];
  const rows = q.rows || [];
  const others = Math.floor((CONTENT_W - 2800) / Math.max(1, cols.length));
  const firstW = CONTENT_W - others * cols.length;
  const widths = [firstW, ...cols.map(() => others)];
  const line = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
  const borders = { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line };
  const cellMargins = { top: 70, bottom: 70, left: 100, right: 100 };

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: widths[0], type: WidthType.DXA },
        margins: cellMargins,
        shading: { type: ShadingType.CLEAR, fill: 'E8F0EE', color: 'auto' },
        children: [new Paragraph({ children: [] })],
      }),
      ...cols.map(
        (c, i) =>
          new TableCell({
            width: { size: widths[i + 1], type: WidthType.DXA },
            margins: cellMargins,
            shading: { type: ShadingType.CLEAR, fill: 'E8F0EE', color: 'auto' },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: textRuns(c.label, { bold: true, size: 18 }) })],
          }),
      ),
    ],
  });

  const bodyRows = rows.map(
    (r) =>
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: widths[0], type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ children: textRuns(r.label, { size: 20 }) })],
          }),
          ...cols.map(
            (_, i) =>
              new TableCell({
                width: { size: widths[i + 1], type: WidthType.DXA },
                margins: cellMargins,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: '\u25CB', font: SYMBOL_FONT, size: 22 })],
                  }),
                ],
              }),
          ),
        ],
      }),
  );

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    borders,
    rows: [headerRow, ...bodyRows],
  });
}

/** Letterhead repeated at the top of every page: circular logo, company name and website. */
function brandHeader() {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: none, bottom: none, left: none, right: none };
  const widths = [1000, 5400, CONTENT_W - 6400];
  const cell = (width, children) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: noBorders,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      children,
    });

  const logo = new ImageRun({
    type: 'png',
    data: getLogoBytes(),
    transformation: { width: LOGO_PX, height: LOGO_PX },
    altText: { name: 'company-logo', title: `${COMPANY.fullName} logo`, description: `${COMPANY.fullName} logo` },
  });

  const table = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          cell(widths[0], [new Paragraph({ children: [logo] })]),
          cell(widths[1], [
            new Paragraph({
              spacing: { after: 0 },
              children: [new TextRun({ text: COMPANY.name, font: BRAND_SERIF, bold: true, size: 42, color: BRAND.navy })],
            }),
            new Paragraph({
              spacing: { before: 20, after: 0 },
              children: [new TextRun({ text: COMPANY.tagline, font: FONT, bold: true, size: 19, color: BRAND.blue, characterSpacing: 46 })],
            }),
          ]),
          cell(widths[2], [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: COMPANY.website, font: FONT, size: 17, color: MUTED })],
            }),
          ]),
        ],
      }),
    ],
  });

  return new Header({
    children: [
      table,
      // The rule is a paragraph border (a table is not used as a horizontal rule).
      new Paragraph({
        spacing: { before: 40, after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: BRAND.navy, space: 1 } },
        children: [],
      }),
    ],
  });
}

/** Footer repeated on every page: company contact line, then "Page X of Y". */
function brandFooter() {
  const pageStyle = { font: FONT, size: 16, color: MUTED };
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: BRAND.rule, space: 6 } },
        children: [new TextRun({ text: CONTACT_LINE, font: FONT, size: 17, color: BRAND.navy })],
      }),
      // Each piece is its own run so the page-number fields keep the same size/colour as the text.
      new Paragraph({
        style: PAGE_NUMBER_STYLE,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Page ', ...pageStyle }),
          new TextRun({ children: [PageNumber.CURRENT], ...pageStyle }),
          new TextRun({ text: ' of ', ...pageStyle }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], ...pageStyle }),
        ],
      }),
    ],
  });
}

/** Build the Word document (separate from saving so it can be tested). */
export function buildSurveyDocx(survey) {
  const numbers = getQuestionNumbers(survey.questions);
  const progress = computeProgress(survey);
  const children = [];

  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [run(survey.title || 'Untitled survey', { bold: true, size: 40, color: TEAL })],
    }),
  );
  if (survey.description) {
    children.push(new Paragraph({ spacing: { after: 120 }, children: textRuns(survey.description, { size: 22, color: MUTED }) }));
  }
  if (progress.questionCount) {
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 6 } },
        children: [
          run(`${progress.questionCount} question${progress.questionCount === 1 ? '' : 's'}  |  about ${progress.estMinutes} min  |  * = required`, {
            size: 19,
            color: MUTED,
          }),
        ],
      }),
    );
  }

  for (const q of survey.questions || []) {
    if (q.type === 'section') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          keepNext: true,
          spacing: { before: 360, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C8D2D0', space: 2 } },
          children: [run(q.text || 'Section', { bold: true, size: 28, color: TEAL })],
        }),
      );
      if (q.help) children.push(new Paragraph({ spacing: { after: 80 }, children: textRuns(q.help, { italics: true, size: 19, color: MUTED }) }));
      continue;
    }

    children.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 240, after: 60 },
        children: [
          run(`${numbers[q.id]}. `, { bold: true, size: 23 }),
          ...textRuns(q.text || '(no question text)', { bold: true, size: 23 }),
          ...(q.required ? [run(' *', { bold: true, size: 23, color: 'B9402A' })] : []),
        ],
      }),
    );
    if (q.help) {
      children.push(
        new Paragraph({ keepNext: true, spacing: { after: 60 }, children: textRuns(q.help, { italics: true, size: 19, color: MUTED }) }),
      );
    }

    switch (q.type) {
      case 'short_text':
      case 'email':
      case 'number':
        children.push(answerLine());
        break;
      case 'long_text':
        children.push(answerLine(), answerLine(), answerLine());
        break;
      case 'date':
        children.push(noteParagraph('____ / ____ / ________   (day / month / year)'));
        break;
      case 'multiple_choice':
      case 'dropdown':
        (q.options || []).forEach((o) => children.push(optionParagraph(o.label, '\u25CB')));
        break;
      case 'checkboxes': {
        const limit = selectionLimit(q);
        if (limit) children.push(noteParagraph(`Select up to ${limit}`));
        (q.options || []).forEach((o) => children.push(optionParagraph(o.label, '\u2610')));
        break;
      }
      case 'yes_no':
        children.push(optionParagraph('Yes', '\u25CB'), optionParagraph('No', '\u25CB'));
        break;
      case 'rating': {
        const n = Number(q.scaleMax) || 5;
        const parts = [];
        for (let i = 1; i <= n; i += 1) {
          parts.push(new TextRun({ text: '\u25CB ', font: SYMBOL_FONT, size: 22 }));
          parts.push(new TextRun({ text: `${i}      `, font: FONT, size: 22 }));
        }
        children.push(new Paragraph({ indent: { left: 360 }, spacing: { after: 40 }, children: parts }));
        const labels = [];
        if (q.minLabel) labels.push(`1 = ${q.minLabel}`);
        if (q.maxLabel) labels.push(`${n} = ${q.maxLabel}`);
        if (labels.length) children.push(noteParagraph(labels.join('     ')));
        break;
      }
      case 'matrix':
        children.push(matrixTable(q));
        children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        break;
      default:
        break;
    }
  }

  return new Document({
    creator: COMPANY.fullName,
    title: survey.title || 'Survey',
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
      paragraphStyles: [{ id: PAGE_NUMBER_STYLE, name: 'Page number line', basedOn: 'Normal', run: { font: FONT, size: 16, color: MUTED } }],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            // top/bottom leave room for the letterhead and the contact footer
            margin: { top: 1900, right: 1134, bottom: 1400, left: 1134, header: 567, footer: 500 },
          },
        },
        headers: { default: brandHeader() },
        footers: { default: brandFooter() },
        children,
      },
    ],
  });
}

export async function exportSurveyDocx(survey) {
  const doc = buildSurveyDocx(survey);
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${slugify(survey.title)}.docx`);
}
