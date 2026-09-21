import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AddQuestionPanel from '../components/builder/AddQuestionPanel';
import ProgressPanel from '../components/builder/ProgressPanel';
import QuestionEditor from '../components/builder/QuestionEditor';
import ConfirmModal from '../components/ConfirmModal';
import DownloadMenu from '../components/DownloadMenu';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import SurveyForm from '../components/survey/SurveyForm';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { createSurvey, getSurvey, updateSurvey } from '../services/surveyService';
import { TEMPLATES } from '../templates/ownerDiagnostic';
import { formatDateTimeLong, personName } from '../utils/format';
import {
  computeProgress,
  createQuestion,
  duplicateQuestion,
  getQuestionNumbers,
  normalizeSurveyForSave,
} from '../utils/surveyModel';

const AUTO_OPEN_LIMIT = 8; // surveys with more questions than this start collapsed

function initialSurvey(id, templateKey) {
  if (id) return null; // loaded from Firestore
  const template = TEMPLATES[templateKey];
  if (template) return { ...template.build(), status: 'draft' };
  return { title: '', description: '', status: 'draft', questions: [] };
}

function PreviewModal({ survey, onClose }) {
  const [answers, setAnswers] = useState({});
  const onAnswer = useCallback((qid, value) => setAnswers((a) => ({ ...a, [qid]: value })), []);
  const questions = survey.questions;
  return (
    <Modal
      show
      title="Preview"
      size="lg"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
          Close preview
        </button>
      }
    >
      <div className="alert alert-info py-2 small">
        <i className="bi bi-eye me-2" aria-hidden="true" />
        This is how respondents will see the survey. Nothing you type here is saved.
      </div>
      <h3 className="h4 text-break">{survey.title || 'Untitled survey'}</h3>
      {survey.description ? (
        <p className="text-secondary" style={{ whiteSpace: 'pre-line' }}>
          {survey.description}
        </p>
      ) : null}
      {questions.length === 0 ? <p className="text-secondary">No questions yet.</p> : <SurveyForm questions={questions} answers={answers} onAnswer={onAnswer} />}
    </Modal>
  );
}

