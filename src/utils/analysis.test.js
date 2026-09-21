import { describe, expect, it } from 'vitest';
import { buildResponseTable, computeStats, pct, responsesPerDay } from './analysis';
import { makeQuestion } from './surveyModel';

const survey = () => {
  const questions = [
    makeQuestion({ type: 'multiple_choice', text: 'Colour', options: ['Red', 'Blue', 'Green'] }),
    makeQuestion({ type: 'checkboxes', text: 'Fruit', options: ['Apple', 'Pear'] }),
    makeQuestion({ type: 'rating', text: 'Rate', scaleMax: 5 }),
    makeQuestion({ type: 'number', text: 'Age' }),
    makeQuestion({ type: 'long_text', text: 'Comment' }),
    makeQuestion({ type: 'matrix', text: 'Grid', rows: ['r1', 'r2'], options: ['x', 'y'] }),
    makeQuestion({ type: 'yes_no', text: 'Ok?' }),
  ];
  return { title: 'T', description: 'D', questions };
};

const responses = (s) => {
  const [c, f, r, a, t, m, y] = s.questions;
  return [
    { id: '1', submittedAt: 3000, answers: { [c.id]: 'Red', [f.id]: ['Apple', 'Pear'], [r.id]: 5, [a.id]: 30, [t.id]: 'Great', [m.id]: { [m.rows[0].id]: 'x', [m.rows[1].id]: 'y' }, [y.id]: 'Yes' } },
    { id: '2', submittedAt: 1000, answers: { [c.id]: 'Red', [f.id]: ['Apple'], [r.id]: 3, [a.id]: 20, [m.id]: { [m.rows[0].id]: 'x' } } },
    { id: '3', submittedAt: 2000, answers: { [c.id]: 'Blue' } },
  ];
};

describe('computeStats', () => {
  const s = survey();
  const stats = computeStats(s, responses(s));

  it('counts single-choice answers', () => {
    expect(stats[0].labels).toEqual(['Red', 'Blue', 'Green']);
    expect(stats[0].counts).toEqual([2, 1, 0]);
    expect(stats[0].answered).toBe(3);
  });
  it('counts multi-choice answers per selection', () => {
    expect(stats[1].counts).toEqual([2, 1]);
    expect(stats[1].answered).toBe(2);
  });
  it('averages ratings', () => {
    expect(stats[2].counts).toEqual([0, 0, 1, 0, 1]);
    expect(stats[2].average).toBe(4);
  });
  it('summarises numbers', () => {
    expect(stats[3]).toMatchObject({ average: 25, min: 20, max: 30, median: 25, sum: 50, answered: 2 });
  });
  it('collects text answers', () => {
    expect(stats[4].entries.map((e) => e.text)).toEqual(['Great']);
  });
  it('counts grid answers per row', () => {
    expect(stats[5].rows[0].counts).toEqual([2, 0]);
    expect(stats[5].rows[1].counts).toEqual([0, 1]);
    expect(stats[5].answered).toBe(2);
  });
  it('counts yes/no', () => {
    expect(stats[6].counts).toEqual([1, 0]);
  });
});

describe('buildResponseTable', () => {
  it('builds ordered rows with one column per grid row', () => {
    const s = survey();
    const t = buildResponseTable(s, responses(s));
    expect(t.headers).toHaveLength(2 + 1 + 1 + 1 + 1 + 1 + 2 + 1);
    expect(t.rows).toHaveLength(3);
    expect(t.rows.map((r) => r[0])).toEqual([1, 2, 3]);
    expect(t.rows[2][2]).toBe('Red'); // newest response is last and was submitted at 3000
    expect(t.rows[2][3]).toBe('Apple; Pear');
    expect(t.rows[2][4]).toBe(5);
  });
});

describe('helpers', () => {
  it('pct handles zero totals', () => {
    expect(pct(1, 0)).toBe(0);
    expect(pct(1, 3)).toBe(33.3);
  });
  it('groups responses per day', () => {
    const d = new Date(2026, 0, 5, 10).getTime();
    expect(responsesPerDay([{ submittedAt: d }, { submittedAt: d + 1000 }, { submittedAt: d + 86400000 }])).toEqual([
      { day: '2026-01-05', count: 2 },
      { day: '2026-01-06', count: 1 },
    ]);
  });
});
