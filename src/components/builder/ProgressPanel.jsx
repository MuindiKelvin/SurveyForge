import { useMemo } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { CHART_COLORS, INK, TRACK } from '../charts';
import { typeLabel } from '../../utils/questionTypes';

const TEAL = CHART_COLORS[0];
const AMBER = CHART_COLORS[1];

/** Live "survey creation progress" charts and checklist shown next to the builder. */
export default function ProgressPanel({ progress }) {
  const { percent, typeCounts, completeItems, incompleteItems } = progress;

  const ringData = useMemo(
    () => ({
      labels: ['Done', 'Remaining'],
      datasets: [{ data: [percent, 100 - percent], backgroundColor: [percent === 100 ? '#2f8f5b' : TEAL, TRACK], borderWidth: 0 }],
    }),
    [percent],
  );
  const ringOptions = useMemo(
    () => ({
      cutout: '76%',
      maintainAspectRatio: false,
      animation: { duration: 350 },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    }),
    [],
  );

  const typeKey = JSON.stringify(typeCounts);
  const typeData = useMemo(() => {
    const entries = Object.entries(typeCounts);
    return {
      labels: entries.map(([type]) => typeLabel(type)),
      datasets: [
        {
          label: 'Questions',
          data: entries.map(([, n]) => n),
          backgroundColor: entries.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
          borderRadius: 4,
          barThickness: 16,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeKey]);
  const typeBarHeight = Math.max(110, Object.keys(typeCounts).length * 30 + 44);
  const typeOptions = useMemo(
    () => ({
      indexAxis: 'y',
      maintainAspectRatio: false,
      animation: { duration: 350 },
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, color: INK }, grid: { color: TRACK } },
        y: { ticks: { color: INK }, grid: { display: false } },
      },
    }),
    [],
  );

  const statusData = useMemo(
    () => ({
      labels: ['Complete', 'Needs attention'],
      datasets: [{ data: [completeItems, incompleteItems], backgroundColor: [TEAL, AMBER], borderWidth: 0 }],
    }),
    [completeItems, incompleteItems],
  );
  const statusOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      animation: { duration: 350 },
      plugins: { legend: { position: 'bottom', labels: { color: INK, boxWidth: 12, usePointStyle: true } } },
    }),
    [],
  );

  const stats = [
    { label: 'Questions', value: progress.questionCount, icon: 'bi-question-circle' },
    { label: 'Sections', value: progress.sectionCount, icon: 'bi-type-h2' },
    { label: 'Required', value: progress.requiredCount, icon: 'bi-asterisk' },
    { label: 'Est. minutes', value: progress.estMinutes, icon: 'bi-clock' },
  ];

  return (
    <div className="d-grid gap-3">
      <div className="card">
        <div className="card-body">
          <h2 className="h6 mb-3">Creation progress</h2>
          <div className="d-flex align-items-center gap-3">
            <div className="sf-ring position-relative flex-shrink-0">
              <Doughnut data={ringData} options={ringOptions} role="img" aria-label={`Survey is ${percent} percent complete`} />
              <div className="sf-ring-label">
                <span className="sf-ring-value">{percent}%</span>
                <span className="small text-secondary">{percent === 100 ? 'ready' : 'complete'}</span>
              </div>
            </div>
            <ul className="list-unstyled mb-0 flex-grow-1 sf-stat-list">
              {stats.map((s) => (
                <li key={s.label} className="d-flex align-items-center justify-content-between gap-2 py-1">
                  <span className="small text-secondary">
                    <i className={`bi ${s.icon} me-2`} aria-hidden="true" />
                    {s.label}
                  </span>
                  <span className="fw-semibold">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="list-unstyled mt-3 mb-0 d-grid gap-2">
            {progress.checklist.map((c) => (
              <li key={c.key} className="d-flex align-items-start gap-2 small">
                <i
                  className={`bi ${c.done ? 'bi-check-circle-fill text-success' : 'bi-circle text-secondary'} mt-1`}
                  aria-hidden="true"
                />
                <span className={c.done ? '' : 'text-secondary'}>
                  {c.label}
                  <span className="visually-hidden">{c.done ? ' (done)' : ' (to do)'}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="h6 mb-3">Questions by type</h2>
          {Object.keys(typeCounts).length === 0 ? (
            <p className="text-secondary small mb-0">Add a question and the chart will appear here.</p>
          ) : (
            <div style={{ height: typeBarHeight }}>
              <Bar data={typeData} options={typeOptions} role="img" aria-label="Number of questions of each type" />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="h6 mb-3">Question status</h2>
          {progress.totalItems === 0 ? (
            <p className="text-secondary small mb-0">Nothing to check yet.</p>
          ) : (
            <div style={{ height: 190 }}>
              <Doughnut data={statusData} options={statusOptions} role="img" aria-label={`${completeItems} complete, ${incompleteItems} need attention`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
