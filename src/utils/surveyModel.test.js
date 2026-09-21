import { describe, expect, it } from 'vitest';
import { buildOwnerDiagnosticTemplate } from '../templates/ownerDiagnostic';
import {
  changeQuestionType,
  computeProgress,
  createQuestion,
  duplicateQuestion,
  getQuestionIssues,
  getQuestionNumbers,
  makeQuestion,
  normalizeSurveyForSave,
} from './surveyModel';

describe('computeProgress', () => {
  it('is 0% for an empty survey and cannot be completed', () => {
    const p = computeProgress({ title: '', description: '', questions: [] });
    expect(p.percent).toBe(0);
    expect(p.canComplete).toBe(false);
    expect(p.checklist.every((c) => !c.done)).toBe(true);
  });

  it('reaches exactly 100% only when everything is complete', () => {
    const q = makeQuestion({ type: 'multiple_choice', text: 'Pick', options: ['A', 'B'] });
    const almost = computeProgress({ title: 'T', description: '', questions: [q] });
    expect(almost.percent).toBeLessThan(100);
    expect(almost.canComplete).toBe(false);
    const done = computeProgress({ title: 'T', description: 'D', questions: [q] });
    expect(done.percent).toBe(100);
    expect(done.canComplete).toBe(true);
  });

  it('never rounds up to 100% while something is missing', () => {
    const questions = Array.from({ length: 300 }, (_, i) => makeQuestion({ type: 'short_text', text: `Q${i}` }));
    questions.push(createQuestion('short_text')); // one empty question
    const p = computeProgress({ title: 'T', description: 'D', questions });
    expect(p.percent).toBe(99);
    expect(p.canComplete).toBe(false);
  });

  it('a section alone does not count as a question', () => {
    const p = computeProgress({ title: 'T', description: 'D', questions: [makeQuestion({ type: 'section', text: 'Part A' })] });
    expect(p.canComplete).toBe(false);
    expect(p.percent).toBeLessThan(100);
  });

  it('flags choice, matrix and duplicate problems', () => {
    expect(getQuestionIssues(createQuestion('short_text')).map((i) => i.code)).toEqual(['text']);
    const dup = makeQuestion({ type: 'checkboxes', text: 'x', options: ['A', 'a'] });
    expect(getQuestionIssues(dup).some((i) => i.code === 'options')).toBe(true);
    const oneCol = makeQuestion({ type: 'matrix', text: 'x', rows: ['r'], options: ['only'] });
    expect(getQuestionIssues(oneCol).some((i) => i.code === 'options')).toBe(true);
    const emptyOpt = { ...makeQuestion({ type: 'dropdown', text: 'x', options: ['A', 'B'] }) };
    emptyOpt.options[1].label = '  ';
    expect(getQuestionIssues(emptyOpt).some((i) => i.code === 'options')).toBe(true);
  });
});

describe('question helpers', () => {
  it('numbers questions but not sections', () => {
    const qs = [makeQuestion({ type: 'section', text: 'S' }), createQuestion('short_text'), createQuestion('yes_no')];
    const n = getQuestionNumbers(qs);
    expect(n[qs[0].id]).toBeUndefined();
    expect(n[qs[1].id]).toBe(1);
    expect(n[qs[2].id]).toBe(2);
  });

  it('keeps text and adds defaults when changing type', () => {
    const q = { ...createQuestion('short_text'), text: 'Hello' };
    const m = changeQuestionType(q, 'matrix');
    expect(m.text).toBe('Hello');
    expect(m.rows.length).toBeGreaterThan(0);
    expect(m.options.length).toBeGreaterThan(1);
    expect(changeQuestionType(q, 'rating').scaleMax).toBe(5);
  });

  it('duplicates with fresh ids', () => {
    const q = makeQuestion({ type: 'matrix', text: 'x', rows: ['r1'], options: ['a', 'b'] });
    const c = duplicateQuestion(q);
    expect(c.id).not.toBe(q.id);
    expect(c.rows[0].id).not.toBe(q.rows[0].id);
    expect(c.options[0].label).toBe('a');
  });

  it('normalises for saving: trims and strips foreign fields, no undefined values', () => {
    const q = { ...createQuestion('short_text'), text: '  hi  ', options: [{ id: 'o1', label: 'x' }], scaleMax: 4 };
    const out = normalizeSurveyForSave({ title: ' T ', description: ' D ', questions: [q] });
    expect(out.title).toBe('T');
    expect(out.questions[0].text).toBe('hi');
    expect(out.questions[0].options).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('undefined');
  });
});

describe('Owner Business Diagnostic template', () => {
  const t = buildOwnerDiagnosticTemplate();
  const questions = t.questions.filter((q) => q.type !== 'section');

  it('has 10 sections and 43 questions with correct numbering', () => {
    expect(t.questions.filter((q) => q.type === 'section')).toHaveLength(10);
    expect(questions).toHaveLength(43);
    expect(Math.max(...Object.values(getQuestionNumbers(t.questions)))).toBe(43);
  });

  it('is fully valid so it can be completed straight away', () => {
    const p = computeProgress({ ...t });
    expect(p.issuesById).toEqual({});
    expect(p.canComplete).toBe(true);
    expect(p.percent).toBe(100);
  });

  it('has the two grid questions and select-three limits', () => {
    expect(questions.filter((q) => q.type === 'matrix')).toHaveLength(2);
    expect(questions.filter((q) => q.type === 'checkboxes' && q.maxSelections === 3).length).toBeGreaterThanOrEqual(4);
  });
});
