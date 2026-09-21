import { newQuestionId, newOptionId } from './ids';
import { OPTION_TYPES } from './questionTypes';

/*
 * Survey shape (what is stored in Firestore):
 *
 * {
 *   title, description, status: 'draft' | 'complete',
 *   questions: [
 *     { id, type, text, help, required,
 *       options?: [{ id, label }]        // choice types + matrix COLUMNS
 *       rows?: [{ id, label }]           // matrix rows
 *       scaleMax?, minLabel?, maxLabel?  // rating
 *       maxSelections?                   // checkboxes (0 = unlimited)
 *     }
 *   ]
 * }
 */

export const MAX_TEXT_LENGTH = 5000;
export const RATING_MIN_SCALE = 3;
export const RATING_MAX_SCALE = 10;

export function createOption(label = '') {
  return { id: newOptionId(), label };
}

function applyTypeDefaults(q, type) {
  const next = { ...q, type };
  if (OPTION_TYPES.includes(type)) {
    if (!Array.isArray(next.options) || next.options.length === 0) {
      next.options = [createOption('Option 1'), createOption('Option 2')];
    }
  }
  if (type === 'matrix') {
    if (!Array.isArray(next.rows) || next.rows.length === 0) {
      next.rows = [createOption('Row 1'), createOption('Row 2')];
    }
    if (!Array.isArray(next.options) || next.options.length === 0) {
      next.options = [createOption('Column 1'), createOption('Column 2'), createOption('Column 3')];
    }
  }
  if (type === 'rating') {
    if (!next.scaleMax) next.scaleMax = 5;
    if (next.minLabel === undefined) next.minLabel = '';
    if (next.maxLabel === undefined) next.maxLabel = '';
  }
  if (type === 'checkboxes' && (next.maxSelections === undefined || next.maxSelections === null)) {
    next.maxSelections = 0;
  }
  if (type === 'section') next.required = false;
  return next;
}

export function createQuestion(type = 'short_text') {
  return applyTypeDefaults({ id: newQuestionId(), type, text: '', help: '', required: false }, type);
}

/** Switch a question to another type, keeping its text, help text and (where compatible) choices. */
export function changeQuestionType(question, type) {
  return applyTypeDefaults(question, type);
}

/** Build a question from a compact spec (used by templates). */
export function makeQuestion(spec) {
  const { type, text, help = '', required = false, options, rows, scaleMax, minLabel, maxLabel, maxSelections } = spec;
  const q = { id: newQuestionId(), type, text, help, required };
  if (options) q.options = options.map((label) => createOption(label));
  if (rows) q.rows = rows.map((label) => createOption(label));
  if (scaleMax) q.scaleMax = scaleMax;
  if (minLabel !== undefined) q.minLabel = minLabel;
  if (maxLabel !== undefined) q.maxLabel = maxLabel;
  if (maxSelections !== undefined) q.maxSelections = maxSelections;
  return applyTypeDefaults(q, type);
}

export function duplicateQuestion(question) {
  const copy = JSON.parse(JSON.stringify(question));
  copy.id = newQuestionId();
  if (Array.isArray(copy.options)) copy.options = copy.options.map((o) => ({ ...o, id: newOptionId() }));
  if (Array.isArray(copy.rows)) copy.rows = copy.rows.map((o) => ({ ...o, id: newOptionId() }));
  return copy;
}

const clampInt = (value, min, max, fallback) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** Strip fields that do not belong to the question's type and trim text. Safe to store in Firestore. */
export function normalizeQuestion(q) {
  const base = {
    id: q.id,
    type: q.type,
    text: (q.text || '').trim(),
    help: (q.help || '').trim(),
    required: q.type === 'section' ? false : Boolean(q.required),
  };
  const cleanList = (list) => (list || []).map((o) => ({ id: o.id, label: (o.label || '').trim() }));
  if (OPTION_TYPES.includes(q.type) || q.type === 'matrix') base.options = cleanList(q.options);
  if (q.type === 'matrix') base.rows = cleanList(q.rows);
  if (q.type === 'rating') {
    base.scaleMax = clampInt(q.scaleMax, RATING_MIN_SCALE, RATING_MAX_SCALE, 5);
    base.minLabel = (q.minLabel || '').trim();
    base.maxLabel = (q.maxLabel || '').trim();
  }
  if (q.type === 'checkboxes') base.maxSelections = clampInt(q.maxSelections, 0, 999, 0);
  return base;
}

export function normalizeSurveyForSave(survey) {
  return {
    title: (survey.title || '').trim(),
    description: (survey.description || '').trim(),
    questions: (survey.questions || []).map(normalizeQuestion),
  };
}

