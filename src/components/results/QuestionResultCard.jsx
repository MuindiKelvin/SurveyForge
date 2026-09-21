import { useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { CHART_COLORS, INK, TRACK } from '../charts';
import { pct } from '../../utils/analysis';
import { typeIcon, typeLabel } from '../../utils/questionTypes';
import { formatDateTime } from '../../utils/format';

const TEXT_PREVIEW = 8;

function CountsTable({ labels, counts, answered }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm mb-0 align-middle">
        <thead>
          <tr>
            <th scope="col">Answer</th>
            <th scope="col" className="text-end">Count</th>
            <th scope="col" className="text-end">%</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={`${label}-${i}`}>
              <td className="text-break">{label}</td>
              <td className="text-end">{counts[i]}</td>
              <td className="text-end">{pct(counts[i], answered)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChoiceChart({ stat }) {
  const { labels, counts, answered, multi } = stat;
  const asDonut = !multi && labels.length <= 6;

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Responses',
          data: counts,
          backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
          borderWidth: asDonut ? 0 : undefined,
          borderRadius: asDonut ? undefined : 4,
        },
      ],
    }),
    [labels, counts, asDonut],
  );

  const donutOptions = useMemo(
    () => ({ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: INK, boxWidth: 12, usePointStyle: true } } } }),
    [],
  );
  const barOptions = useMemo(
    () => ({
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, color: INK }, grid: { color: TRACK } },
        y: { ticks: { color: INK }, grid: { display: false } },
      },
    }),
    [],
  );

  const height = asDonut ? 240 : Math.max(180, labels.length * 30 + 40);
  return (
    <div className="row g-3 align-items-center">
      <div className="col-lg-7">
        <div style={{ height }}>
          {asDonut ? (
            <Doughnut data={data} options={donutOptions} role="img" aria-label={`Answers to question ${stat.number}`} />
          ) : (
            <Bar data={data} options={barOptions} role="img" aria-label={`Answers to question ${stat.number}`} />
          )}
        </div>
      </div>
      <div className="col-lg-5">
        <CountsTable labels={labels} counts={counts} answered={answered} />
      </div>
    </div>
  );
}

function RatingChart({ stat }) {
  const data = useMemo(
    () => ({
      labels: stat.labels,
      datasets: [{ label: 'Responses', data: stat.counts, backgroundColor: CHART_COLORS[0], borderRadius: 4 }],
    }),
    [stat.labels, stat.counts],
  );
  const options = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, color: INK }, grid: { color: TRACK } },
        x: { ticks: { color: INK }, grid: { display: false } },
      },
    }),
    [],
  );
  return (
    <div className="row g-3 align-items-center">
      <div className="col-lg-8">
        <div style={{ height: 220 }}>
          <Bar data={data} options={options} role="img" aria-label={`Ratings for question ${stat.number}`} />
        </div>
      </div>
      <div className="col-lg-4 text-center">
        <div className="display-5 fw-semibold lh-1">{stat.average ?? '-'}</div>
        <div className="text-secondary">average rating out of {stat.labels.length}</div>
      </div>
    </div>
  );
}

function NumberStats({ stat }) {
  const tiles = [
    ['Average', stat.average],
    ['Minimum', stat.min],
    ['Maximum', stat.max],
    ['Median', stat.median],
    ['Sum', stat.sum],
  ];
  return (
    <div className="row g-2">
      {tiles.map(([label, v]) => (
        <div className="col-6 col-md-4 col-xl" key={label}>
          <div className="sf-stat">
            <div className="fw-semibold fs-5 lh-1">{v ?? '-'}</div>
            <div className="small text-secondary">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TextAnswers({ stat }) {
  const [all, setAll] = useState(false);
  const shown = all ? stat.entries : stat.entries.slice(0, TEXT_PREVIEW);
  return (
    <div>
      <ul className="list-group list-group-flush">
        {shown.map((e, i) => (
          <li className="list-group-item px-0" key={`${i}-${e.at}`}>
            <div style={{ whiteSpace: 'pre-wrap' }} className="text-break">
              {e.text}
            </div>
            {e.at ? <div className="small text-secondary">{formatDateTime(e.at)}</div> : null}
          </li>
        ))}
      </ul>
      {stat.entries.length > TEXT_PREVIEW && (
        <button type="button" className="btn btn-link btn-sm px-0" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${stat.entries.length} answers`}
        </button>
      )}
    </div>
  );
}

function MatrixTable({ stat }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th scope="col" />
            {stat.columns.map((c) => (
              <th scope="col" key={c} className="text-center small">
                {c}
              </th>
            ))}
            <th scope="col" className="text-end small">
              Answered
            </th>
          </tr>
        </thead>
        <tbody>
          {stat.rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className="fw-normal">
                {r.label}
              </th>
              {r.counts.map((c, i) => (
                <td key={i} className="text-center" style={{ background: `rgba(14, 107, 104, ${(r.answered ? c / r.answered : 0) * 0.5})` }}>
                  {c}
                  <span className="d-block small text-secondary">{pct(c, r.answered)}%</span>
                </td>
              ))}
              <td className="text-end">{r.answered}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function QuestionResultCard({ stat }) {
  const { question: q } = stat;
  let body;
  if (stat.answered === 0) body = <p className="text-secondary mb-0">No answers yet.</p>;
  else if (stat.kind === 'choice') body = <ChoiceChart stat={stat} />;
  else if (stat.kind === 'rating') body = <RatingChart stat={stat} />;
  else if (stat.kind === 'number') body = <NumberStats stat={stat} />;
  else if (stat.kind === 'matrix') body = <MatrixTable stat={stat} />;
  else body = <TextAnswers stat={stat} />;

  return (
    <div className="card mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h3 className="h6 mb-1" style={{ whiteSpace: 'pre-line' }}>
              <span className="text-secondary me-1">{stat.number}.</span>
              {q.text}
            </h3>
            <div className="small text-secondary">
              <i className={`bi ${typeIcon(q.type)} me-1`} aria-hidden="true" />
              {typeLabel(q.type)}
            </div>
          </div>
          <span className="badge text-bg-light border flex-shrink-0">
            {stat.answered} of {stat.total} answered
          </span>
        </div>
        {body}
      </div>
    </div>
  );
}
