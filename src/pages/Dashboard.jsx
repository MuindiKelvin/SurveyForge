import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { CHART_COLORS, INK, TRACK } from '../components/charts';
import ConfirmModal from '../components/ConfirmModal';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { countResponses, deleteSurveyCascade, duplicateSurvey, listSurveys } from '../services/surveyService';
import { TEMPLATES } from '../templates/ownerDiagnostic';
import { formatDate, personName, plural } from '../utils/format';
import { computeProgress } from '../utils/surveyModel';

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState(null);
  const [counts, setCounts] = useState({});
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('all'); // 'all' = the whole team's surveys, 'mine' = the ones I created
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const list = await listSurveys();
      setSurveys(list);
      const entries = await Promise.all(
        list.map(async (s) => {
          try {
            return [s.id, await countResponses(s.id)];
          } catch (err) {
            return [s.id, null];
          }
        }),
      );
      setCounts(Object.fromEntries(entries));
    } catch (err) {
      console.error(err);
      setSurveys([]);
      setLoadError('We could not load the surveys. Check your connection and that the Firestore rules are deployed.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enriched = useMemo(() => (surveys || []).map((s) => ({ ...s, progress: computeProgress(s) })), [surveys]);
  const mineCount = enriched.filter((s) => s.ownerId === user.uid).length;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((s) => scope === 'all' || s.ownerId === user.uid)
      .filter((s) => !q || s.title.toLowerCase().includes(q) || (s.ownerName || '').toLowerCase().includes(q));
  }, [enriched, search, scope, user.uid]);

  const completeCount = enriched.filter((s) => s.status === 'complete').length;
  const draftCount = enriched.length - completeCount;
  const totalResponses = Object.values(counts).reduce((a, n) => a + (n || 0), 0);

  const statusData = useMemo(
    () => ({
      labels: ['Complete', 'Draft'],
      datasets: [{ data: [completeCount, draftCount], backgroundColor: [CHART_COLORS[0], CHART_COLORS[1]], borderWidth: 0 }],
    }),
    [completeCount, draftCount],
  );
  const statusOptions = useMemo(
    () => ({ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: INK, boxWidth: 12, usePointStyle: true } } } }),
    [],
  );

  const topSurveys = useMemo(
    () =>
      enriched
        .map((s) => ({ title: s.title || 'Untitled', n: counts[s.id] || 0 }))
        .filter((s) => s.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 8),
    [enriched, counts],
  );
  const responsesData = useMemo(
    () => ({
      labels: topSurveys.map((s) => (s.title.length > 26 ? `${s.title.slice(0, 25)}\u2026` : s.title)),
      datasets: [{ label: 'Responses', data: topSurveys.map((s) => s.n), backgroundColor: CHART_COLORS[0], borderRadius: 4, maxBarThickness: 28 }],
    }),
    [topSurveys],
  );
  const responsesOptions = useMemo(
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

  const handleDuplicate = async (survey) => {
    setDuplicatingId(survey.id);
    try {
      const newId = await duplicateSurvey(user.uid, survey, personName(user));
      toast.success('Survey duplicated as a draft.');
      navigate(`/surveys/${newId}/edit`);
    } catch (err) {
      console.error(err);
      toast.error('Could not duplicate the survey.');
    } finally {
      setDuplicatingId('');
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteSurveyCascade(toDelete.id);
      setSurveys((list) => list.filter((s) => s.id !== toDelete.id));
      toast.success('Survey deleted.');
      setToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Could not delete the survey. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (surveys === null) return <Loader label="Loading surveys..." />;

  return (
    <div className="container-xl py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Surveys</h1>
          <p className="text-secondary mb-0">Everyone on the team can see, edit and share these surveys and view their results.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={() => setTemplatesOpen(true)}>
            <i className="bi bi-files me-2" aria-hidden="true" />
            Start from a template
          </button>
          <Link to="/surveys/new" className="btn btn-primary">
            <i className="bi bi-plus-lg me-2" aria-hidden="true" />
            New survey
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between gap-3" role="alert">
          <span>{loadError}</span>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {enriched.length === 0 && !loadError ? (
        <div className="card text-center">
          <div className="card-body py-5">
            <i className="bi bi-clipboard2-plus display-4 text-primary" aria-hidden="true" />
            <h2 className="h5 mt-3">Create your first survey</h2>
            <p className="text-secondary mx-auto" style={{ maxWidth: 420 }}>
              Start from a blank page or load the ready-made owner diagnostic survey and edit it to fit.
            </p>
            <div className="d-flex flex-wrap justify-content-center gap-2">
              <Link to="/surveys/new" className="btn btn-primary">
                <i className="bi bi-plus-lg me-2" aria-hidden="true" />
                Blank survey
              </Link>
              <Link to="/surveys/new?template=owner-diagnostic" className="btn btn-outline-primary">
                <i className="bi bi-files me-2" aria-hidden="true" />
                Use the diagnostic template
              </Link>
            </div>
          </div>
        </div>
      ) : (
        enriched.length > 0 && (
          <>
            <div className="row g-3 mb-4">
              <div className="col-12 col-lg-4">
                <div className="row g-3">
                  {[
                    ['Surveys', enriched.length, 'bi-clipboard-data'],
                    ['Complete', completeCount, 'bi-check2-circle'],
                    ['Responses', totalResponses, 'bi-chat-square-text'],
                  ].map(([label, value, icon]) => (
                    <div className="col-4 col-lg-12" key={label}>
                      <div className="card h-100">
                        <div className="card-body d-flex align-items-center gap-3 py-3">
                          <i className={`bi ${icon} fs-3 text-primary d-none d-sm-inline`} aria-hidden="true" />
                          <div>
                            <div className="fs-4 fw-semibold lh-1">{value}</div>
                            <div className="small text-secondary">{label}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-12 col-md-5 col-lg-3">
                <div className="card h-100">
                  <div className="card-body">
                    <h2 className="h6 mb-3">Surveys by status</h2>
                    <div style={{ height: 190 }}>
                      <Doughnut data={statusData} options={statusOptions} role="img" aria-label={`${completeCount} complete and ${draftCount} draft surveys`} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-7 col-lg-5">
                <div className="card h-100">
                  <div className="card-body">
                    <h2 className="h6 mb-3">Responses per survey</h2>
                    {topSurveys.length === 0 ? (
                      <p className="text-secondary small mb-0">Responses will appear here once people start answering shared links.</p>
                    ) : (
                      <div style={{ height: Math.max(150, topSurveys.length * 30 + 40) }}>
                        <Bar data={responsesData} options={responsesOptions} role="img" aria-label="Responses received by each survey" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <div className="input-group flex-grow-1" style={{ maxWidth: 420 }}>
                <span className="input-group-text">
                  <i className="bi bi-search" aria-hidden="true" />
                </span>
                <input type="search" className="form-control" placeholder="Search by title or creator" aria-label="Search surveys" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="btn-group" role="group" aria-label="Which surveys to show">
                <button type="button" className={`btn ${scope === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
                  All surveys ({enriched.length})
                </button>
                <button type="button" className={`btn ${scope === 'mine' ? 'btn-primary' : 'btn-outline-secondary'}`} aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>
                  Created by me ({mineCount})
                </button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="text-secondary">
                {search.trim() ? <>No surveys match &ldquo;{search}&rdquo;.</> : 'You have not created any surveys yet. Switch to “All surveys” to see the team’s work.'}
              </p>
            ) : (
              <div className="row g-3">
                {filtered.map((s) => {
                  const isComplete = s.status === 'complete';
                  const n = counts[s.id];
                  const isOwner = s.ownerId === user.uid;
                  const creator = isOwner ? 'you' : s.ownerName || 'a teammate';
                  const editor = s.updatedByName && s.updatedByName !== s.ownerName ? s.updatedByName : '';
                  return (
                    <div className="col-12 col-md-6 col-xl-4" key={s.id}>
                      <div className="card h-100 sf-survey-card">
                        <div className="card-body d-flex flex-column">
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <h2 className="h6 mb-0 text-break">{s.title || 'Untitled survey'}</h2>
                            <span className={`badge ${isComplete ? 'text-bg-success' : 'text-bg-secondary'}`}>{isComplete ? 'Complete' : 'Draft'}</span>
                          </div>
                          <p className="small text-secondary mb-2 sf-clamp-2">{s.description || 'No description'}</p>
                          <div className="small text-secondary mb-3">
                            {plural(s.progress.questionCount, 'question')} &middot; {n === null || n === undefined ? '\u2014' : plural(n, 'response')}
                            {s.updatedAt ? ` \u00B7 updated ${formatDate(s.updatedAt)}` : ''}
                          </div>
                          <div className="small text-secondary mb-2 text-break">
                            <i className="bi bi-person me-1" aria-hidden="true" />
                            Created by {creator}
                            {editor ? ` \u00B7 last edited by ${editor}` : ''}
                          </div>
                          <div className="d-flex align-items-center gap-2 mb-3">
                            <div className="progress flex-grow-1" style={{ height: 6 }} role="progressbar" aria-label="Survey completion" aria-valuenow={s.progress.percent} aria-valuemin={0} aria-valuemax={100}>
                              <div className="progress-bar" style={{ width: `${s.progress.percent}%` }} />
                            </div>
                            <span className="small text-secondary">{s.progress.percent}%</span>
                          </div>
                          <div className="mt-auto d-flex flex-wrap gap-2">
                            {isComplete ? (
                              <Link to={`/surveys/${s.id}`} className="btn btn-sm btn-primary">
                                <i className="bi bi-share me-1" aria-hidden="true" />
                                Share
                              </Link>
                            ) : (
                              <Link to={`/surveys/${s.id}/edit`} className="btn btn-sm btn-primary">
                                <i className="bi bi-pencil me-1" aria-hidden="true" />
                                Continue
                              </Link>
                            )}
                            {isComplete && (
                              <Link to={`/surveys/${s.id}/edit`} className="btn btn-sm btn-outline-secondary">
                                <i className="bi bi-pencil me-1" aria-hidden="true" />
                                Edit
                              </Link>
                            )}
                            <Link to={`/surveys/${s.id}/results`} className="btn btn-sm btn-outline-secondary">
                              <i className="bi bi-bar-chart me-1" aria-hidden="true" />
                              Results
                            </Link>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleDuplicate(s)} disabled={duplicatingId === s.id} aria-label={`Duplicate ${s.title}`} title="Duplicate">
                              {duplicatingId === s.id ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <i className="bi bi-copy" aria-hidden="true" />}
                            </button>
                            {isOwner && (
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setToDelete(s)} aria-label={`Delete ${s.title}`} title="Delete (only the creator can delete a survey)">
                                <i className="bi bi-trash" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )
      )}

      <ConfirmModal
        show={Boolean(toDelete)}
        title="Delete this survey?"
        message={toDelete ? `"${toDelete.title || 'Untitled survey'}" will be permanently deleted together with its share links and ${counts[toDelete.id] || 0} response(s). This cannot be undone.` : ''}
        confirmLabel="Delete survey"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />

      <Modal show={templatesOpen} title="Start from a template" size="md" onClose={() => setTemplatesOpen(false)}>
        <div className="list-group">
          {Object.values(TEMPLATES).map((t) => (
            <Link key={t.id} to={`/surveys/new?template=${t.id}`} className="list-group-item list-group-item-action" onClick={() => setTemplatesOpen(false)}>
              <div className="fw-semibold">{t.name}</div>
              <div className="small text-secondary">{t.description}</div>
            </Link>
          ))}
        </div>
      </Modal>
    </div>
  );
}