/** Number every real question (sections are not numbered). Returns { [questionId]: number }. */
export function getQuestionNumbers(questions) {
  const numbers = {};
  let n = 0;
  for (const q of questions || []) {
    if (q.type === 'section') continue;
    n += 1;
    numbers[q.id] = n;
  }
  return numbers;
}

function listIssues(list, noun, min) {
  const issues = [];
  const labels = (list || []).map((o) => (o.label || '').trim());
  if (labels.length < min) issues.push({ code: 'options', message: `Add at least ${min} ${noun}${min > 1 ? 's' : ''}` });
  if (labels.some((l) => !l)) issues.push({ code: 'options', message: `Fill in or remove the empty ${noun}s` });
  const lowered = labels.filter(Boolean).map((l) => l.toLowerCase());
  if (new Set(lowered).size !== lowered.length) issues.push({ code: 'options', message: `Each ${noun} must be unique` });
  return issues;
}

/** Everything that stops a single question from being "complete". */
export function getQuestionIssues(q) {
  const issues = [];
  if (!(q.text || '').trim()) {
    issues.push({ code: 'text', message: q.type === 'section' ? 'Add a section title' : 'Add the question text' });
  }
  if (OPTION_TYPES.includes(q.type)) {
    issues.push(...listIssues(q.options, 'option', 2));
  }
  if (q.type === 'matrix') {
    issues.push(...listIssues(q.rows, 'row', 1));
    issues.push(...listIssues(q.options, 'column', 2));
  }
  if (q.type === 'rating') {
    const max = Number(q.scaleMax);
    if (!Number.isInteger(max) || max < RATING_MIN_SCALE || max > RATING_MAX_SCALE) {
      issues.push({ code: 'scale', message: `Choose a scale between ${RATING_MIN_SCALE} and ${RATING_MAX_SCALE}` });
    }
  }
  return issues;
}

// Rough seconds a respondent needs per question (used for the time estimate).
function secondsFor(q) {
  switch (q.type) {
    case 'long_text': return 60;
    case 'short_text': return 20;
    case 'checkboxes': return 20;
    case 'matrix': return 8 * Math.max(1, (q.rows || []).length);
    case 'section': return 0;
    default: return 10;
  }
}

/**
 * Progress of a survey being built.
 * Units of work = title + description + "has a question" + one unit per item.
 * The survey can be marked complete only when every unit is done (percent === 100).
 */
export function computeProgress(survey) {
  const questions = survey.questions || [];
  const titleDone = Boolean((survey.title || '').trim());
  const descDone = Boolean((survey.description || '').trim());
  const answerable = questions.filter((q) => q.type !== 'section');
  const hasQuestion = answerable.length > 0;

  const issuesById = {};
  let completeItems = 0;
  for (const q of questions) {
    const issues = getQuestionIssues(q);
    if (issues.length) issuesById[q.id] = issues;
    else completeItems += 1;
  }
  const allIssues = Object.values(issuesById).flat();

  const totalUnits = 3 + questions.length;
  const doneUnits = (titleDone ? 1 : 0) + (descDone ? 1 : 0) + (hasQuestion ? 1 : 0) + completeItems;
  const percent = doneUnits === totalUnits ? 100 : Math.min(99, Math.floor((100 * doneUnits) / totalUnits));

  const checklist = [
    { key: 'title', label: 'Survey title added', done: titleDone },
    { key: 'description', label: 'Description added', done: descDone },
    { key: 'questions', label: 'At least one question added', done: hasQuestion },
    { key: 'text', label: 'Every question has its text', done: hasQuestion && !allIssues.some((i) => i.code === 'text') },
    {
      key: 'choices',
      label: 'All choices and scales are set up',
      done: hasQuestion && !allIssues.some((i) => i.code === 'options' || i.code === 'scale'),
    },
  ];

  const typeCounts = {};
  let requiredCount = 0;
  let seconds = 0;
  for (const q of questions) {
    typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
    if (q.type !== 'section' && q.required) requiredCount += 1;
    seconds += secondsFor(q);
  }

  return {
    percent,
    checklist,
    canComplete: percent === 100,
    totalItems: questions.length,
    questionCount: answerable.length,
    sectionCount: questions.length - answerable.length,
    completeItems,
    incompleteItems: questions.length - completeItems,
    requiredCount,
    optionalCount: answerable.length - requiredCount,
    typeCounts,
    estMinutes: answerable.length ? Math.max(1, Math.ceil(seconds / 60)) : 0,
    issuesById,
  };
}
