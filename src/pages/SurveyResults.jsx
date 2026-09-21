import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { CHART_COLORS, INK, TRACK } from '../components/charts';
import DownloadMenu from '../components/DownloadMenu';
import Loader from '../components/Loader';
import QuestionResultCard from '../components/results/QuestionResultCard';
import { useToast } from '../context/ToastContext';
import { listResponses, MAX_RESPONSES_LOADED } from '../services/responseService';
import { getSurvey } from '../services/surveyService';
import { buildResponseTable, computeStats, pct, responsesPerDay } from '../utils/analysis';
import { formatDateTime, plural } from '../utils/format';

const TABLE_ROW_LIMIT = 100;

export default function SurveyResults() {
  const { id } = useParams();
  const toast = useToast();
  const [survey, setSurvey] = useState(undefined); // undefined = loading, null = not found
  const [responses, setResponses] = useState([]);
  const [tab, setTab] = useState('summary');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const s = await getSurvey(id);
      setSurvey(s);
      if (s) setResponses(await listResponses(id));
    } catch (err) {
      console.error(err);
      setError('Could not load the results. Check your connection and try again.');
      setSurvey((prev) => (prev === undefined ? null : prev));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const stats = useMemo(() => (survey ? computeStats(survey, responses) : []), [survey, responses]);
  const perDay = useMemo(() => responsesPerDay(responses), [responses]);
  const table = useMemo(() => (survey ? buildResponseTable(survey, responses) : { headers: [], rows: [] }), [survey, responses]);

  const answerRate = useMemo(() => {
    if (!stats.length || !responses.length) return 0;
    const answered = stats.reduce((sum, s) => sum + s.answered, 0);
    return pct(answered, stats.length * responses.length);
  }, [stats, responses]);

  const dayData = useMemo(
    () => ({
      labels: perDay.map((d) => d.day),
      datasets: [{ label: 'Responses', data: perDay.map((d) => d.count), backgroundColor: CHART_COLORS[0], borderRadius: 4, maxBarThickness: 44 }],
    }),
    [perDay],
  );
  const dayOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, color: INK }, grid: { color: TRACK } },
        x: { ticks: { color: INK, maxRotation: 0, autoSkip: true }, grid: { display: false } },
      },
    }),
    [],
  );

  const runExport = async (kind) => {
    setExporting(kind);
    try {
      if (kind === 'xlsx') {
        const { exportResultsExcel } = await import('../utils/exportResultsExcel');
        exportResultsExcel(survey, responses);
      } else {
        const { exportResultsPdf } = await import('../utils/exportResultsPdf');
        exportResultsPdf(survey, responses);
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not create the file. Please try again.');
    } finally {
      setExporting('');
    }
  };

  if (survey === undefined) return <Loader label="Loading results..." />;
  if (survey === null) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 520 }}>
        <i className="bi bi-question-circle display-3 text-secondary" aria-hidden="true" />
        <h1 className="h4 mt-3">Survey not found</h1>
        <p className="text-secondary">{error || 'It may have been deleted.'}</p>
        <Link to="/" className="btn btn-primary">
          Back to surveys
        </Link>
      </div>
    );
  }

  const first = responses.length ? responses[responses.length - 1].submittedAt : null;
  const last = responses.length ? responses[0].submittedAt : null;
  const shownRows = table.rows.slice(-TABLE_ROW_LIMIT).reverse();

  return (
    <div className="container-xl py-4">
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item">
            <Link to="/">Surveys</Link>
          </li>
          <li className="breadcrumb-item">
            <Link to={`/surveys/${id}`}>{survey.title || 'Untitled survey'}</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Results
          </li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="h3 mb-1 text-break">Results</h1>
          <p className="text-secondary mb-0 text-break">{survey.title}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={refresh} disabled={refreshing}>
            {refreshing ? <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" /> : <i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />}
            Refresh
          </button>
          <DownloadMenu
            label="Download results"
            buttonClass="btn btn-primary"
            hideLabelOnMobile={false}
            disabled={responses.length === 0}
            busyKey={exporting}
            items={[
              { key: 'xlsx', label: 'Excel workbook (.xlsx)', icon: 'bi-file-earmark-spreadsheet', onSelect: () => runExport('xlsx') },
              { key: 'pdf', label: 'PDF report (.pdf)', icon: 'bi-file-earmark-pdf', onSelect: () => runExport('pdf') },
            ]}
          />
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {responses.length >= MAX_RESPONSES_LOADED && (
        <div className="alert alert-warning" role="status">
          Showing the newest {MAX_RESPONSES_LOADED} responses only.
        </div>
      )}

      <div className="row g-3 mb-4">
        {[
          ['Responses', responses.length, 'bi-chat-square-text'],
          ['Answer rate', `${answerRate}%`, 'bi-check2-all'],
          ['First response', first ? formatDateTime(first) : '\u2014', 'bi-calendar-plus'],
          ['Latest response', last ? formatDateTime(last) : '\u2014', 'bi-calendar-check'],
        ].map(([label, value, icon]) => (
          <div className="col-6 col-lg-3" key={label}>
            <div className="card h-100">
              <div className="card-body d-flex align-items-center gap-3 py-3">
                <i className={`bi ${icon} fs-3 text-primary d-none d-sm-inline`} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="fw-semibold fs-5 lh-sm text-break">{value}</div>
                  <div className="small text-secondary">{label}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {responses.length === 0 ? (
        <div className="card text-center">
          <div className="card-body py-5">
            <i className="bi bi-inbox display-4 text-secondary" aria-hidden="true" />
            <h2 className="h5 mt-3">No responses yet</h2>
            <p className="text-secondary mb-3">Share a link and the answers will show up here.</p>
            <Link to={`/surveys/${id}`} className="btn btn-primary">
              <i className="bi bi-share me-2" aria-hidden="true" />
              Go to share links
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="nav nav-tabs mb-3" role="tablist">
            <li className="nav-item" role="presentation">
              <button type="button" role="tab" aria-selected={tab === 'summary'} className={`nav-link ${tab === 'summary' ? 'active' : ''}`} onClick={() => setTab('summary')}>
                <i className="bi bi-bar-chart me-1" aria-hidden="true" />
                Summary
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button type="button" role="tab" aria-selected={tab === 'responses'} className={`nav-link ${tab === 'responses' ? 'active' : ''}`} onClick={() => setTab('responses')}>
                <i className="bi bi-table me-1" aria-hidden="true" />
                Individual responses
              </button>
            </li>
          </ul>

          {tab === 'summary' && (
            <>
              <div className="card mb-3">
                <div className="card-body">
                  <h2 className="h6 mb-3">Responses per day</h2>
                  <div style={{ height: 200 }}>
                    <Bar data={dayData} options={dayOptions} role="img" aria-label="Number of responses received each day" />
                  </div>
                </div>
              </div>
              {stats.map((s) => (
                <QuestionResultCard key={s.question.id} stat={s} />
              ))}
            </>
          )}

          {tab === 'responses' && (
            <div className="card">
              <div className="card-body">
                <p className="small text-secondary">
                  Showing the latest {plural(shownRows.length, 'response')} of {responses.length}. Download the Excel workbook to get every response.
                </p>
                <div className="table-responsive sf-resp-table">
                  <table className="table table-sm table-striped align-middle mb-0">
                    <thead>
                      <tr>
                        {table.headers.map((h, i) => (
                          <th key={i} scope="col" className="text-nowrap" title={String(h)}>
                            {String(h).length > 40 ? `${String(h).slice(0, 39)}\u2026` : h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shownRows.map((row) => (
                        <tr key={row[0]}>
                          {row.map((cell, i) => (
                            <td key={i} className="text-nowrap" title={String(cell)} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cell === '' ? <span className="text-secondary">&mdash;</span> : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
