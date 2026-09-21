export const QUESTION_TYPES = [
  { value: 'short_text', label: 'Short answer', icon: 'bi-input-cursor-text', hint: 'One line of text' },
  { value: 'long_text', label: 'Paragraph', icon: 'bi-text-paragraph', hint: 'A longer written answer' },
  { value: 'multiple_choice', label: 'Multiple choice', icon: 'bi-record-circle', hint: 'Pick one option' },
  { value: 'checkboxes', label: 'Checkboxes', icon: 'bi-check2-square', hint: 'Pick one or more options' },
  { value: 'dropdown', label: 'Dropdown', icon: 'bi-menu-button-wide', hint: 'Pick one from a list' },
  { value: 'rating', label: 'Rating scale', icon: 'bi-star', hint: 'A numbered scale, e.g. 1 to 5' },
  { value: 'yes_no', label: 'Yes / No', icon: 'bi-toggle-on', hint: 'Two fixed choices' },
  { value: 'matrix', label: 'Grid', icon: 'bi-grid-3x3', hint: 'Rows rated on the same choices' },
  { value: 'number', label: 'Number', icon: 'bi-123', hint: 'A numeric answer' },
  { value: 'date', label: 'Date', icon: 'bi-calendar-event', hint: 'A calendar date' },
  { value: 'email', label: 'Email', icon: 'bi-envelope', hint: 'A valid email address' },
  { value: 'section', label: 'Section heading', icon: 'bi-type-h2', hint: 'Groups questions, no answer' },
];

export const TYPE_MAP = Object.fromEntries(QUESTION_TYPES.map((t) => [t.value, t]));

/** Types whose choices are stored in `options`. */
export const OPTION_TYPES = ['multiple_choice', 'checkboxes', 'dropdown'];

export const typeLabel = (type) => TYPE_MAP[type]?.label ?? type;
export const typeIcon = (type) => TYPE_MAP[type]?.icon ?? 'bi-question-circle';
