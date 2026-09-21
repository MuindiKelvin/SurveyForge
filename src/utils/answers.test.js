import { describe, expect, it } from 'vitest';
import { cleanAnswers, selectionLimit, validateAnswers } from './answers';
import { makeQuestion } from './surveyModel';

const qs = () => [
  makeQuestion({ type: 'section', text: 'S' }),
  makeQuestion({ type: 'short_text', text: 'Name', required: true }),
  makeQuestion({ type: 'email', text: 'Email' }),
  makeQuestion({ type: 'number', text: 'Age' }),
  makeQuestion({ type: 'multiple_choice', text: 'Colour', options: ['Red', 'Blue'], required: true }),
  makeQuestion({ type: 'checkboxes', text: 'Pick', options: ['A', 'B', 'C'], maxSelections: 2 }),
  makeQuestion({ type: 'rating', text: 'Rate', scaleMax: 5 }),
  makeQuestion({ type: 'matrix', text: 'Grid', rows: ['r1', 'r2'], options: ['x', 'y'], required: true }),
];

describe('validateAnswers', () => {
  it('reports every missing required answer', () => {
    const list = qs();
    const errors = validateAnswers(list, {});
    expect(Object.keys(errors)).toEqual([list[1].id, list[4].id, list[7].id]);
  });

  it('accepts a complete valid set', () => {
    const list = qs();
    const answers = {
      [list[1].id]: 'Amina',
      [list[2].id]: 'a@b.co',
      [list[3].id]: '42',
      [list[4].id]: 'Red',
      [list[5].id]: ['A', 'B'],
      [list[6].id]: 4,
      [list[7].id]: { [list[7].rows[0].id]: 'x', [list[7].rows[1].id]: 'y' },
    };
    expect(validateAnswers(list, answers)).toEqual({});
  });

  it('rejects bad email, bad number, too many ticks and partly answered required grid', () => {
    const list = qs();
    const errors = validateAnswers(list, {
      [list[1].id]: 'x',
      [list[2].id]: 'not-an-email',
      [list[3].id]: 'abc',
      [list[4].id]: 'Red',
      [list[5].id]: ['A', 'B', 'C'],
      [list[7].id]: { [list[7].rows[0].id]: 'x' },
    });
    expect(errors[list[2].id]).toMatch(/email/i);
    expect(errors[list[3].id]).toMatch(/number/i);
    expect(errors[list[5].id]).toMatch(/no more than 2/i);
    expect(errors[list[7].id]).toMatch(/every row/i);
  });

  it('ignores the selection limit when it covers all options', () => {
    expect(selectionLimit({ maxSelections: 3, options: [1, 2, 3] })).toBe(0);
    expect(selectionLimit({ maxSelections: 2, options: [1, 2, 3] })).toBe(2);
  });
});

describe('cleanAnswers', () => {
  it('drops blanks/invalid values, converts numbers, keeps option order', () => {
    const list = qs();
    const cleaned = cleanAnswers(list, {
      [list[1].id]: '  Amina  ',
      [list[2].id]: '',
      [list[3].id]: '42',
      [list[4].id]: 'Purple', // not an option
      [list[5].id]: ['C', 'A'],
      [list[6].id]: 9, // out of scale
      [list[7].id]: { [list[7].rows[0].id]: 'x', [list[7].rows[1].id]: '' },
    });
    expect(cleaned).toEqual({
      [list[1].id]: 'Amina',
      [list[3].id]: 42,
      [list[5].id]: ['A', 'C'],
      [list[7].id]: { [list[7].rows[0].id]: 'x' },
    });
  });
});
