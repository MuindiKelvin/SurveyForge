import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { buildOwnerDiagnosticTemplate } from '../templates/ownerDiagnostic';
import { buildResultsPdf } from './exportResultsPdf';
import { buildResultsWorkbook } from './exportResultsExcel';
import { buildSurveyDocx } from './exportSurveyDocx';
import { buildSurveyPdf } from './exportSurveyPdf';
import { makeQuestion } from './surveyModel';
import { pdfSafe } from './pdfText';
import { COMPANY, CONTACT_LINE } from '../config/company';
import { getLogoBytes } from './branding';

const everyType = () => ({
  title: 'All types \u2013 \u201Cquoted\u201D',
  description: 'Line one\nLine two',
  questions: [
    makeQuestion({ type: 'section', text: 'Part A', help: 'About you' }),
    makeQuestion({ type: 'short_text', text: 'Name', required: true }),
    makeQuestion({ type: 'long_text', text: 'Story' }),
    makeQuestion({ type: 'email', text: 'Email' }),
    makeQuestion({ type: 'number', text: 'Age' }),
    makeQuestion({ type: 'date', text: 'When' }),
    makeQuestion({ type: 'multiple_choice', text: 'One', options: ['A', 'B'] }),
    makeQuestion({ type: 'checkboxes', text: 'Many', options: ['A', 'B', 'C'], maxSelections: 2 }),
    makeQuestion({ type: 'dropdown', text: 'Drop', options: ['A', 'B'] }),
    makeQuestion({ type: 'yes_no', text: 'Sure?' }),
    makeQuestion({ type: 'rating', text: 'Rate', scaleMax: 7, minLabel: 'Bad', maxLabel: 'Good' }),
    makeQuestion({ type: 'matrix', text: 'Grid', rows: ['r1', 'r2', 'r3'], options: ['x', 'y', 'z'] }),
  ],
});

const fakeResponses = (s) =>
  Array.from({ length: 5 }, (_, i) => {
    const a = {};
    for (const q of s.questions) {
      if (q.type === 'short_text') a[q.id] = `Person ${i}`;
      if (q.type === 'long_text') a[q.id] = 'A long story\nwith a line break';
      if (q.type === 'number') a[q.id] = i * 10;
      if (q.type === 'multiple_choice' || q.type === 'dropdown') a[q.id] = q.options[i % 2].label;
      if (q.type === 'checkboxes') a[q.id] = [q.options[0].label, q.options[2].label];
      if (q.type === 'yes_no') a[q.id] = i % 2 ? 'Yes' : 'No';
      if (q.type === 'rating') a[q.id] = (i % 7) + 1;
      if (q.type === 'matrix') a[q.id] = { [q.rows[0].id]: 'x', [q.rows[1].id]: 'z' };
    }
    return { id: `r${i}`, submittedAt: Date.UTC(2026, 0, 1 + i, 9, 30), answers: a };
  });

