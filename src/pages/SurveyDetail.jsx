import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Loader from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNow } from '../hooks/useNow';
import { createShare, listShares, revokeShare, shareUrl } from '../services/shareService';
import { countResponses, getSurvey } from '../services/surveyService';
import { copyText } from '../utils/clipboard';
import { formatDateTimeLong, formatTimeLeft, personName, plural } from '../utils/format';
import { computeProgress } from '../utils/surveyModel';

export default function SurveyDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const now = useNow(30000);
  const [survey, setSurvey] = useState(undefined); // undefined = loading, null = not found
  const [shares, setShares] = useState([]);
  const [responseCount, setResponseCount] = useState(null);
  const [creating, setCreating] = useState(false);
  const [busyShare, setBusyShare] = useState('');
  const [exporting, setExporting] = useState('');
  const [loadError, setLoadError] = useState('');

  const refreshShares = useCallback(async () => {
    setShares(await listShares(id));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getSurvey(id);
        if (cancelled) return;
        setSurvey(s);
        if (!s) return;
        const [list, count] = await Promise.all([
          listShares(id).catch(() => []),
          countResponses(id).catch(() => null),
        ]);
        if (cancelled) return;
        setShares(list);
        setResponseCount(count);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setLoadError('Could not load this survey. Check your connection and try again.');
          setSurvey(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createShare(survey, user.uid, personName(user));
      await refreshShares();
      toast.success('Link created. It works for the next 24 hours.');
    } catch (err) {
      console.error(err);
      toast.error('Could not create the link. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (shareId) => {
    const ok = await copyText(shareUrl(shareId));
    if (ok) toast.success('Link copied to the clipboard.');
    else toast.error('Could not copy automatically. Select the link and copy it manually.');
  };

  const handleRevoke = async (shareId) => {
    setBusyShare(shareId);
    try {
      await revokeShare(shareId);
      await refreshShares();
      toast.success('Link removed. It no longer works.');
    } catch (err) {
      console.error(err);
      toast.error('Could not remove the link.');
    } finally {
      setBusyShare('');
    }
  };

  const runExport = async (kind) => {
    setExporting(kind);
    try {
      if (kind === 'pdf') {
        const { exportSurveyPdf } = await import('../utils/exportSurveyPdf');
        exportSurveyPdf(survey);
      } else {
        const { exportSurveyDocx } = await import('../utils/exportSurveyDocx');
        await exportSurveyDocx(survey);
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not create the file. Please try again.');
    } finally {
      setExporting('');
    }
  };

  if (survey === undefined) return <Loader label="Loading survey..." />;
  if (survey === null) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 520 }}>
        <i className="bi bi-question-circle display-3 text-secondary" aria-hidden="true" />
        <h1 className="h4 mt-3">Survey not found</h1>
        <p className="text-secondary">{loadError || 'It may have been deleted.'}</p>
        <Link to="/" className="btn btn-primary">
          Back to surveys
        </Link>
      </div>
    );
  }

  const progress = computeProgress(survey);
  const isComplete = survey.status === 'complete';
  const activeShares = shares.filter((s) => s.expiresAt > now);
  const expiredShares = shares.filter((s) => s.expiresAt <= now);

  return (
    <div className="container-xl py-4">
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item">
            <Link to="/">Surveys</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            {survey.title || 'Untitled survey'}
          </li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="h3 mb-1 text-break">{survey.title || 'Untitled survey'}</h1>
          <div className="d-flex flex-wrap align-items-center gap-2 text-secondary">
            <span className={`badge ${isComplete ? 'text-bg-success' : 'text-bg-secondary'}`}>{isComplete ? 'Complete' : 'Draft'}</span>
            <span>{plural(progress.questionCount, 'question')}</span>
            <span>&middot; about {progress.estMinutes} min</span>
          </div>
          <div className="small text-secondary mt-1">
            <i className="bi bi-person me-1" aria-hidden="true" />
            Created by {survey.ownerId === user.uid ? 'you' : survey.ownerName || 'a teammate'}
            {survey.updatedByName && survey.updatedByName !== survey.ownerName ? ` \u00B7 last edited by ${survey.updatedByName}` : ''}
            {survey.updatedAt ? ` \u00B7 ${formatDateTimeLong(survey.updatedAt)}` : ''}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to={`/surveys/${id}/edit`} className="btn btn-outline-secondary">
            <i className="bi bi-pencil me-2" aria-hidden="true" />
            Edit survey
          </Link>
          <Link to={`/surveys/${id}/results`} className="btn btn-primary">
            <i className="bi bi-bar-chart me-2" aria-hidden="true" />
            View results{responseCount ? ` (${responseCount})` : ''}
          </Link>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <h2 className="h5 mb-0">
                  <i className="bi bi-link-45deg me-2 text-primary" aria-hidden="true" />
                  Share links
                </h2>
                <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={!isComplete || creating}>
                  {creating ? <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" /> : <i className="bi bi-plus-lg me-2" aria-hidden="true" />}
                  Create 24-hour link
                </button>
              </div>

              {!isComplete && (
                <div className="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2" role="status">
                  <span>
                    <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
                    This survey is still a draft. Mark it complete in the editor to unlock sharing.
                  </span>
                  <Link to={`/surveys/${id}/edit`} className="btn btn-sm btn-warning">
                    Finish survey
                  </Link>
                </div>
              )}

              <p className="text-secondary small">
                Each link opens the survey exactly as it is now and stops working automatically 24 hours after you create it. Anyone with the link can answer without an account. You can remove a link
                at any time.
              </p>

              {activeShares.length === 0 && isComplete && <p className="text-secondary mb-0">No active links yet. Create one to start collecting responses.</p>}

              <ul className="list-unstyled d-grid gap-3 mb-0">
                {activeShares.map((s) => {
                  const url = shareUrl(s.id);
                  return (
                    <li key={s.id} className="sf-share-row">
                      <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                        <span className="badge text-bg-success">
                          <i className="bi bi-clock me-1" aria-hidden="true" />
                          {formatTimeLeft(s.expiresAt, Math.max(now, s.createdAt))}
                        </span>
                        <span className="small text-secondary">
                          {s.createdByName ? `Created by ${s.createdByName} \u00B7 ` : ''}Expires {formatDateTimeLong(s.expiresAt)}
                        </span>
                      </div>
                      <div className="input-group">
                        <input type="text" readOnly className="form-control" value={url} aria-label="Survey link" onFocus={(e) => e.target.select()} />
                        <button type="button" className="btn btn-outline-primary" onClick={() => handleCopy(s.id)}>
                          <i className="bi bi-clipboard me-1" aria-hidden="true" />
                          Copy
                        </button>
                      </div>
                      <div className="d-flex flex-wrap gap-2 mt-2">
                        <a className="btn btn-sm btn-outline-secondary" href={url} target="_blank" rel="noopener noreferrer">
                          <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
                          Open
                        </a>
                        <a
                          className="btn btn-sm btn-outline-secondary"
                          href={`https://wa.me/?text=${encodeURIComponent(`${survey.title}: ${url}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <i className="bi bi-whatsapp me-1" aria-hidden="true" />
                          WhatsApp
                        </a>
                        <a
                          className="btn btn-sm btn-outline-secondary"
                          href={`mailto:?subject=${encodeURIComponent(survey.title)}&body=${encodeURIComponent(`Please take a moment to complete this survey (the link is valid for 24 hours):\n\n${url}`)}`}
                        >
                          <i className="bi bi-envelope me-1" aria-hidden="true" />
                          Email
                        </a>
                        <button type="button" className="btn btn-sm btn-outline-danger ms-auto" onClick={() => handleRevoke(s.id)} disabled={busyShare === s.id}>
                          {busyShare === s.id ? <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" /> : <i className="bi bi-x-circle me-1" aria-hidden="true" />}
                          Remove link
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {expiredShares.length > 0 && (
                <div className="mt-4">
                  <h3 className="h6 text-secondary">Expired links</h3>
                  <ul className="list-group list-group-flush">
                    {expiredShares.map((s) => (
                      <li key={s.id} className="list-group-item d-flex align-items-center justify-content-between gap-2 px-0 text-secondary">
                        <span className="small">
                          <span className="badge text-bg-secondary me-2">Expired</span>
                          Created {formatDateTimeLong(s.createdAt)}
                          {s.createdByName ? ` by ${s.createdByName}` : ''}
                        </span>
                        <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => handleRevoke(s.id)} disabled={busyShare === s.id}>
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card mb-4">
            <div className="card-body">
              <h2 className="h6 mb-3">
                <i className="bi bi-download me-2 text-primary" aria-hidden="true" />
                Download the survey
              </h2>
              <p className="small text-secondary">Get a printable copy with every question and choice.</p>
              <div className="d-grid gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={() => runExport('pdf')} disabled={Boolean(exporting)}>
                  {exporting === 'pdf' ? <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" /> : <i className="bi bi-file-earmark-pdf me-2" aria-hidden="true" />}
                  PDF document
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => runExport('docx')} disabled={Boolean(exporting)}>
                  {exporting === 'docx' ? <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" /> : <i className="bi bi-file-earmark-word me-2" aria-hidden="true" />}
                  Word document
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 className="h6 mb-3">
                <i className="bi bi-inbox me-2 text-primary" aria-hidden="true" />
                Responses
              </h2>
              <div className="display-6 fw-semibold lh-1">{responseCount === null ? '\u2014' : responseCount}</div>
              <p className="small text-secondary mt-2">Total answers received through all of this survey&rsquo;s links.</p>
              <Link to={`/surveys/${id}/results`} className="btn btn-outline-primary w-100">
                <i className="bi bi-file-earmark-spreadsheet me-2" aria-hidden="true" />
                Open results &amp; downloads
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
