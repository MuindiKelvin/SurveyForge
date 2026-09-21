import { BRAND, COMPANY, CONTACT_LINE, hexToRgb } from '../config/company';
import { LOGO_DATA_URI } from './branding';
import { pdfSafe } from './pdfText';

const NAVY = hexToRgb(BRAND.navy);
const BLUE = hexToRgb(BRAND.blue);
const RULE = hexToRgb(BRAND.rule);
const MUTED = hexToRgb(BRAND.muted);

/** Where page content starts (below the letterhead) and how much room the footer needs (pt). */
export const PDF_TOP = 94;
export const PDF_BOTTOM = 66;

const LOGO_SIZE = 46;
const LOGO_TOP = 22;

/** Letterhead: circular logo + company name on the left, website on the right, then a rule. */
export function drawBrandHeader(doc, marginX) {
  const pageW = doc.internal.pageSize.getWidth();
  const textX = marginX + LOGO_SIZE + 12;

  doc.addImage(LOGO_DATA_URI, 'PNG', marginX, LOGO_TOP, LOGO_SIZE, LOGO_SIZE, 'company-logo', 'FAST');

  doc.setFont('times', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(...NAVY);
  doc.text(COMPANY.name, textX, LOGO_TOP + 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...BLUE);
  doc.text(COMPANY.tagline, textX, LOGO_TOP + 36, { charSpace: 2.4 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(COMPANY.website, pageW - marginX, LOGO_TOP + 26, { align: 'right' });

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1.1);
  doc.line(marginX, LOGO_TOP + LOGO_SIZE + 9, pageW - marginX, LOGO_TOP + LOGO_SIZE + 9);
}

/** Footer: rule, company contact line, then "<label> - Page X of Y". */
export function drawBrandFooter(doc, marginX, label, page, pages) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.7);
  doc.line(marginX, pageH - 52, pageW - marginX, pageH - 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(pdfSafe(CONTACT_LINE), pageW / 2, pageH - 39, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`${pdfSafe(label)}  -  Page ${page} of ${pages}`, pageW / 2, pageH - 26, { align: 'center' });
}

/** Stamp the letterhead and footer on every page. Call once, after all content has been drawn. */
export function applyPdfBranding(doc, marginX, label) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    drawBrandHeader(doc, marginX);
    drawBrandFooter(doc, marginX, label, i, pages);
  }
}
