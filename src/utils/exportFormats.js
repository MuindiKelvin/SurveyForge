/**
 * Every way the results can be downloaded.
 *
 *  - `options` lists which of the data options (see DEFAULT_DATA_OPTIONS) the format honours; the
 *    download dialog only shows those. Formats with an empty list ignore the options.
 *  - Keep this file free of heavy imports: the UI loads it up-front, while the exporters
 *    (exportResultsData.js, exportResultsExcel.js, exportResultsPdf.js) are loaded on demand.
 */

export const DEFAULT_DATA_OPTIONS = {
  /** 'text' = the choice the person picked ("Very satisfied"); 'numeric' = its code (5). */
  values: 'text',
  /** 'short' = Q1, Q2, ... | 'full' = "1. Question text" | 'both' = a Q1 row followed by a question-text row. */
  headers: 'short',
  /** Checkbox questions: false = one column holding all choices, true = one column per choice. */
  splitMulti: false,
};

export const EXPORT_GROUPS = [
  { key: 'reports', label: 'Reports', hint: 'Ready to read or share' },
  { key: 'data', label: 'Data files', hint: 'For analysis in SPSS, R, Python, Stata, Excel and similar tools' },
];

export const EXPORT_FORMATS = [
  {
    key: 'xlsx',
    group: 'reports',
    label: 'Excel workbook',
    ext: '.xlsx',
    icon: 'bi-file-earmark-spreadsheet',
    hint: 'A Summary sheet plus a Responses sheet with every answer.',
    options: [],
  },
  {
    key: 'pdf',
    group: 'reports',
    label: 'PDF report',
    ext: '.pdf',
    icon: 'bi-file-earmark-pdf',
    hint: 'Branded report with charts and the summary of every question.',
    options: [],
  },
  {
    key: 'txt',
    group: 'reports',
    label: 'Plain text',
    ext: '.txt',
    icon: 'bi-file-earmark-text',
    hint: 'A readable text file: every response, question by question.',
    options: [],
  },
  {
    key: 'csv',
    group: 'data',
    label: 'CSV',
    ext: '.csv',
    icon: 'bi-filetype-csv',
    hint: 'Comma-separated values. Opens in Excel, Google Sheets, R, SPSS and more.',
    options: ['values', 'headers', 'splitMulti'],
  },
  {
    key: 'tsv',
    group: 'data',
    label: 'TSV',
    ext: '.tsv',
    icon: 'bi-table',
    hint: 'Tab-separated values. Same as CSV but safe for answers that contain commas.',
    options: ['values', 'headers', 'splitMulti'],
  },
  {
    key: 'sav',
    group: 'data',
    label: 'SPSS',
    ext: '.sav',
    icon: 'bi-bar-chart-line',
    hint: 'Native SPSS data file with variable labels and value labels.',
    note: 'Choice answers are saved as numeric codes with value labels, and checkbox choices as one 0/1 variable each - the way SPSS expects survey data.',
    options: [],
  },
  {
    key: 'json',
    group: 'data',
    label: 'JSON',
    ext: '.json',
    icon: 'bi-filetype-json',
    hint: 'One file with the variable definitions and all responses.',
    options: ['values', 'splitMulti'],
  },
  {
    key: 'ndjson',
    group: 'data',
    label: 'NDJSON',
    ext: '.ndjson',
    icon: 'bi-braces',
    hint: 'One JSON object per line - one line per response. Good for data pipelines.',
    options: ['values', 'splitMulti'],
  },
  {
    key: 'xml',
    group: 'data',
    label: 'XML',
    ext: '.xml',
    icon: 'bi-filetype-xml',
    hint: 'Variable definitions followed by every response.',
    options: ['values', 'splitMulti'],
  },
  {
    key: 'codebook',
    group: 'data',
    label: 'Codebook',
    ext: '.csv',
    icon: 'bi-journal-text',
    hint: 'A data dictionary: every variable, its question and what each numeric code means.',
    note: 'Choose "Numeric codes" to list what each code stands for. Use the same options as your data file so the variable names match.',
    options: ['values', 'splitMulti'],
  },
];

export const FORMAT_MAP = Object.fromEntries(EXPORT_FORMATS.map((f) => [f.key, f]));

export const VALUES_CHOICES = [
  { value: 'text', label: 'Choice text', hint: 'e.g. "Very satisfied"' },
  { value: 'numeric', label: 'Numeric codes', hint: 'e.g. 5 (choices are numbered 1, 2, 3 ... in the order they appear in the survey)' },
];

export const HEADER_CHOICES = [
  { value: 'short', label: 'Short names', hint: 'Q1, Q2, Q3_1 ...' },
  { value: 'full', label: 'Full question text', hint: '1. How satisfied are you?' },
  { value: 'both', label: 'Both (two header rows)', hint: 'Short names, then the question text underneath' },
];