export default function SurveyBuilder() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const templateKey = search.get('template');
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState(() => initialSurvey(id, templateKey));
  const [loading, setLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(false);
  const [openIds, setOpenIds] = useState({});
  const [dirty, setDirty] = useState(() => Boolean(!id && TEMPLATES[templateKey]));
  const [saving, setSaving] = useState('');
  const [exporting, setExporting] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [authorInfo, setAuthorInfo] = useState(null); // who created / last saved this (shared) survey
  const [conflict, setConflict] = useState(null); // set when a teammate saved after this page was opened

  const dirtyRef = useRef(dirty);
  // updatedAt of the version this page is based on. Used to notice when a teammate saved in the meantime.
  const baselineRef = useRef(null);
  const surveyRef = useRef(survey);
  const pendingScrollRef = useRef(null);
  surveyRef.current = survey;

  const touch = useCallback(() => {
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  // ---- load an existing survey -------------------------------------------------
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const s = await getSurvey(id);
        if (cancelled) return;
        if (!s) {
          setNotFound(true);
        } else {
          baselineRef.current = s.updatedAt || null;
          setAuthorInfo({ ownerId: s.ownerId, ownerName: s.ownerName, updatedByName: s.updatedByName, updatedAt: s.updatedAt });
          setSurvey({ title: s.title, description: s.description, status: s.status, questions: s.questions });
          if (s.questions.length <= AUTO_OPEN_LIMIT) setOpenIds(Object.fromEntries(s.questions.map((q) => [q.id, true])));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setNotFound(true);
          toast.error('Could not load the survey.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---- warn before losing unsaved work ------------------------------------------
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const blocker = useBlocker(
    useCallback(({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname, []),
  );

  // ---- scroll to a newly added question -----------------------------------------
  const questionCount = survey ? survey.questions.length : 0;
  useEffect(() => {
    const qid = pendingScrollRef.current;
    if (!qid) return;
    pendingScrollRef.current = null;
    const el = document.getElementById(`qcard-${qid}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const field = el.querySelector('textarea');
      if (field) field.focus({ preventScroll: true });
    }
  }, [questionCount]);

  // ---- editing handlers ----------------------------------------------------------
  const updateMeta = (field, value) => {
    setSurvey((s) => ({ ...s, [field]: value }));
    touch();
  };

  const onQuestionChange = useCallback(
    (qid, next) => {
      setSurvey((s) => ({ ...s, questions: s.questions.map((q) => (q.id === qid ? next : q)) }));
      touch();
    },
    [touch],
  );

  const onMove = useCallback(
    (qid, dir) => {
      setSurvey((s) => {
        const i = s.questions.findIndex((q) => q.id === qid);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= s.questions.length) return s;
        const questions = [...s.questions];
        [questions[i], questions[j]] = [questions[j], questions[i]];
        return { ...s, questions };
      });
      touch();
    },
    [touch],
  );

  const onDuplicate = useCallback(
    (qid) => {
      const source = surveyRef.current.questions.find((q) => q.id === qid);
      if (!source) return;
      const copy = duplicateQuestion(source);
      setSurvey((s) => ({ ...s, questions: s.questions.flatMap((q) => (q.id === qid ? [q, copy] : [q])) }));
      setOpenIds((o) => ({ ...o, [copy.id]: true }));
      pendingScrollRef.current = copy.id;
      touch();
    },
    [touch],
  );

  const onDelete = useCallback((qid) => {
    const q = surveyRef.current.questions.find((x) => x.id === qid);
    if (q) setDeleteTarget(q);
  }, []);

  const confirmDelete = () => {
    const qid = deleteTarget.id;
    setSurvey((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== qid) }));
    setDeleteTarget(null);
    touch();
  };

  const onToggle = useCallback((qid) => setOpenIds((o) => ({ ...o, [qid]: !o[qid] })), []);

  const addQuestion = useCallback(
    (type) => {
      const q = createQuestion(type);
      setSurvey((s) => ({ ...s, questions: [...s.questions, q] }));
      setOpenIds((o) => ({ ...o, [q.id]: true }));
      pendingScrollRef.current = q.id;
      touch();
    },
    [touch],
  );

  const setAllOpen = (open) => {
    setOpenIds(open ? Object.fromEntries(survey.questions.map((q) => [q.id, true])) : {});
  };

  // ---- derived data --------------------------------------------------------------
  const progress = useMemo(() => (survey ? computeProgress(survey) : null), [survey]);
  const numbers = useMemo(() => (survey ? getQuestionNumbers(survey.questions) : {}), [survey]);

  // ---- saving --------------------------------------------------------------------
  /** Returns the newer version when a teammate has saved this survey since this page loaded it, else null. */
  const findNewerVersion = async () => {
    const base = baselineRef.current;
    if (!id || !base) return null;
    try {
      const latest = await getSurvey(id);
      if (latest && latest.updatedAt && latest.updatedAt > base) return latest;
    } catch (err) {
      console.error(err); // if the check itself fails, let the save below report any real problem
    }
    return null;
  };

  const persist = async (status, { force = false } = {}) => {
    if (saving) return;
    const payload = normalizeSurveyForSave(survey);
    if (!payload.title) {
      toast.error('Give your survey a title before saving.');
      const input = document.getElementById('survey-title');
      if (input) input.focus();
      return;
    }
    if (status === 'complete' && !progress.canComplete) {
      toast.error('Finish the checklist on the right before marking the survey complete.');
      return;
    }

    setSaving(status);
    try {
      if (id) {
        if (!force) {
          const newer = await findNewerVersion();
          if (newer) {
            setConflict({ status, by: newer.updatedByName, at: newer.updatedAt });
            return; // the confirmation dialog lets the person decide
          }
        }
        await updateSurvey(id, { ...payload, status, updatedByName: personName(user) });
        try {
          const fresh = await getSurvey(id);
          baselineRef.current = fresh ? fresh.updatedAt || null : null;
          if (fresh) setAuthorInfo({ ownerId: fresh.ownerId, ownerName: fresh.ownerName, updatedByName: fresh.updatedByName, updatedAt: fresh.updatedAt });
        } catch (err) {
          baselineRef.current = null; // could not re-read: skip the overwrite check rather than warn wrongly
        }
        dirtyRef.current = false;
        setDirty(false);
        setSurvey((s) => ({ ...s, status }));
        if (status === 'complete') {
          toast.success('Survey saved and marked complete. You can now share it.');
          navigate(`/surveys/${id}`);
        } else {
          toast.success('Draft saved.');
        }
      } else {
        const newId = await createSurvey(user.uid, { ...payload, status, ownerName: personName(user) });
        dirtyRef.current = false;
        setDirty(false);
        toast.success(status === 'complete' ? 'Survey saved and marked complete. You can now share it.' : 'Draft saved.');
        navigate(status === 'complete' ? `/surveys/${newId}` : `/surveys/${newId}/edit`, { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not save. Check your connection and try again.');
    } finally {
      setSaving('');
    }
  };

  const runExport = async (kind) => {
    setExporting(kind);
    try {
      const data = normalizeSurveyForSave(survey);
      if (!data.title) data.title = 'Untitled survey';
      if (kind === 'pdf') {
        const { exportSurveyPdf } = await import('../utils/exportSurveyPdf');
        exportSurveyPdf(data);
      } else {
        const { exportSurveyDocx } = await import('../utils/exportSurveyDocx');
        await exportSurveyDocx(data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not create the file. Please try again.');
    } finally {
      setExporting('');
    }
  };

  const goBack = () => navigate(id ? `/surveys/${id}` : '/');

  // ---- render --------------------------------------------------------------------
  if (loading) return <Loader label="Loading survey..." />;
  if (notFound || !survey) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 520 }}>
        <i className="bi bi-question-circle display-3 text-secondary" aria-hidden="true" />
        <h1 className="h4 mt-3">Survey not found</h1>
        <p className="text-secondary">It may have been deleted.</p>
        <Link to="/" className="btn btn-primary">
          Back to surveys
        </Link>
      </div>
    );
  }

  const isComplete = survey.status === 'complete';
  const statusText = dirty ? 'Unsaved changes' : id ? 'All changes saved' : 'Not saved yet';

  return (
    <>
      <div className="sf-toolbar">
        <div className="container-xl d-flex align-items-center gap-2 py-2 text-nowrap">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={goBack} aria-label="Back">
            <i className="bi bi-arrow-left" aria-hidden="true" />
            <span className="d-none d-md-inline ms-1">Back</span>
          </button>

          <div className="flex-grow-1 min-w-0 d-none d-sm-block">
            <div className="fw-semibold text-truncate">{survey.title || 'Untitled survey'}</div>
            <div className="small text-secondary text-truncate">
              <span className={`badge me-1 ${isComplete ? 'text-bg-success' : 'text-bg-secondary'}`}>{isComplete ? 'Complete' : 'Draft'}</span>
              <span className={dirty ? 'text-warning-emphasis' : ''}>{statusText}</span>
            </div>
          </div>

          <div className="flex-grow-1 d-sm-none small">
            <span className="fw-semibold">{progress.percent}%</span>
            {dirty ? <i className="bi bi-circle-fill text-warning ms-2 small" title="Unsaved changes" aria-label="Unsaved changes" role="img" /> : null}
          </div>

          <div className="d-none d-sm-flex align-items-center gap-2" style={{ width: 130 }} title="Survey creation progress">
            <div className="progress flex-grow-1" style={{ height: 8 }} role="progressbar" aria-label="Survey creation progress" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
              <div className={`progress-bar ${progress.percent === 100 ? 'bg-success' : ''}`} style={{ width: `${progress.percent}%` }} />
            </div>
            <span className="small fw-semibold">{progress.percent}%</span>
          </div>

          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreviewOpen(true)} aria-label="Preview">
            <i className="bi bi-eye" aria-hidden="true" />
            <span className="d-none d-lg-inline ms-1">Preview</span>
          </button>

          <DownloadMenu
            label="Download"
            busyKey={exporting}
            items={[
              { key: 'pdf', label: 'PDF document', icon: 'bi-file-earmark-pdf', onSelect: () => runExport('pdf') },
              { key: 'docx', label: 'Word document', icon: 'bi-file-earmark-word', onSelect: () => runExport('docx') },
            ]}
          />

          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => persist('draft')} disabled={Boolean(saving)}>
            {saving === 'draft' ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <i className="bi bi-save" aria-hidden="true" />}
            <span className="d-none d-md-inline ms-1">{isComplete ? 'Save as draft' : 'Save draft'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => persist('complete')}
            disabled={Boolean(saving) || !progress.canComplete}
            title={progress.canComplete ? '' : 'Finish the checklist first'}
          >
            {saving === 'complete' ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <i className="bi bi-check2-circle" aria-hidden="true" />}
            <span className="ms-1 d-none d-sm-inline">{isComplete ? 'Save changes' : 'Mark complete'}</span>
            <span className="ms-1 d-sm-none">{isComplete ? 'Save' : 'Complete'}</span>
          </button>
        </div>
      </div>

      <div className="container-xl py-4">
        {id && authorInfo && (
          <div className="alert alert-secondary small py-2 d-flex align-items-start gap-2">
            <i className="bi bi-people mt-1" aria-hidden="true" />
            <span>
              Shared with your team. Created by {authorInfo.ownerId === user.uid ? 'you' : authorInfo.ownerName || 'a teammate'}
              {authorInfo.updatedByName ? `; last saved by ${authorInfo.updatedByName}` : ''}
              {authorInfo.updatedAt ? ` on ${formatDateTimeLong(authorInfo.updatedAt)}` : ''}. If a teammate saves while you are editing, you will be asked before your save replaces theirs.
            </span>
          </div>
        )}
        {isComplete && (
          <div className="alert alert-info small py-2">
            <i className="bi bi-info-circle me-2" aria-hidden="true" />
            This survey is complete. Links you already shared keep showing the version they were created with; create a new link after saving to share your changes.
          </div>
        )}

        <div className="row g-4">
          <div className="col-lg-8">
            <div className="card mb-4">
              <div className="card-body">
                <label htmlFor="survey-title" className="form-label fw-semibold">
                  Survey title
                </label>
                <input
                  id="survey-title"
                  type="text"
                  className="form-control form-control-lg mb-3"
                  value={survey.title}
                  placeholder="e.g. Customer satisfaction survey"
                  maxLength={200}
                  onChange={(e) => updateMeta('title', e.target.value)}
                />
                <label htmlFor="survey-description" className="form-label fw-semibold">
                  Description
                </label>
                <textarea
                  id="survey-description"
                  className="form-control"
                  rows={3}
                  value={survey.description}
                  placeholder="Tell respondents what this survey is for and how long it takes."
                  maxLength={3000}
                  onChange={(e) => updateMeta('description', e.target.value)}
                />
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <h2 className="h5 mb-0">
                Questions <span className="text-secondary fw-normal">({progress.questionCount})</span>
              </h2>
              {survey.questions.length > 1 && (
                <div className="btn-group btn-group-sm">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setAllOpen(true)}>
                    <i className="bi bi-arrows-expand me-1" aria-hidden="true" />
                    Expand all
                  </button>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setAllOpen(false)}>
                    <i className="bi bi-arrows-collapse me-1" aria-hidden="true" />
                    Collapse all
                  </button>
                </div>
              )}
            </div>

            {survey.questions.length === 0 && (
              <div className="card text-center mb-3">
                <div className="card-body py-5">
                  <i className="bi bi-chat-left-text display-5 text-secondary" aria-hidden="true" />
                  <p className="mt-3 mb-0 text-secondary">No questions yet. Pick a question type below to add your first one.</p>
                </div>
              </div>
            )}

            {survey.questions.map((q, index) => (
              <QuestionEditor
                key={q.id}
                question={q}
                number={numbers[q.id]}
                index={index}
                total={survey.questions.length}
                issues={progress.issuesById[q.id] || []}
                isOpen={Boolean(openIds[q.id])}
                onToggle={onToggle}
                onChange={onQuestionChange}
                onMove={onMove}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))}

            <AddQuestionPanel onAdd={addQuestion} />
          </div>

          <div className="col-lg-4">
            <div className="sf-sidebar">
              <ProgressPanel progress={progress} />
            </div>
          </div>
        </div>
      </div>

      {previewOpen && <PreviewModal survey={normalizeSurveyForSave(survey)} onClose={() => setPreviewOpen(false)} />}

      <ConfirmModal
        show={Boolean(deleteTarget)}
        title="Delete this question?"
        message={deleteTarget ? `"${deleteTarget.text || 'Untitled question'}" will be removed from the survey.` : ''}
        confirmLabel="Delete question"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        show={Boolean(conflict)}
        title="A teammate changed this survey"
        message={
          conflict
            ? `${conflict.by || 'A teammate'} saved changes${conflict.at ? ` at ${formatDateTimeLong(conflict.at)}` : ''} after you opened this survey. If you save now, your version replaces theirs. Choose "Keep editing" if you would rather download a copy of your work and reload the page to see their changes first.`
            : ''
        }
        confirmLabel="Save and replace theirs"
        cancelLabel="Keep editing"
        variant="warning"
        onConfirm={() => {
          const pending = conflict;
          setConflict(null);
          persist(pending.status, { force: true });
        }}
        onCancel={() => setConflict(null)}
      />

      <ConfirmModal
        show={blocker.state === 'blocked'}
        title="Leave without saving?"
        message="You have unsaved changes that will be lost if you leave this page."
        confirmLabel="Leave page"
        cancelLabel="Stay and keep editing"
        onConfirm={() => blocker.proceed()}
        onCancel={() => blocker.reset()}
      />
    </>
  );
}