describe('exports', () => {
  it('makes a survey PDF for every question type', () => {
    const doc = buildSurveyPdf(everyType());
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(2000);
  });

  it('makes a multi-page survey PDF from the big template', () => {
    const doc = buildSurveyPdf(buildOwnerDiagnosticTemplate());
    expect(doc.getNumberOfPages()).toBeGreaterThan(4);
  });

  it('makes a valid .docx (zip) for every question type and the template', async () => {
    for (const s of [everyType(), buildOwnerDiagnosticTemplate()]) {
      const buf = await Packer.toBuffer(buildSurveyDocx(s));
      expect(buf.length).toBeGreaterThan(3000);
      expect(String.fromCharCode(buf[0], buf[1])).toBe('PK');
    }
  });

  it('makes a results workbook with Summary and Responses sheets', () => {
    const s = everyType();
    const wb = buildResultsWorkbook(s, fakeResponses(s));
    expect(wb.SheetNames).toEqual(['Summary', 'Responses']);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Responses, { header: 1 });
    expect(rows).toHaveLength(6); // header + 5 responses
    expect(rows[0][0]).toBe('#');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it('handles an empty response set', () => {
    const s = everyType();
    expect(XLSX.write(buildResultsWorkbook(s, []), { type: 'array', bookType: 'xlsx' }).byteLength).toBeGreaterThan(500);
    expect(buildResultsPdf(s, []).getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('makes a results PDF', () => {
    const s = everyType();
    const doc = buildResultsPdf(s, fakeResponses(s));
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(3000);
  });

  it('pdfSafe replaces characters the PDF font cannot draw', () => {
    expect(pdfSafe('\u201Chi\u201D \u2013 \u2026 \u20AC \u4F60')).toBe('"hi" - ... ? ?');
    expect(pdfSafe('caf\u00E9')).toBe('caf\u00E9');
  });
});

describe('company branding on every document', () => {
  const count = (text, needle) => text.split(needle).length - 1;

  it('the exact contact line is used', () => {
    expect(CONTACT_LINE).toBe('Call/WhatsApp 0729 372 659 | payoneerlimitedinfo@gmail.com / Nairobi, Kenya');
  });

  it('the logo file is a square PNG (so it renders as a circle)', () => {
    const bytes = getLogoBytes();
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    expect(width).toBe(height);
    expect(bytes[25]).toBe(6); // colour type 6 = RGBA, so the corners outside the circle are transparent
  });

  const pdfChecks = (doc) => {
    const pages = doc.getNumberOfPages();
    const raw = doc.output();
    // company name, tagline and contact line are drawn once per page
    expect(count(raw, `(${COMPANY.name})`)).toBe(pages);
    expect(count(raw, `(${COMPANY.tagline})`)).toBe(pages);
    expect(count(raw, `(${CONTACT_LINE})`)).toBe(pages);
    // the logo image is embedded (once, not once per page)
    expect(count(raw, '/Subtype /Image')).toBeGreaterThanOrEqual(1);
    expect(count(raw, '/Subtype /Image')).toBeLessThanOrEqual(2); // image + its transparency mask
    return pages;
  };

  it('survey PDF: logo + contact details on every page of a short survey', () => {
    const tiny = { title: 'Tiny', description: '', questions: [makeQuestion({ type: 'short_text', text: 'Name' })] };
    expect(pdfChecks(buildSurveyPdf(tiny))).toBe(1); // a one-page document is branded too
    expect(pdfChecks(buildSurveyPdf(everyType()))).toBeGreaterThanOrEqual(1);
  });

  it('survey PDF: logo + contact details on EVERY page of a long survey', () => {
    expect(pdfChecks(buildSurveyPdf(buildOwnerDiagnosticTemplate()))).toBeGreaterThan(4);
  });

  it('results PDF: logo + contact details on every page, including with no responses', () => {
    const s = everyType();
    expect(pdfChecks(buildResultsPdf(s, fakeResponses(s)))).toBeGreaterThan(1);
    expect(pdfChecks(buildResultsPdf(s, []))).toBeGreaterThanOrEqual(1);
  });

  it('Word document: header has the logo and company name, footer has the contact line', async () => {
    for (const s of [everyType(), buildOwnerDiagnosticTemplate()]) {
      const zip = await JSZip.loadAsync(await Packer.toBuffer(buildSurveyDocx(s)));
      const names = Object.keys(zip.files);
      const header = names.find((n) => /^word\/header\d+\.xml$/.test(n));
      const footer = names.find((n) => /^word\/footer\d+\.xml$/.test(n));
      expect(header).toBeTruthy();
      expect(footer).toBeTruthy();

      const headerXml = await zip.file(header).async('string');
      expect(headerXml).toContain('<w:drawing>'); // the logo image
      expect(headerXml).toContain(COMPANY.name);
      expect(headerXml).toContain(COMPANY.tagline.replace('&', '&amp;'));

      const footerXml = await zip.file(footer).async('string');
      expect(footerXml).toContain(CONTACT_LINE);
      expect(footerXml).toContain('PAGE');
      expect(footerXml).toContain('NUMPAGES');

      // the embedded picture is byte-for-byte the circular logo from src/assets
      const media = names.filter((n) => /^word\/media\/.+\.png$/.test(n));
      expect(media.length).toBeGreaterThanOrEqual(1);
      const embedded = await zip.file(media[0]).async('uint8array');
      expect(Array.from(embedded)).toEqual(Array.from(getLogoBytes()));
    }
  });

  it('the body of the Word document still contains the survey title and questions', async () => {
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildSurveyDocx(everyType())));
    const body = await zip.file('word/document.xml').async('string');
    expect(body).toContain('Part A');
    expect(body).toContain('Name');
  });

  it('Excel results: company details on top of the Summary sheet, Responses sheet untouched', () => {
    const s = everyType();
    const wb = buildResultsWorkbook(s, fakeResponses(s));
    const summary = XLSX.utils.sheet_to_json(wb.Sheets.Summary, { header: 1 });
    expect(summary[0][0]).toBe(COMPANY.fullName);
    expect(summary[1][0]).toBe(CONTACT_LINE);
    expect(summary.some((r) => r[0] === 'Total responses' && r[1] === 5)).toBe(true);
    const responses = XLSX.utils.sheet_to_json(wb.Sheets.Responses, { header: 1 });
    expect(responses[0][0]).toBe('#');
    expect(responses).toHaveLength(6);
  });
});
